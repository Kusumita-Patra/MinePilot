"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useRiskRanking } from "@/hooks/useRiskRanking";
import { useInspectionsBreakdown } from "@/hooks/useInspectionsBreakdown";
import ComplianceOverview from "@/components/ComplianceOverview";

const FALLBACK_RANKING = [
  { sector_id: "sector_north_wall", avg_risk_score: 87, risk_level: "CRITICAL" as const },
  { sector_id: "sector_shaft_b", avg_risk_score: 62, risk_level: "WARNING" as const },
  { sector_id: "sector_conveyor_3", avg_risk_score: 38, risk_level: "NORMAL" as const },
];

const INSPECTION_COLORS = {
  completed: "#10b981",
  in_progress: "#3b82f6",
  scheduled: "#f59e0b",
};

function riskTone(score: number) {
  if (score >= 75) return "bg-red-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-emerald-400";
}

export default function AnalyticsSection() {
  const { data: ranking, loading: rankingLoading } = useRiskRanking();
  const { data: inspections } = useInspectionsBreakdown();

  const rankingRows = ranking.length > 0 ? ranking : rankingLoading ? [] : FALLBACK_RANKING;

  const inspectionSegments = inspections
    ? [
        { name: "Completed", value: inspections.completed, color: INSPECTION_COLORS.completed },
        { name: "In Progress", value: inspections.in_progress, color: INSPECTION_COLORS.in_progress },
        { name: "Scheduled", value: inspections.scheduled, color: INSPECTION_COLORS.scheduled },
      ]
    : [];
  const total = inspectionSegments.reduce((a, b) => a + b.value, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <ComplianceOverview />

      {/* Sector Risk Ranking */}
      <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">SECTOR RISK RANKING</p>
        <div className="space-y-3">
          {rankingRows.length === 0 && (
            <p className="text-[11px] text-neutral-600 py-3">No sector telemetry yet.</p>
          )}
          {rankingRows.map((r, i) => (
            <div key={r.sector_id} className="flex items-center gap-3">
              <span className="text-[11px] text-neutral-500 w-4">{i + 1}</span>
              <span className="text-xs flex-1 truncate">{r.sector_id}</span>
              <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${riskTone(r.avg_risk_score)}`}
                  style={{ width: `${r.avg_risk_score}%` }}
                />
              </div>
              <span className="text-xs font-medium w-8 text-right">{r.avg_risk_score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Inspections Donut */}
      <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">INSPECTIONS (THIS MONTH)</p>
        {total === 0 ? (
          <p className="text-[11px] text-neutral-600 py-3">No inspections scheduled this month.</p>
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 relative shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={inspectionSegments}
                    dataKey="value"
                    innerRadius={32}
                    outerRadius={48}
                    stroke="none"
                  >
                    {inspectionSegments.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold">{total}</span>
                <span className="text-[9px] text-neutral-500">Total</span>
              </div>
            </div>
            <div className="space-y-1.5 text-[11px]">
              {inspectionSegments.map((i) => (
                <div key={i.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: i.color }} />
                  <span className="text-neutral-400">{i.name}</span>
                  <span className="font-medium ml-auto">
                    {i.value} ({total ? Math.round((i.value / total) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
