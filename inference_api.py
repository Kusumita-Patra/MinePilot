"""
Standalone Risk Inference API
==============================
Run with:  uvicorn inference_api:app --reload --port 8000
Docs at:   http://127.0.0.1:8000/docs

Accepts telemetry (single reading or a short rolling window) and returns
an immediate risk classification using risk_scoring.calculate_risk_index,
plus an optional 1-hour-ahead forecast if the forecast model is present.
"""

import os
import asyncio
import random
from datetime import datetime, timezone
from typing import List, Optional
import numpy as np
import joblib
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from risk_scoring import calculate_risk_index, FEATURE_ORDER
from data_generator import SENSORS as SENSOR_CONFIG, SECTORS
import incidents

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

app = FastAPI(
    title="Smart Mine Risk Inference API",
    description="Predictive hazard modeling for the Smart Mine Digital Twin platform",
    version="1.0.0",
)

# Allow the Next.js dev server to call the REST endpoints below. WebSocket
# connections aren't subject to CORS, but fetch()-based POST/PATCH calls
# from the dashboard/field pages need this.
_frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_origin, "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class TelemetryReading(BaseModel):
    ch4_pct: float = Field(..., ge=0, description="Methane concentration (%)")
    co_ppm: float = Field(..., ge=0, description="Carbon monoxide (ppm)")
    dust_pm10: float = Field(..., ge=0, description="Particulate matter PM10 (mg/m^3)")
    displacement_mm: float = Field(..., ge=0, description="Strata displacement rate (mm/day)")
    temp_c: float = Field(..., description="Ambient temperature (deg C)")


class PredictRiskRequest(BaseModel):
    sensor_id: Optional[str] = None
    sector_id: Optional[str] = None
    # Accept either a single latest reading, or a short window (list) of
    # recent readings — the API uses the most recent one for scoring and,
    # if a forecast model is available and enough history is given, produces
    # a 1-hour-ahead forecast from the rolling window.
    telemetry: List[TelemetryReading] = Field(..., min_items=1)


class PredictRiskResponse(BaseModel):
    sensor_id: Optional[str]
    sector_id: Optional[str]
    risk_score: int
    risk_level: str
    anomaly_factors: List[str]
    forecast: Optional[dict] = None


_forecast_model = None
_forecast_meta = None
_forecast_loaded = False


def _load_forecast_model():
    global _forecast_model, _forecast_meta, _forecast_loaded
    if not _forecast_loaded:
        model_path = os.path.join(MODEL_DIR, "forecast_model.joblib")
        meta_path = os.path.join(MODEL_DIR, "forecast_model_meta.joblib")
        if os.path.exists(model_path) and os.path.exists(meta_path):
            _forecast_model = joblib.load(model_path)
            _forecast_meta = joblib.load(meta_path)
        _forecast_loaded = True
    return _forecast_model, _forecast_meta


def _build_forecast_features(window: List[TelemetryReading], feature_cols: List[str]) -> Optional[np.ndarray]:
    """Best-effort reconstruction of the training feature set from a short
    live window. Requires enough samples for a meaningful rolling stat;
    returns None if the window is too short."""
    if len(window) < 3:
        return None

    values = {k: np.array([getattr(r, k) for r in window]) for k in FEATURE_ORDER}
    row = {}
    for k in FEATURE_ORDER:
        row[k] = values[k][-1]
        row[f"{k}_roll_mean"] = values[k].mean()
        row[f"{k}_roll_std"] = values[k].std()
        row[f"{k}_rate"] = values[k][-1] - values[k][-2]

    try:
        return np.array([[row[c] for c in feature_cols]])
    except KeyError:
        return None


@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Incident ticket lifecycle — REST endpoints consumed by the dashboard
# (mine manager) and field-worker views.
# ---------------------------------------------------------------------------

@app.get("/api/v1/incidents", response_model=List[incidents.Incident])
def get_incidents(status: Optional[str] = None):
    return incidents.list_incidents(status)


@app.patch("/api/v1/incidents/{ticket_id}", response_model=incidents.Incident)
def patch_incident(ticket_id: str, patch: incidents.IncidentUpdate):
    try:
        return incidents.update_incident(ticket_id, patch)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"No incident {ticket_id}")
    except incidents.InvalidTransition as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.post("/api/v1/incidents/reset")
def reset_incidents():
    """Demo/testing helper — clears all incidents."""
    incidents.reset_all()
    return {"status": "cleared"}


@app.post("/api/v1/predict-risk", response_model=PredictRiskResponse)
def predict_risk(req: PredictRiskRequest):
    if not req.telemetry:
        raise HTTPException(status_code=400, detail="telemetry array must not be empty")

    latest = req.telemetry[-1]
    reading_dict = latest.dict()

    result = calculate_risk_index(reading_dict)

    if result["risk_level"] != "NORMAL" and req.sensor_id and req.sector_id:
        incidents.trigger_incident(
            sensor_id=req.sensor_id,
            sector_id=req.sector_id,
            risk_score=result["risk_score"],
            severity=result["risk_level"],
        )

    forecast_out = None
    model, meta = _load_forecast_model()
    if model is not None and meta is not None:
        feats = _build_forecast_features(req.telemetry, meta["feature_cols"])
        if feats is not None:
            predicted_score = float(np.clip(model.predict(feats)[0], 0, 100))
            level = "CRITICAL" if predicted_score >= 75 else ("WARNING" if predicted_score >= 40 else "NORMAL")
            forecast_out = {
                "horizon_minutes": meta["horizon_steps"] * 30 / 60,
                "predicted_risk_score": round(predicted_score, 1),
                "predicted_risk_level": level,
            }

    return PredictRiskResponse(
        sensor_id=req.sensor_id,
        sector_id=req.sector_id,
        risk_score=result["risk_score"],
        risk_level=result["risk_level"],
        anomaly_factors=result["anomaly_factors"],
        forecast=forecast_out,
    )


# ---------------------------------------------------------------------------
# Live telemetry WebSocket — matches the /ws/telemetry schema from the shared
# architecture contract exactly (sensor_id, sector_id, coordinates, telemetry,
# risk_score, risk_level, timestamp). One composite sensor node per sector,
# continuously random-walked, with occasional injected anomaly scenarios so
# the digital twin frontend has something interesting to render.
# ---------------------------------------------------------------------------

ANOMALY_KINDS = ["methane_buildup", "strain_accel", "spon_combustion", "multigas_spike", None, None, None]
_SIM_STATE = {}


def _init_sim_state():
    for i, sector in enumerate(SECTORS):
        _SIM_STATE[sector] = {
            "sensor_id": f"SNS-{sector.split('_')[1][:3].upper()}{i}-MULTI-01",
            "coordinates": {
                "x": round(random.uniform(-50, 50), 1),
                "y": round(random.uniform(-50, 50), 1),
                "z": round(random.uniform(-20, 20), 1),
            },
            "values": {k: random.uniform(*cfg["baseline"]) for k, cfg in SENSOR_CONFIG.items()},
            "anomaly_kind": None,
            "anomaly_ticks_left": 0,
        }


_init_sim_state()


def _step_sensor(sector: str) -> dict:
    state = _SIM_STATE[sector]
    vals = state["values"]

    # occasionally start a new anomaly scenario for this sector
    if state["anomaly_ticks_left"] == 0 and random.random() < 0.08:
        kind = random.choice(ANOMALY_KINDS)
        state["anomaly_kind"] = kind
        state["anomaly_ticks_left"] = random.randint(20, 50) if kind else 0

    # baseline mean-reverting random walk
    for k, cfg in SENSOR_CONFIG.items():
        lo, hi = cfg["baseline"]
        mid = (lo + hi) / 2
        drift = 0.05 * (mid - vals[k])
        vals[k] += drift + random.gauss(0, cfg["noise"])

    # apply the active anomaly's push, if any
    if state["anomaly_ticks_left"] > 0:
        kind = state["anomaly_kind"]
        if kind == "methane_buildup":
            vals["ch4_pct"] += vals["ch4_pct"] * 0.06
        elif kind == "strain_accel":
            vals["displacement_mm"] += vals["displacement_mm"] * 0.15
        elif kind == "spon_combustion":
            vals["temp_c"] += 0.4
            vals["co_ppm"] += vals["co_ppm"] * 0.08
        elif kind == "multigas_spike":
            vals["ch4_pct"] += vals["ch4_pct"] * 0.3
            vals["co_ppm"] += vals["co_ppm"] * 0.3
            vals["dust_pm10"] += vals["dust_pm10"] * 0.3
        state["anomaly_ticks_left"] -= 1

    # clip to physically sane bounds
    vals["ch4_pct"] = float(np.clip(vals["ch4_pct"], 0, 10))
    vals["co_ppm"] = float(np.clip(vals["co_ppm"], 0, 500))
    vals["dust_pm10"] = float(np.clip(vals["dust_pm10"], 0, 50))
    vals["displacement_mm"] = float(np.clip(vals["displacement_mm"], 0, 50))
    vals["temp_c"] = float(np.clip(vals["temp_c"], 15, 80))

    return state


@app.websocket("/ws/telemetry")
async def ws_telemetry(websocket: WebSocket):
    """Streams one simulated reading (from a randomly chosen sector) roughly
    every 1.5s, with risk_score/risk_level computed live via calculate_risk_index
    — the same scoring path used by /api/v1/predict-risk, so both interfaces
    stay consistent."""
    await websocket.accept()
    try:
        while True:
            sector = random.choice(SECTORS)
            state = _step_sensor(sector)
            telemetry = {k: round(v, 2) for k, v in state["values"].items()}
            risk = calculate_risk_index(telemetry)

            if risk["risk_level"] != "NORMAL":
                incidents.trigger_incident(
                    sensor_id=state["sensor_id"],
                    sector_id=sector,
                    risk_score=risk["risk_score"],
                    severity=risk["risk_level"],
                )

            payload = {
                "sensor_id": state["sensor_id"],
                "sector_id": sector,
                "coordinates": state["coordinates"],
                "telemetry": telemetry,
                "risk_score": risk["risk_score"],
                "risk_level": risk["risk_level"],
                "anomaly_factors": risk["anomaly_factors"],
                "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            }
            await websocket.send_json(payload)
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        pass