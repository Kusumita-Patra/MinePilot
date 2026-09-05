"use client";

import clsx from "clsx";
import { useTelemetry } from "@/lib/telemetryContext";
import MineDigitalTwinContainer from "@/app/dashboard/MineDigitalTwinContainer";

const RISK_STYLES: Record<string, string> = {
  NORMAL: "text-emerald-400",
  WARNING: "text-amber-400",
  CRITICAL: "text-red-400",
};

export default function MineViewPage() {
  const { sensors, setSelected, connected, usingMockData } = useTelemetry();
  const sensorList = Object.values(sensors).sort((a, b) => b.risk_score - a.risk_score);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">3D Mine View</h1>
        <span className="text-xs text-neutral-500">
          {connected ? "Live" : usingMockData ? "Demo data" : "Connecting…"} · {sensorList.length} sensors
        </span>
      </div>

      <MineDigitalTwinContainer>
        <div
          className="text-center px-6 cursor-pointer"
          onClick={() => sensorList[0] && setSelected(sensorList[0])}
        >
          <div className="text-5xl mb-3">🛰️</div>
          <p className="text-neutral-400 font-medium">3D Digital Twin Viewport</p>
          <p className="text-neutral-600 text-sm mt-1">
            Waiting for Team 1&apos;s &lt;MineDigitalTwin /&gt; component
          </p>
        </div>
      </MineDigitalTwinContainer>

      <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide">LIVE SENSOR FEED</p>
        </div>
        {sensorList.length === 0 ? (
          <p className="text-sm text-neutral-500 p-6 text-center">Waiting for telemetry…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] text-neutral-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Sensor</th>
                  <th className="px-4 py-3">Sector</th>
                  <th className="px-4 py-3">CH₄</th>
                  <th className="px-4 py-3">CO</th>
                  <th className="px-4 py-3">Dust</th>
                  <th className="px-4 py-3">Displacement</th>
                  <th className="px-4 py-3">Temp</th>
                  <th className="px-4 py-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {sensorList.map((s) => (
                  <tr
                    key={s.sensor_id}
                    onClick={() => setSelected(s)}
                    className="border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer"
                  >
                    <td className="px-4 py-3 font-medium">{s.sensor_id}</td>
                    <td className="px-4 py-3 text-neutral-400">{s.sector_id.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-neutral-400">{s.telemetry.ch4_pct}%</td>
                    <td className="px-4 py-3 text-neutral-400">{s.telemetry.co_ppm} ppm</td>
                    <td className="px-4 py-3 text-neutral-400">{s.telemetry.dust_pm10}</td>
                    <td className="px-4 py-3 text-neutral-400">{s.telemetry.displacement_mm} mm</td>
                    <td className="px-4 py-3 text-neutral-400">{s.telemetry.temp_c}°C</td>
                    <td className={clsx("px-4 py-3 font-medium", RISK_STYLES[s.risk_level])}>
                      {s.risk_score} · {s.risk_level}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
