"use client";

import { X } from "lucide-react";
import clsx from "clsx";
import { formatSectorId } from "@/lib/format";
import type { SensorFrame } from "../../shared/types/telemetry";

interface Props {
  sensor: SensorFrame | null;
  onClose: () => void;
}

const riskColor: Record<string, string> = {
  NORMAL: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10",
  WARNING: "text-amber-400 border-amber-400/40 bg-amber-400/10",
  CRITICAL: "text-red-500 border-red-500/40 bg-red-500/10",
};

export default function TelemetryInspectorDrawer({ sensor, onClose }: Props) {
  if (!sensor) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-neutral-900/95 backdrop-blur-xl border-l border-white/10 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div>
          <h2 className="text-white font-semibold">{sensor.sensor_id}</h2>
          <p className="text-neutral-400 text-sm">{formatSectorId(sensor.sector_id)}</p>
        </div>
        <button onClick={onClose} className="text-neutral-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        <div
          className={clsx(
            "rounded-lg border px-4 py-3 font-medium",
            riskColor[sensor.risk_level]
          )}
        >
          Risk Score: {Math.round(sensor.risk_score)} — {sensor.risk_level}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Metric label="CH₄" value={`${sensor.telemetry.ch4_pct}%`} />
          <Metric label="CO" value={`${sensor.telemetry.co_ppm} ppm`} />
          <Metric label="Displacement" value={`${sensor.telemetry.displacement_mm} mm`} />
          <Metric label="Temp" value={`${sensor.telemetry.temp_c}°C`} />
          <Metric label="Dust (PM10)" value={`${sensor.telemetry.dust_pm10}`} />
        </div>

        <p className="text-xs text-neutral-500">
          Last updated: {new Date(sensor.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <p className="text-neutral-400 text-xs">{label}</p>
      <p className="text-white text-lg font-semibold">{value}</p>
    </div>
  );
}