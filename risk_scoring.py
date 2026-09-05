"""
Risk Scoring Engine
====================
Combines:
  1. Deterministic statutory-threshold guardrails (hard clamp to 100 on breach)
  2. Rule-based proximity-to-threshold scoring (0-100 continuous)
  3. ML anomaly-detection boost (Isolation Forest, if model available)

This module has NO hard dependency on trained models at import time — if a
model file is missing, it degrades gracefully to rule-based scoring only.
This is what both the training pipeline and the FastAPI service import.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional
import os
import joblib
import numpy as np

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

THRESHOLDS = {
    "ch4_pct": 1.0,
    "co_ppm": 50.0,
    "dust_pm10": 5.0,
    "displacement_mm": 5.0,
    "temp_c": 36.0,
}

# Weight each sensor's proximity-to-threshold contributes to the base score.
WEIGHTS = {
    "ch4_pct": 0.30,
    "co_ppm": 0.20,
    "dust_pm10": 0.10,
    "displacement_mm": 0.25,
    "temp_c": 0.15,
}

FEATURE_ORDER = ["ch4_pct", "co_ppm", "dust_pm10", "displacement_mm", "temp_c"]


@dataclass
class RiskResult:
    risk_score: int
    risk_level: str
    anomaly_factors: List[str] = field(default_factory=list)
    breached_thresholds: List[str] = field(default_factory=list)
    anomaly_score: Optional[float] = None


def _risk_level(score: int) -> str:
    if score >= 75:
        return "CRITICAL"
    if score >= 40:
        return "WARNING"
    return "NORMAL"


def _load_anomaly_model():
    path = os.path.join(MODEL_DIR, "isolation_forest.joblib")
    if os.path.exists(path):
        return joblib.load(path)
    return None


def _load_scaler():
    path = os.path.join(MODEL_DIR, "feature_scaler.joblib")
    if os.path.exists(path):
        return joblib.load(path)
    return None


_ANOMALY_MODEL = None
_SCALER = None
_MODELS_LOADED = False


def _ensure_models_loaded():
    global _ANOMALY_MODEL, _SCALER, _MODELS_LOADED
    if not _MODELS_LOADED:
        _ANOMALY_MODEL = _load_anomaly_model()
        _SCALER = _load_scaler()
        _MODELS_LOADED = True


def rule_based_component(reading: Dict[str, float]) -> tuple[float, List[str]]:
    """Each sensor contributes proportionally to how close it is to its
    statutory threshold; weighted sum -> 0-100 base score."""
    score = 0.0
    factors = []
    for key, threshold in THRESHOLDS.items():
        value = reading.get(key, 0.0)
        ratio = max(0.0, value / threshold)  # 1.0 == exactly at threshold
        contribution = min(ratio, 1.3) * WEIGHTS[key] * 100
        score += contribution
        if ratio >= 0.6:
            factors.append(f"{key} at {ratio*100:.0f}% of statutory limit")
    return min(score, 100.0), factors


def anomaly_component(reading: Dict[str, float]) -> Optional[float]:
    """Returns a 0-100 boost derived from Isolation Forest's decision function,
    or None if no trained model is present."""
    _ensure_models_loaded()
    if _ANOMALY_MODEL is None:
        return None
    x = np.array([[reading.get(k, 0.0) for k in FEATURE_ORDER]])
    if _SCALER is not None:
        x = _SCALER.transform(x)
    # decision_function: higher = more normal, lower/negative = more anomalous
    raw = _ANOMALY_MODEL.decision_function(x)[0]
    # map roughly [-0.5, 0.5] -> [100, 0] boost potential, clipped
    boost = np.clip((0.15 - raw) / 0.35, 0.0, 1.0) * 100
    return float(boost)


def calculate_risk_index(telemetry_window: Dict[str, float]) -> Dict:
    """
    telemetry_window: dict of latest (or averaged rolling-window) sensor readings,
                       e.g. {"ch4_pct": 0.82, "co_ppm": 28.5, "dust_pm10": 3.1,
                             "displacement_mm": 1.4, "temp_c": 27.2}

    Returns: {"risk_score": int, "risk_level": str, "anomaly_factors": [...]}
    """
    breached = [k for k, t in THRESHOLDS.items() if telemetry_window.get(k, 0.0) >= t]

    # --- Deterministic fallback guardrail: statutory breach = instant 100 ---
    if breached:
        return {
            "risk_score": 100,
            "risk_level": "CRITICAL",
            "anomaly_factors": [f"STATUTORY BREACH: {k}" for k in breached],
        }

    rule_score, factors = rule_based_component(telemetry_window)
    anomaly_boost = anomaly_component(telemetry_window)

    if anomaly_boost is not None:
        # Blend: rule-based score is the floor, ML anomaly signal can push it up
        # but never fully overrides physical proximity-to-threshold reasoning.
        final_score = 0.65 * rule_score + 0.35 * anomaly_boost
        if anomaly_boost > 60:
            factors.append(f"ML anomaly detector flagged out-of-distribution pattern (boost={anomaly_boost:.0f})")
    else:
        final_score = rule_score

    final_score = int(round(min(max(final_score, 0), 100)))

    return {
        "risk_score": final_score,
        "risk_level": _risk_level(final_score),
        "anomaly_factors": factors,
    }


if __name__ == "__main__":
    # quick smoke test
    samples = [
        {"ch4_pct": 0.12, "co_ppm": 8.0, "dust_pm10": 1.0, "displacement_mm": 0.3, "temp_c": 24.0},
        {"ch4_pct": 0.82, "co_ppm": 28.5, "dust_pm10": 3.1, "displacement_mm": 1.4, "temp_c": 27.2},
        {"ch4_pct": 1.05, "co_ppm": 30.0, "dust_pm10": 2.0, "displacement_mm": 1.0, "temp_c": 25.0},
    ]
    for s in samples:
        print(s, "->", calculate_risk_index(s))
