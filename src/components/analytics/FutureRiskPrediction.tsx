"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { TrendingUp, TrendingDown, Minus, WifiOff } from "lucide-react";
import { getTelemetryHistory } from "@/lib/api";
import { predictRisk, type PredictRiskResponse } from "@/lib/predictRiskApi";
import { suggestionsForFactors } from "@/lib/riskMitigationSuggestions";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import type { RiskLevel } from "../../../shared/types/telemetry";

const riskBadge: Record<RiskLevel, string> = {
  NORMAL: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  WARNING: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  CRITICAL: "text-red-500 border-red-500/40 bg-red-500/10",
};

export default function FutureRiskPrediction({ sectorId }: { sectorId: string | null }) {
  const [prediction, setPrediction] = useState<PredictRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!sectorId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const recent = await getTelemetryHistory({ sector_id: sectorId, limit: 10 });
        const window = [...recent].reverse(); // oldest -> newest, as the forecast model expects
        if (window.length === 0) throw new Error("No telemetry available for this sector yet.");

        const result = await predictRisk({
          sensor_id: window[window.length - 1].sensor_id,
          sector_id: sectorId,
          telemetry: window.map((p) => p.telemetry),
        });
        if (!cancelled) setPrediction(result);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "Prediction service unavailable."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [sectorId]);

  const forecast = prediction?.forecast ?? null;
  const trend = forecast ? forecast.predicted_risk_score - (prediction?.risk_score ?? 0) : 0;
  const suggestions = prediction ? suggestionsForFactors(prediction.anomaly_factors) : [];

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">FUTURE PREDICTIONS</p>

      {loading ? (
        <div className="space-y-2">
          <SkeletonLoader className="h-16 w-full" />
          <SkeletonLoader className="h-4 w-2/3" />
          <SkeletonLoader className="h-4 w-1/2" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center text-center gap-2 py-8">
          <WifiOff size={20} className="text-neutral-600" />
          <p className="text-[11px] text-neutral-500">{error}</p>
          <p className="text-[11px] text-neutral-600">
            The ML inference service (T2, port 8000) must be running for predictions.
          </p>
        </div>
      ) : !prediction ? (
        <p className="text-[11px] text-neutral-600 py-8 text-center">Select a sector to see its forecast.</p>
      ) : !forecast ? (
        <p className="text-[11px] text-neutral-600 py-8 text-center">
          Not enough recent history yet to produce a forecast for this sector.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div
              className={clsx(
                "rounded-lg border px-4 py-3 font-medium flex items-center gap-2",
                riskBadge[forecast.predicted_risk_level]
              )}
            >
              {trend > 0 ? <TrendingUp size={16} /> : trend < 0 ? <TrendingDown size={16} /> : <Minus size={16} />}
              Predicted risk in ~{Math.round(forecast.horizon_minutes)} min:{" "}
              {Math.round(forecast.predicted_risk_score)} — {forecast.predicted_risk_level}
            </div>
            <p className="text-[11px] text-neutral-500">
              Current: {prediction.risk_score} ({prediction.risk_level})
            </p>
          </div>

          {(forecast.critical_probability !== undefined || forecast.warning_probability !== undefined) && (
            <p className="text-[11px] text-neutral-500">
              Confidence:{" "}
              {forecast.predicted_risk_level === "CRITICAL"
                ? `${Math.round((forecast.critical_probability ?? 0) * 100)}% likelihood of reaching CRITICAL`
                : forecast.predicted_risk_level === "WARNING"
                ? `${Math.round((forecast.warning_probability ?? 0) * 100)}% likelihood of reaching WARNING`
                : "below the calibrated alarm threshold"}{" "}
              — calibrated for a low false-alarm rate
            </p>
          )}

          <div>
            <p className="text-[11px] font-semibold text-neutral-400 tracking-wide mb-2">POSSIBLE ACTIONS</p>
            {suggestions.length === 0 ? (
              <p className="text-[11px] text-neutral-600">No elevated factors — no action needed.</p>
            ) : (
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <li key={i} className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs font-medium">{s.label}</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">{s.suggestion}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-[10px] text-neutral-600">
            Short-horizon forecast from the current telemetry window — not a long-range prediction.
          </p>
        </div>
      )}
    </div>
  );
}
