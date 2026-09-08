// Client for T2's standalone ML/risk-inference service (inference_api.py),
// port 8000 — a separate process from our own backend (backend/app, port 8001).
// We only ever call it over REST; inference_api.py / risk_scoring.py /
// data_generator.py themselves are never modified (see CLAUDE.md §1).
import type { TelemetryReading } from "../../shared/types/telemetry";

const INFERENCE_API_URL = process.env.NEXT_PUBLIC_INFERENCE_API_URL ?? "http://localhost:8000";

export interface PredictRiskForecast {
  horizon_minutes: number;
  predicted_risk_score: number;
  predicted_risk_level: "NORMAL" | "WARNING" | "CRITICAL";
}

export interface PredictRiskResponse {
  sensor_id: string | null;
  sector_id: string | null;
  risk_score: number;
  risk_level: "NORMAL" | "WARNING" | "CRITICAL";
  anomaly_factors: string[];
  forecast_15min: PredictRiskForecast | null;
}

export async function predictRisk(params: {
  sensor_id?: string;
  sector_id?: string;
  telemetry: TelemetryReading[];
}): Promise<PredictRiskResponse> {
  const res = await fetch(`${INFERENCE_API_URL}/api/v1/predict-risk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Prediction request failed: ${res.status}`);
  }
  return res.json();
}
