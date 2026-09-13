"use client";

import Link from "next/link";
import { X } from "lucide-react";
import type { SensorFrame } from "../../../shared/types/telemetry";
import { suggestionsForFactors } from "@/lib/riskMitigationSuggestions";
import { formatSectorId } from "@/lib/format";
import { useTelemetry } from "@/lib/telemetryContext";

// Mirrors risk_scoring.THRESHOLDS (statutory limits) — duplicated here rather
// than importing across the T2/frontend boundary, same pattern
// backend/app/services/analytics_service.py already uses for its own
// duplicated risk-level cutoffs.
const FACTORS: { key: keyof SensorFrame["telemetry"]; label: string; threshold: number }[] = [
  { key: "ch4_pct", label: "Gas Concentration (CH₄)", threshold: 1.0 },
  { key: "co_ppm", label: "Carbon Monoxide", threshold: 50.0 },
  { key: "dust_pm10", label: "Dust (PM10)", threshold: 5.0 },
  { key: "displacement_mm", label: "Strata Displacement", threshold: 5.0 },
  { key: "temp_c", label: "Ambient Temperature", threshold: 36.0 },
];

// Same 60%-of-threshold cutoff risk_scoring.rule_based_component uses to
// decide whether a factor is worth calling out at all.
const ELEVATED_RATIO_CUTOFF = 0.6;

export default function AiRiskAnalysis({
  sensors = [],
  riskScore = 0,
  selected = null,
  onClearSelection,
  onFocusSensor,
}: {
  sensors?: SensorFrame[];
  riskScore?: number;
  /** The sensor selected in the 3D twin / sector ranking — shared app-wide
   * via useTelemetry() — so this panel, the ranking list, and the 3D view
   * all focus on the same sector instead of reading as three unrelated
   * widgets. Null means "show the worst sensor mine-wide." */
  selected?: SensorFrame | null;
  onClearSelection?: () => void;
  /** Lets the "Worst: <sector>" label double as a shortcut into the same
   * cross-widget focus the 3D view / ranking list already drive. */
  onFocusSensor?: (sensor: SensorFrame) => void;
}) {
  const { usingMockData } = useTelemetry();

  // The single worst-scoring sensor mine-wide — used as the "All Sectors"
  // focus instead of every sensor at once. Taking each channel's max
  // independently across unrelated sensors (CH4 from one sector, CO from
  // another, Dust from a third) would Frankenstein together a composite
  // reading that no real sensor ever reported, while disagreeing with a
  // separately-computed headline score. Scoping to one real sensor keeps
  // the ring and the breakdown describing the same actual situation.
  const worstSensor = sensors.length
    ? sensors.reduce((worst, s) => (s.risk_score > worst.risk_score ? s : worst), sensors[0])
    : null;

  // Focus down to the selected sector when one is active; otherwise fall
  // back to the worst currently-active sensor mine-wide.
  const scopedSensors = selected
    ? sensors.filter((s) => s.sector_id === selected.sector_id)
    : worstSensor
    ? [worstSensor]
    : [];
  const effectiveScore = selected ? selected.risk_score : riskScore;

  const status = effectiveScore >= 75 ? "HIGH RISK" : effectiveScore >= 40 ? "MODERATE RISK" : "LOW RISK";
  const statusColor = effectiveScore >= 75 ? "text-red-500" : effectiveScore >= 40 ? "text-amber-400" : "text-emerald-400";
  const ringColor = effectiveScore >= 75 ? "#ef4444" : effectiveScore >= 40 ? "#f59e0b" : "#10b981";

  const hasData = scopedSensors.length > 0;

  // Ratio-to-threshold per channel, from the sensor(s) actually in scope
  // (the worst mine-wide, or every sensor in the selected sector — never a
  // per-channel max blended across unrelated sensors, which is what caused
  // the bug this replaced).
  const factorRatios = FACTORS.map((f) => {
    const maxRatio = hasData
      ? Math.max(...scopedSensors.map((s) => s.telemetry[f.key] / f.threshold))
      : 0;
    return { ...f, pct: Math.round(Math.min(Math.max(maxRatio, 0), 1) * 100) };
  });

  // Reuses the same factor-string shape risk_scoring.py produces (see
  // riskMitigationSuggestions.ts) so elevated channels get the exact same
  // mitigation copy as the Future Predictions panel, instead of a second,
  // hand-maintained recommendation list that can drift out of sync with it.
  const elevatedFactors = factorRatios
    .filter((f) => f.pct / 100 >= ELEVATED_RATIO_CUTOFF)
    .map((f) => `${f.key} at ${f.pct}% of statutory limit`);
  const recommendations = suggestionsForFactors(elevatedFactors);

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex flex-col gap-4 w-full lg:w-80 shrink-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide">AI RISK ANALYSIS</p>
        {selected ? (
          <button
            onClick={onClearSelection}
            className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
            title="Show all sectors"
          >
            {formatSectorId(selected.sector_id)}
            <X size={11} />
          </button>
        ) : worstSensor ? (
          <button
            onClick={() => onFocusSensor?.(worstSensor)}
            className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 transition-colors"
            title="Worst currently-active sensor mine-wide — click to focus it everywhere"
          >
            Worst: {formatSectorId(worstSensor.sector_id)}
          </button>
        ) : (
          <span className="text-[10px] text-neutral-500">No live sensors</span>
        )}
      </div>

      {usingMockData && (
        <p className="text-[10px] text-amber-400 bg-amber-400/10 rounded-md px-2 py-1 -mt-2">
          Showing simulated demo data — not connected to the live sensor network.
        </p>
      )}

      <div className="flex flex-col items-center py-2">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
            <path
              d="M18 2.5 a 15.5 15.5 0 1 1 0 31 a 15.5 15.5 0 1 1 0 -31"
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="3"
            />
            <path
              d="M18 2.5 a 15.5 15.5 0 1 1 0 31 a 15.5 15.5 0 1 1 0 -31"
              fill="none"
              stroke={ringColor}
              strokeWidth="3"
              strokeDasharray={`${effectiveScore}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-bold">{effectiveScore}</span>
            <span className="text-[10px] text-neutral-500">/100</span>
          </div>
        </div>
        <p className={`text-sm font-bold mt-2 ${statusColor}`}>{hasData ? status : "NO DATA"}</p>
      </div>

      {!hasData ? (
        <p className="text-[11px] text-neutral-600 text-center py-4">No live telemetry yet.</p>
      ) : (
        <div className="space-y-2.5">
          {factorRatios.map((f) => (
            <div key={f.key}>
              <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                <span>{f.label}</span>
                <span>{f.pct}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${f.pct >= 100 ? "bg-red-500" : f.pct >= 60 ? "bg-amber-400" : "bg-blue-500"}`}
                  style={{ width: `${f.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-white/10">
        <p className="text-[11px] font-semibold text-neutral-400 mb-2">AI Recommendation</p>
        {recommendations.length === 0 ? (
          <p className="text-[11px] text-neutral-600">No elevated factors — no action needed.</p>
        ) : (
          <ul className="space-y-1.5">
            {recommendations.map((r) => (
              <li key={r.factor} className="flex items-center gap-2 text-[11px] text-neutral-300">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {r.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href="/dashboard/compliance"
        className="w-full block text-center bg-blue-600 hover:bg-blue-500 text-xs font-medium py-2 rounded-lg transition-colors"
      >
        View Full Analysis
      </Link>
    </div>
  );
}
