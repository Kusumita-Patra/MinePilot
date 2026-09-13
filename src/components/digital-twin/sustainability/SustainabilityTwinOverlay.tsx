"use client";

// ============================================================================
// digital-twin/sustainability/SustainabilityTwinOverlay.tsx
//
// Additive 3D overlay for the P3 Sustainability milestone (Energy/Waste/Land
// + environmental sensors), passed as `children` into <MineDigitalTwin> the
// same way EmergencyTwinOverlay is — no changes to MineTerrain.tsx or the
// procedural network.
//
// There is no real polygon geometry for sector boundaries in this codebase
// (confirmed: sectors.ts only carries id/name/description, camera-preset
// targets are the only per-sector 3D points defined anywhere), so this
// renders one marker cluster per sector at that sector's own camera-preset
// target — the same point already used to frame that sector on screen —
// rather than inventing a second, uncalibrated coordinate system.
// ============================================================================

import { memo, useEffect, useState } from "react";
import { SustainabilityMarker } from "./SustainabilityMarker";
import { cameraPresets } from "../sectors";
import {
  getEnergySummary,
  getEnvironmentalReadings,
  getLandSummary,
  getWasteSummary,
  type EnergySummary,
  type LandSummary,
  type WasteSummary,
} from "@/lib/sustainabilityApi";
import { getSensors, type SensorConfig } from "@/lib/sensorsApi";

const SECTORS = ["sector_north_wall", "sector_shaft_b", "sector_conveyor_3", "sector_south_face"] as const;

// Reuses the exact anchor point already used to frame each sector on camera
// — see the module docstring above for why no separate coordinate exists.
// Markers below only add a small (+1) Y offset on top of this anchor —
// mineLayout.ts's tunnel cross-section radius is as tight as 3 in places
// (SHAFT.lowerRadius), so a larger lift (an earlier version used +7/+12)
// pushes a marker's center above/outside the tube entirely, which read as
// the marker floating outside the tunnel rather than inside it.
const SECTOR_ANCHOR: Record<(typeof SECTORS)[number], [number, number, number]> = {
  sector_north_wall: cameraPresets.northWall.target,
  sector_shaft_b: cameraPresets.deepShaftB.target,
  sector_conveyor_3: cameraPresets.surfaceConveyor.target,
  sector_south_face: cameraPresets.mainPit.target,
};

// Spec §39-40 color language: energy blue/cyan, waste orange/yellow, land
// green. Deliberately distinct from riskColors.ts's NORMAL/WARNING/CRITICAL
// palette (#2f7dff/#ffd400/#ff3b30) so a sustainability marker is never
// mistaken for a safety risk indicator at a glance.
const ENERGY_COLOR = "#38bdf8";
const WASTE_COLOR = "#f59e0b";
const LAND_COLOR = "#22c55e";
const ENV_SENSOR_COLOR = "#a78bfa";

const REFRESH_MS = 20000;

interface SectorData {
  energy: EnergySummary | null;
  waste: WasteSummary | null;
  land: LandSummary | null;
}

export const SustainabilityTwinOverlay = memo(function SustainabilityTwinOverlay() {
  const [dataBySector, setDataBySector] = useState<Record<string, SectorData>>({});
  const [envSensors, setEnvSensors] = useState<(SensorConfig & { latestValue: number | null; latestUnit: string | null })[]>(
    []
  );

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const results = await Promise.all(
        SECTORS.map(async (sectorId) => {
          const [energy, waste, land] = await Promise.all([
            getEnergySummary(sectorId).catch(() => null),
            getWasteSummary(sectorId).catch(() => null),
            getLandSummary(sectorId).catch(() => null),
          ]);
          return [sectorId, { energy, waste, land }] as const;
        })
      );
      if (cancelled) return;
      setDataBySector(Object.fromEntries(results));

      const sensors = await getSensors().catch(() => [] as SensorConfig[]);
      const envTypes = new Set(["PM10", "PM2_5", "SO2", "NOX", "WATER_FLOW"]);
      const envOnly = sensors.filter((s) => envTypes.has(s.sensor_type));
      const withReadings = await Promise.all(
        envOnly.map(async (s) => {
          const readings = await getEnvironmentalReadings({ sensor_config_id: s.id, limit: 1 }).catch(() => []);
          return { ...s, latestValue: readings[0]?.value ?? null, latestUnit: readings[0]?.unit ?? null };
        })
      );
      if (cancelled) return;
      setEnvSensors(withReadings);
    };

    refresh();
    const interval = setInterval(refresh, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <group name="sustainability-twin-overlay">
      {SECTORS.map((sectorId) => {
        const anchor = SECTOR_ANCHOR[sectorId];
        const data = dataBySector[sectorId];
        if (!data) return null;

        return (
          <group key={sectorId}>
            {data.energy && data.energy.data_source && (
              <SustainabilityMarker
                id={`${sectorId}:energy`}
                position={[anchor[0] - 4, anchor[1] + 1, anchor[2]]}
                color={ENERGY_COLOR}
                label="Energy"
                detail={
                  data.energy.energy_intensity_kwh_per_tonne !== null
                    ? `${data.energy.energy_intensity_kwh_per_tonne} kWh/t`
                    : `${Math.round(data.energy.electricity_kwh).toLocaleString()} kWh`
                }
              />
            )}
            {data.waste && data.waste.data_source && (
              <SustainabilityMarker
                id={`${sectorId}:waste`}
                position={[anchor[0], anchor[1] + 1, anchor[2]]}
                color={WASTE_COLOR}
                label="Waste"
                detail={
                  data.waste.diversion_rate_pct !== null
                    ? `${data.waste.diversion_rate_pct}% diverted`
                    : `${data.waste.total_waste_tonnes.toFixed(0)} t total`
                }
              />
            )}
            {data.land && data.land.data_source && (
              <SustainabilityMarker
                id={`${sectorId}:land`}
                position={[anchor[0] + 4, anchor[1] + 1, anchor[2]]}
                color={LAND_COLOR}
                label="Land"
                detail={
                  data.land.reclamation_rate_pct !== null
                    ? `${data.land.reclamation_rate_pct}% reclaimed`
                    : `${data.land.total_disturbed_area_ha.toFixed(0)} ha disturbed`
                }
              />
            )}
          </group>
        );
      })}

      {envSensors.map((sensor, i) => {
        const anchor = SECTOR_ANCHOR[sensor.sector_id as (typeof SECTORS)[number]] ?? [0, 0, 0];
        return (
          <SustainabilityMarker
            key={sensor.id}
            id={`env:${sensor.sensor_id}`}
            position={[anchor[0] + (i % 2 === 0 ? -7 : 7), anchor[1] + 1, anchor[2] + 3]}
            color={ENV_SENSOR_COLOR}
            label={sensor.display_name}
            detail={sensor.latestValue !== null ? `${sensor.latestValue} ${sensor.latestUnit ?? ""}` : "No readings yet"}
            radius={1}
          />
        );
      })}
    </group>
  );
});
