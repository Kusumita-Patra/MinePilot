"use client";

import { useRiskRanking } from "@/hooks/useRiskRanking";
import ComplianceOverview from "@/components/ComplianceOverview";

function riskTone(score: number) {
  if (score >= 75) return "bg-red-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-emerald-400";
}

export default function CompliancePage() {
  const { data: ranking, loading } = useRiskRanking();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Compliance</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ComplianceOverview showViewAll={false} />

        <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">
            SECTOR RISK RANKING
          </p>
          <div className="space-y-3">
            {loading && ranking.length === 0 && (
              <p className="text-[11px] text-neutral-600 py-3">Loading…</p>
            )}
            {!loading && ranking.length === 0 && (
              <p className="text-[11px] text-neutral-600 py-3">No sector telemetry yet.</p>
            )}
            {ranking.map((r, i) => (
              <div key={r.sector_id} className="flex items-center gap-3">
                <span className="text-[11px] text-neutral-500 w-4">{i + 1}</span>
                <span className="text-xs flex-1 truncate">{r.sector_id.replace(/_/g, " ")}</span>
                <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${riskTone(r.avg_risk_score)}`}
                    style={{ width: `${r.avg_risk_score}%` }}
                  />
                </div>
                <span className="text-xs font-medium w-8 text-right">{r.avg_risk_score}</span>
                <span className="text-[10px] text-neutral-500 w-16 text-right">{r.risk_level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-neutral-600">
        Compliance-by-category scoring isn&apos;t computed by the backend yet (no writer for{" "}
        <code className="text-neutral-500">compliance_scores</code>) — the panel above shows
        illustrative figures until that&apos;s designed. Sector risk ranking is real, live data.
      </p>
    </div>
  );
}
