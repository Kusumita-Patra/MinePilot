"use client";

import { useEffect, useState } from "react";
import { Droplets, AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import ProgressRingComponent from "@/components/ui/ProgressRing";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { getSustainabilityDashboard, type SustainabilityDashboard } from "@/lib/sustainabilityApi";

const RING_COLOR = (score: number) =>
  score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-red-400";

const DATA_SOURCE_BADGE: Record<string, string> = {
  REAL_SENSOR: "bg-emerald-500/15 text-emerald-400",
  SIMULATED_SENSOR: "bg-blue-500/15 text-blue-400",
  MANUAL_ENTRY: "bg-purple-500/15 text-purple-400",
  CALCULATED: "bg-neutral-700/40 text-neutral-400",
  AI_ESTIMATE: "bg-amber-500/15 text-amber-400",
};

const SEVERITY_ICON: Record<string, typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertCircle,
};

const SEVERITY_COLOR: Record<string, string> = {
  info: "text-blue-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

export default function SustainabilityOverviewPanel() {
  const [dashboard, setDashboard] = useState<SustainabilityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      getSustainabilityDashboard()
        .then(setDashboard)
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load sustainability dashboard"))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-400">{error}</p>;
  if (!dashboard) return null;

  const { overall_score, sub_scores, water_summary, open_environmental_actions, insights } = dashboard;

  return (
    <div className="space-y-6">
      {/* Overall + sub-scores */}
      <div className="bg-gray-900 border border-white/10 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <ProgressRingComponent percentage={overall_score.score_pct} size={88} strokeWidth={8} colorClassName={RING_COLOR(overall_score.score_pct)} />
            <span className="text-xs font-medium text-neutral-300">Overall Sustainability</span>
            <Badge label={overall_score.data_source} className={DATA_SOURCE_BADGE[overall_score.data_source]} />
          </div>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 min-w-0">
            {sub_scores.map((score) => (
              <div key={score.category} className="flex flex-col items-center gap-1.5">
                <ProgressRingComponent percentage={score.score_pct} size={56} strokeWidth={6} colorClassName={RING_COLOR(score.score_pct)} />
                <span className="text-[11px] text-neutral-400 capitalize">{score.category.toLowerCase()}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-neutral-500 mt-4 border-t border-white/5 pt-3">{overall_score.methodology_notes}</p>
      </div>

      {/* Water */}
      <div className="bg-gray-900 border border-white/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Droplets size={16} className="text-blue-400" /> Water Sustainability
          </h3>
          {water_summary.data_source && (
            <Badge label={water_summary.data_source} className={DATA_SOURCE_BADGE[water_summary.data_source]} />
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Stat label="Water Used Today" value={`${water_summary.water_used_m3.toLocaleString()} m³`} />
          <Stat label="Water Reused" value={`${water_summary.water_reused_m3.toLocaleString()} m³`} />
          <Stat
            label="Reuse Rate"
            value={water_summary.reuse_rate_pct !== null ? `${water_summary.reuse_rate_pct}%` : "—"}
            highlight
          />
          <Stat label="Discharged" value={`${water_summary.water_discharged_m3.toLocaleString()} m³`} />
        </div>
        {water_summary.efficiency_m3_per_tonne !== null && (
          <p className="text-xs text-neutral-500 mt-3">
            Water Efficiency: <span className="text-neutral-300">{water_summary.efficiency_m3_per_tonne} m³/tonne</span>
          </p>
        )}
      </div>

      {/* Insights */}
      <div className="bg-gray-900 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3">AI Insights</h3>
        {insights.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No insights yet — configure sustainability targets and log some readings/metrics to see
            target-vs-actual comparisons here.
          </p>
        ) : (
          <ul className="space-y-2">
            {insights.map((insight, i) => {
              const Icon = SEVERITY_ICON[insight.severity] ?? Info;
              return (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <Icon size={14} className={`${SEVERITY_COLOR[insight.severity]} shrink-0 mt-0.5`} />
                  <span className="text-neutral-300">{insight.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Open environmental corrective actions */}
      <div className="bg-gray-900 border border-white/10 rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400" /> Open Environmental Actions
        </h3>
        {open_environmental_actions.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="No open environmental actions" description="Everything sourced from an environmental requirement breach is resolved." />
        ) : (
          <ul className="divide-y divide-white/5">
            {open_environmental_actions.map((action) => (
              <li key={action.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-200 truncate">{action.title}</p>
                  <p className="text-[11px] text-neutral-500">{action.status}{action.is_overdue ? " · Overdue" : ""}</p>
                </div>
                <Badge
                  label={action.priority}
                  className={
                    action.priority === "CRITICAL" || action.priority === "HIGH"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-neutral-700/40 text-neutral-400"
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className={`text-lg font-semibold ${highlight ? "text-blue-400" : "text-neutral-100"}`}>{value}</p>
    </div>
  );
}
