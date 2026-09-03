"use client";

import { useState } from "react";
import { useTelemetryWebSocket } from "@/hooks/useTelemetryWebSocket";

export default function FieldWorkerPage() {
  const { sensors } = useTelemetryWebSocket();
  const [remarks, setRemarks] = useState("");

  const alerts = Object.values(sensors).filter((s) => s.risk_level !== "NORMAL");

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">My Assigned Alerts</h1>

      <div className="space-y-3">
        {alerts.length === 0 && (
          <p className="text-neutral-500 text-sm">No active alerts assigned.</p>
        )}
        {alerts.map((s) => (
          <div
            key={s.sensor_id}
            className={`rounded-lg p-4 border ${
              s.risk_level === "CRITICAL"
                ? "border-red-500/40 bg-red-500/10"
                : "border-amber-400/40 bg-amber-400/10"
            }`}
          >
            <p className="font-semibold">{s.sensor_id}</p>
            <p className="text-sm text-neutral-400">{s.sector_id}</p>
            <p className="text-sm mt-1">Risk: {Math.round(s.risk_score)} ({s.risk_level})</p>

            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Verification notes..."
              className="w-full mt-3 rounded-md bg-black/30 border border-white/10 p-2 text-sm"
              rows={2}
            />

            <div className="flex gap-2 mt-3">
              <button className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-md py-2 text-sm font-medium">
                Mark Resolved
              </button>
              {s.risk_level === "CRITICAL" && (
                <button className="flex-1 bg-red-600 hover:bg-red-500 rounded-md py-2 text-sm font-medium">
                  Escalate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}