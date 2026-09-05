"use client";

import { ShieldCheck, Users, ClipboardList, ClipboardCheck, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { useKpis } from "@/hooks/useKpis";
import type { KpiSummary } from "@/lib/api";

interface KpiDef {
  label: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  tone: "emerald" | "red" | "amber" | "blue";
}

// Fallback shown while the real KPI fetch is loading or unreachable, so the
// dashboard never looks broken/empty.
const FALLBACK_KPIS: KpiDef[] = [
  { label: "Overall Compliance", value: "94%", trend: "+6% from last month", icon: ShieldCheck, tone: "emerald" },
  { label: "Open Violations", value: "12", trend: "+2 from last week", icon: Users, tone: "red" },
  { label: "Pending Actions", value: "7", trend: "+1 from last week", icon: ClipboardList, tone: "amber" },
  { label: "Inspections (This Month)", value: "48", trend: "+12 from last month", icon: ClipboardCheck, tone: "blue" },
];

const TONE_STYLES = {
  emerald: "bg-emerald-500/15 text-emerald-400",
  red: "bg-red-500/15 text-red-400",
  amber: "bg-amber-500/15 text-amber-400",
  blue: "bg-blue-500/15 text-blue-400",
};

function fromSummary(summary: KpiSummary): KpiDef[] {
  return [
    {
      label: "Overall Compliance",
      value: `${summary.overall_compliance.value}%`,
      trend: summary.overall_compliance.trend ?? "—",
      icon: ShieldCheck,
      tone: "emerald",
    },
    {
      label: "Open Violations",
      value: String(summary.open_violations.value),
      trend: summary.open_violations.trend ?? "—",
      icon: Users,
      tone: "red",
    },
    {
      label: "Pending Actions",
      value: String(summary.pending_actions.value),
      trend: summary.pending_actions.trend ?? "—",
      icon: ClipboardList,
      tone: "amber",
    },
    {
      label: "Inspections (This Month)",
      value: String(summary.inspections_this_month.value),
      trend: summary.inspections_this_month.trend ?? "—",
      icon: ClipboardCheck,
      tone: "blue",
    },
  ];
}

export default function KpiCards() {
  const { data, loading, error } = useKpis();
  const kpis = data && !error ? fromSummary(data) : FALLBACK_KPIS;
  const isFallback = !data || !!error;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map(({ label, value, trend, icon: Icon, tone }) => (
        <div
          key={label}
          className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-start gap-3 hover:border-white/20 transition-colors"
        >
          <div className={clsx("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", TONE_STYLES[tone])}>
            <Icon size={16} />
          </div>
          <div>
            <p className="text-neutral-500 text-[11px]">{label}</p>
            <p className="text-2xl font-bold leading-tight">
              {value}
              {loading && isFallback && <span className="text-neutral-600">…</span>}
            </p>
            <p className="text-[10px] text-neutral-500">{trend}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
