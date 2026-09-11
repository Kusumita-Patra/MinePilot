"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { formatSectorId } from "@/lib/format";
import { getSensor, type SensorConfig } from "@/lib/sensorsApi";
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

const CALIBRATION_COLOR: Record<string, string> = {
  VALID: "text-emerald-400",
  DUE_SOON: "text-amber-400",
  OVERDUE: "text-red-400",
};

/** Sensor markers in the 3D twin render exclusively from live telemetry
 * (frozen SensorFrame contract, unchanged) — this drawer additionally fetches
 * the administrator-configured registry entry (if one exists for this
 * sensor_id) purely to display extra metadata alongside the live reading.
 * Read-only; no write path from here. A sensor with no registry entry yet
 * (404) still shows its live telemetry as before, just without this section. */
function useSensorConfig(sensorId: string | undefined) {
  const [config, setConfig] = useState<SensorConfig | null>(null);

  useEffect(() => {
    if (!sensorId) {
      const timer = setTimeout(() => setConfig(null), 0);
      return () => clearTimeout(timer);
    }
    let cancelled = false;
    getSensor(sensorId).then(
      (c) => {
        if (!cancelled) setConfig(c);
      },
      () => {
        if (!cancelled) setConfig(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [sensorId]);

  return config;
}

export default function TelemetryInspectorDrawer({ sensor, onClose }: Props) {
  const config = useSensorConfig(sensor?.sensor_id);

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

        {config && (
          <div className="border-t border-white/10 pt-4 space-y-2">
            <p className="text-xs font-semibold text-neutral-400 tracking-wide uppercase">
              Registry Information
            </p>
            <ConfigRow label="Type" value={config.sensor_type.replace(/_/g, " ")} />
            <ConfigRow label="Name" value={config.display_name} />
            {config.manufacturer && <ConfigRow label="Manufacturer" value={config.manufacturer} />}
            {(config.warning_threshold != null || config.critical_threshold != null) && (
              <ConfigRow
                label="Thresholds"
                value={`Warn ${config.warning_threshold ?? "—"} · Critical ${config.critical_threshold ?? "—"}`}
              />
            )}
            {config.calibration_status && (
              <ConfigRow
                label="Calibration"
                value={
                  <span className={CALIBRATION_COLOR[config.calibration_status]}>
                    {config.calibration_status.replace(/_/g, " ")}
                  </span>
                }
              />
            )}
            <p className="text-[10px] text-neutral-600">
              Configured by an administrator — read-only here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-200">{value}</span>
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