"use client";

// ============================================================================
// digital-twin/MineViewPanel.tsx
//
// The full "3D Mine View" page content (live telemetry header, the 3D twin
// itself, and the live sensor feed table) — extracted out of
// dashboard/mine-view/page.tsx so it can be reused as-is by the
// Administrator's own 3D Mine View page (/admin/mine/view). Requires a
// TelemetryProvider ancestor (useTelemetry()); the manager dashboard already
// has one from dashboard/layout.tsx, the admin page wraps its own.
// ============================================================================

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useTelemetry } from "@/lib/telemetryContext";
import { useActiveBlueprint } from "@/hooks/useBlueprint";
import { useSensorConfigs } from "@/hooks/useSensors";
import { pixelToWorldXZ } from "@/lib/blueprintCoords";
import MineDigitalTwinContainer from "./MineDigitalTwinContainer";
import MineDigitalTwin from "./index";
import { DEFAULT_CAMERA_PRESET } from "./sectors";
import type { CameraPresetId, SensorLocationMarker } from "./types";
import { formatSectorId } from "@/lib/format";

const RISK_STYLES: Record<string, string> = {
  NORMAL: "text-emerald-400",
  WARNING: "text-amber-400",
  CRITICAL: "text-red-400",
};

export default function MineViewPanel() {
  const { sensors, selected, setSelected, connected, usingMockData } = useTelemetry();
  const { blueprint } = useActiveBlueprint();
  const { sensors: sensorConfigs } = useSensorConfigs();
  const sensorList = Object.values(sensors).sort((a, b) => b.risk_score - a.risk_score);

  // Controlled camera preset, shared between the container's left-side level
  // selector and the 3D twin's own top-right preset buttons, so either one
  // flying the camera keeps the other's highlighted state in sync.
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>(DEFAULT_CAMERA_PRESET);

  const sensorLocations = useMemo<SensorLocationMarker[]>(() => {
    if (!blueprint) return [];
    return sensorConfigs
      .filter((s) => s.blueprint_id === blueprint.id)
      .map((s) => {
        const [x, z] = pixelToWorldXZ(s.pixel_x, s.pixel_y, blueprint.image_width, blueprint.image_height);
        return {
          id: s.id,
          sensorId: s.sensor_id,
          displayName: s.display_name,
          sensorType: s.sensor_type,
          status: s.status,
          isReporting: s.is_reporting,
          position: [x, s.depth, z] as [number, number, number],
        };
      });
  }, [blueprint, sensorConfigs]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">3D Mine View</h1>
        <span className="text-xs text-neutral-500">
          {connected ? "Live" : usingMockData ? "Demo data" : "Connecting…"} · {sensorList.length} sensors
        </span>
      </div>

      <MineDigitalTwinContainer activePreset={cameraPreset} onSelectPreset={setCameraPreset}>
        <MineDigitalTwin
          sensors={sensorList}
          sensorLocations={sensorLocations}
          selectedSensor={selected}
          onSelectSensor={setSelected}
          cameraPreset={cameraPreset}
          onCameraPresetChange={setCameraPreset}
        />
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
                    className={clsx(
                      "border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer",
                      selected?.sensor_id === s.sensor_id && "bg-white/5"
                    )}
                  >
                    <td className="px-4 py-3 font-medium">{s.sensor_id}</td>
                    <td className="px-4 py-3 text-neutral-400">{formatSectorId(s.sector_id)}</td>
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
