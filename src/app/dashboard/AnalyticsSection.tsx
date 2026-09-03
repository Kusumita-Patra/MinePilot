"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const COMPLIANCE = [
  { label: "Safety Compliance", value: 95 },
  { label: "Environment Compliance", value: 91 },
  { label: "Labour Compliance", value: 93 },
  { label: "Statutory Compliance", value: 97 },
  { label: "Production Compliance", value: 89 },
];

const RANKING = [
  { name: "Raniganj Mine", score: 87 },
  { name: "Jharia Mine", score: 62 },
  { name: "Durgapur Mine", score: 38 },
  { name: "Asansol Mine", score: 25 },
  { name: "Kusmi Mine", score: 18 },
];

const INSPECTIONS = [
  { name: "Completed", value: 32, color: "#10b981" },
  { name: "In Progress", value: 10, color: "#3b82f6" },
  { name: "Scheduled", value: 6, color: "#f59e0b" },
];

function riskTone(score: number) {
  if (score >= 75) return "bg-red-500";
  if (score >= 40) return "bg-amber-400";
  return "bg-emerald-400";
}

export default function AnalyticsSection() {
  const total = INSPECTIONS.reduce((a, b) => a + b.value, 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Compliance Overview */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide">COMPLIANCE OVERVIEW</p>
          <button className="text-[11px] text-blue-400 hover:underline">View All</button>
        </div>
        <div className="space-y-3">
          {COMPLIANCE.map((c) => (
            <div key={c.label}>
              <div className="flex justify-between text-[11px] text-neutral-400 mb-1">
                <span>{c.label}</span>
                <span>{c.value}%</span>
              </div>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${c.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mine Risk Ranking */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">MINE RISK RANKING</p>
        <div className="space-y-3">
          {RANKING.map((r, i) => (
            <div key={r.name} className="flex items-center gap-3">
              <span className="text-[11px] text-neutral-500 w-4">{i + 1}</span>
              <span className="text-xs flex-1 truncate">{r.name}</span>
              <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${riskTone(r.score)}`} style={{ width: `${r.score}%` }} />
              </div>
              <span className="text-xs font-medium w-6 text-right">{r.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Inspections Donut */}
      <div className="bg-neutral-900 border border-white/10 rounded-xl p-4">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide mb-3">INSPECTIONS (THIS MONTH)</p>
        <div className="flex items-center gap-4">
          <div className="w-28 h-28 relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={INSPECTIONS}
                  dataKey="value"
                  innerRadius={32}
                  outerRadius={48}
                  stroke="none"
                >
                  {INSPECTIONS.map((entry, i) => (
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
            {INSPECTIONS.map((i) => (
              <div key={i.name} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: i.color }} />
                <span className="text-neutral-400">{i.name}</span>
                <span className="font-medium ml-auto">
                  {i.value} ({Math.round((i.value / total) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}