"use client";

import { useState } from "react";
import { useTelemetryWebSocket } from "@/hooks/useTelemetryWebSocket";
import TelemetryInspectorDrawer from "@/components/TelemetryInspectorDrawer";
import type { SensorFrame } from "../../../shared/types/telemetry";

export default function DashboardPage() {
  const { sensors, connected, usingMockData } = useTelemetryWebSocket();
  const [selected, setSelected] = useState<SensorFrame | null>(null);

  const sensorList = Object.values(sensors);
  const critical = sensorList.filter((s) => s.risk_level === "CRITICAL").length;
  const warning = sensorList.filter((s) => s.risk_level === "WARNING").length;
  const normal = sensorList.filter((s) => s.risk_level === "NORMAL").length;
  const avgRisk = sensorList.length
    ? Math.round(sensorList.reduce((a, s) => a + s.risk_score, 0) / sensorList.length)
    : 0;

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Mine Manager Dashboard</h1>
        <span
          className={`text-xs px-3 py-1 rounded-full ${
            connected ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
          }`}
        >
          {connected ? "● Live" : usingMockData ? "● Mock Data" : "● Connecting..."}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Overall Risk Index" value={avgRisk} />
        <KpiCard label="Critical" value={critical} tone="text-red-500" />
        <KpiCard label="Warning" value={warning} tone="text-amber-400" />
        <KpiCard label="Normal" value={normal} tone="text-emerald-400" />
      </div>

      <div className="bg-white/5 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-neutral-400 text-left">
            <tr>
              <th className="p-3">Sensor</th>
              <th className="p-3">Sector</th>
              <th className="p-3">Risk Score</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {sensorList.map((s) => (
              <tr
                key={s.sensor_id}
                onClick={() => setSelected(s)}
                className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
              >
                <td className="p-3">{s.sensor_id}</td>
                <td className="p-3">{s.sector_id}</td>
                <td className="p-3">{Math.round(s.risk_score)}</td>
                <td className="p-3">{s.risk_level}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TelemetryInspectorDrawer sensor={selected} onClose={() => setSelected(null)} />
    </main>
  );
}

function KpiCard({
  label,
  value,
  tone = "text-white",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4">
      <p className="text-neutral-400 text-xs mb-1">{label}</p>
      <p className={`text-3xl font-bold ${tone}`}>{value}</p>
    </div>
  );
}