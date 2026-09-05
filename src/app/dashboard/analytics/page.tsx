"use client";

import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import AnalyticsSection from "@/app/dashboard/AnalyticsSection";
import { useRiskRanking } from "@/hooks/useRiskRanking";
import { useTelemetryHistory } from "@/hooks/useTelemetryHistory";

export default function AnalyticsPage() {
  const { data: ranking } = useRiskRanking();
  // Derived, not synchronized via an effect: defaults to the top-ranked
  // sector until the user picks one explicitly.
  const [userSelected, setUserSelected] = useState<string | null>(null);
  const sectorId = userSelected ?? ranking[0]?.sector_id ?? null;

  const { points, loading } = useTelemetryHistory(sectorId, 100);

  const chartData = points.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    risk_score: p.risk_score,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Analytics</h1>

      <AnalyticsSection />

      <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide">
            SECTOR RISK HISTORY
          </p>
          {ranking.length > 0 && (
            <select
              value={sectorId ?? ""}
              onChange={(e) => setUserSelected(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-md text-xs px-2 py-1"
            >
              {ranking.map((r) => (
                <option key={r.sector_id} value={r.sector_id}>
                  {r.sector_id.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading && chartData.length === 0 ? (
          <p className="text-[11px] text-neutral-600 py-8 text-center">Loading history…</p>
        ) : chartData.length === 0 ? (
          <p className="text-[11px] text-neutral-600 py-8 text-center">
            No telemetry history recorded for this sector yet.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#737373" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#737373" }} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12 }}
                />
                <Line type="monotone" dataKey="risk_score" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
