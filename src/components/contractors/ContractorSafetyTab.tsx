"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import clsx from "clsx";
import type { Contractor } from "../../../shared/types/contractors";
import { computeFallbackRiskScore } from "@/lib/complianceUtils";
import SafetyScoreRing from "./SafetyScoreRing";

const RISK_BAND_STYLES = {
  LOW: "bg-emerald-500/10 text-emerald-400",
  MODERATE: "bg-amber-500/10 text-amber-400",
  HIGH: "bg-orange-500/10 text-orange-400",
  CRITICAL: "bg-red-500/10 text-red-400",
};

export default function ContractorSafetyTab({ contractor }: { contractor: Contractor }) {
  const m = contractor.safetyMetrics;
  // TODO(Team 2): once POST /predict/contractor-risk is live, prefer
  // m.aiRiskScore/aiRiskBand when non-null instead of the fallback below.
  const fallback = computeFallbackRiskScore(contractor.compliancePercentage, m.incidentCount);
  const riskScore = m.aiRiskScore ?? fallback.score;
  const riskBand = m.aiRiskBand ?? fallback.band;

  const metrics = [
    { label: "Man-hours (total)", value: m.manHoursTotal.toLocaleString("en-IN") },
    { label: "Man-hours (this month)", value: m.manHoursThisMonth.toLocaleString("en-IN") },
    { label: "Incidents", value: m.incidentCount },
    { label: "Near misses", value: m.nearMissCount },
    { label: "First-aid cases", value: m.firstAidCaseCount },
    { label: "Lost time injuries", value: m.lostTimeInjuryCount },
    { label: "LTIFR", value: m.ltifr },
    { label: "Observations raised / closed", value: `${m.safetyObservationsRaised} / ${m.safetyObservationsClosed}` },
    { label: "Violations", value: m.violationCount },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <SafetyScoreRing score={m.safetyScore} size={64} />
          <div>
            <p className="text-sm font-medium">Safety Score</p>
            <p className="text-[11px] text-neutral-500">Based on incidents, observations and violations</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] text-neutral-500 mb-1">AI Risk Band {m.aiRiskScore === null && "(fallback)"}</p>
          <span className={clsx("inline-block px-2 py-1 rounded-full text-xs font-medium", RISK_BAND_STYLES[riskBand])}>
            {riskBand} · {riskScore}
          </span>
          {m.aiRiskFactors.length > 0 && (
            <p className="text-[11px] text-neutral-500 mt-1">{m.aiRiskFactors.join(", ")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] text-neutral-500">{metric.label}</p>
            <p className="text-lg font-semibold tabular-nums">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-3 h-56">
        <p className="text-[11px] text-neutral-500 mb-2">Safety Score Trend</p>
        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={m.scoreTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#737373" }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#737373" }} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }} />
            <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
