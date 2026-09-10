"use client";

import { useCallback, useMemo, useState } from "react";

import MineDigitalTwin from "@/components/digital-twin/MineDigitalTwin";
import { mockSensors } from "@/components/digital-twin/mockSensors";
import { getRiskColor, resolveRiskLevel } from "@/components/digital-twin/sensorUtils";
import { useMockTelemetry } from "@/components/digital-twin/useMockTelemetry";
import { useSectorStates } from "@/components/digital-twin/SensorMarkers";
import type { SensorData } from "@/components/digital-twin/types";

/**
 * Wiring example. Swap useMockTelemetry for useTelemetrySocket and nothing
 * else in this file changes — MineDigitalTwin owns the mine environment
 * (GLB model, or fallback terrain if none is present) internally.
 */
export default function DigitalTwinScreen() {
  const sensors = useMockTelemetry(mockSensors, { intervalMs: 1400 });

  // Track the id, not the object. Telemetry replaces sensor objects on every
  // update, so holding one would pin the detail panel to stale readings.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedSensor = useMemo(
    () => sensors.find((sensor) => sensor.sensor_id === selectedId) ?? null,
    [sensors, selectedId],
  );

  const handleSelect = useCallback((sensor: SensorData) => {
    setSelectedId((current) => (current === sensor.sensor_id ? null : sensor.sensor_id));
  }, []);

  const sectorStates = useSectorStates(sensors);
  const alarmingSectors = Object.values(sectorStates).filter(
    (state) => state.risk_level !== "NORMAL",
  );

  return (
    <main className="relative h-screen w-full bg-[#0a0d12] text-slate-200">
      <MineDigitalTwin
        className="absolute inset-0"
        sensors={sensors}
        selectedSensor={selectedSensor}
        onSelectSensor={handleSelect}
        canvasProps={{ style: { width: "100%", height: "100%" } }}
      />

      <header className="pointer-events-none absolute left-6 top-6 max-w-sm">
        <h1 className="text-lg font-semibold tracking-tight">Sensor layer</h1>
        <p className="mt-1 text-sm text-slate-400">
          {sensors.length} sensors reporting across {Object.keys(sectorStates).length} sectors
          {alarmingSectors.length > 0 && `, ${alarmingSectors.length} alarming`}.
          Hover a marker for a summary, click one to open its readings.
        </p>
      </header>

      <div className="pointer-events-none absolute bottom-6 left-6 flex gap-4 text-xs">
        {(["NORMAL", "WARNING", "CRITICAL"] as const).map((level) => (
          <span key={level} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: getRiskColor(level) }}
            />
            {level}
          </span>
        ))}
      </div>

      {selectedSensor && (
        <SensorDetailPanel sensor={selectedSensor} onClose={() => setSelectedId(null)} />
      )}
    </main>
  );
}

function SensorDetailPanel({
  sensor,
  onClose,
}: {
  sensor: SensorData;
  onClose: () => void;
}) {
  const riskLevel = resolveRiskLevel(sensor);
  const color = getRiskColor(riskLevel);

  const readings: [string, string][] = [
    ["Methane", `${sensor.telemetry.ch4_pct.toFixed(2)} %`],
    ["Carbon monoxide", `${sensor.telemetry.co_ppm.toFixed(1)} ppm`],
    ["Displacement", `${sensor.telemetry.displacement_mm.toFixed(2)} mm`],
    ["Temperature", `${sensor.telemetry.temp_c.toFixed(1)} °C`],
    ["Dust PM10", `${sensor.telemetry.dust_pm10.toFixed(1)} µg/m³`],
  ];

  return (
    <aside className="absolute right-6 top-6 w-80 rounded-lg border border-slate-700/70 bg-slate-950/90 p-5 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{sensor.sensor_id}</p>
          <p className="text-xs text-slate-400">{sensor.sector_id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200"
        >
          Close
        </button>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-semibold" style={{ color }}>
          {Math.round(sensor.risk_score)}
        </span>
        <span className="text-sm" style={{ color }}>
          {riskLevel}
        </span>
      </div>

      <dl className="mt-4 space-y-1.5 text-sm">
        {readings.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-400">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-xs text-slate-500">
        Updated {new Date(sensor.timestamp).toLocaleTimeString()}
        {sensor.historicalData?.length
          ? ` · ${sensor.historicalData.length} history points`
          : ""}
      </p>
    </aside>
  );
}
