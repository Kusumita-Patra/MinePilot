"use client";

import { useMemo, useState } from "react";
import { useTelemetry } from "@/lib/telemetryContext";
import { useActiveBlueprint } from "@/hooks/useBlueprint";
import { useSensorConfigs } from "@/hooks/useSensors";
import { pixelToWorldXZ } from "@/lib/blueprintCoords";
import KpiCards from "@/app/dashboard/KpiCards";
import MineDigitalTwinContainer from "@/components/digital-twin/MineDigitalTwinContainer";
import AiRiskAnalysis from "@/app/dashboard/AiRiskAnalysis";
import RecentAlerts from "@/app/dashboard/RecentAlerts";
import AnalyticsSection from "@/app/dashboard/AnalyticsSection";
import QuickActions from "@/app/dashboard/QuickActions";
import IncidentSignOff from "@/app/dashboard/IncidentSignOff";
import MineDigitalTwin from "@/components/digital-twin";
import { DEFAULT_CAMERA_PRESET } from "@/components/digital-twin/sectors";
import type { BlueprintTunnelSection, CameraPresetId, SensorLocationMarker } from "@/components/digital-twin";

export default function DashboardPage() {
  const { sensors, selected, setSelected } = useTelemetry();
  const { blueprint } = useActiveBlueprint();
  const { sensors: sensorConfigs } = useSensorConfigs();
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>(DEFAULT_CAMERA_PRESET);

  const sensorList = Object.values(sensors);
  const avgRisk = sensorList.length
    ? Math.round(sensorList.reduce((a, s) => a + s.risk_score, 0) / sensorList.length)
    : 70;

  const blueprintSections = useMemo<BlueprintTunnelSection[]>(() => {
    if (!blueprint) return [];
    return blueprint.sections.map((section) => ({
      id: section.id,
      sectorId: section.sector_id,
      name: section.name,
      depth: section.depth,
      path: section.path.map(([px, py]) => pixelToWorldXZ(px, py, blueprint.image_width, blueprint.image_height)),
    }));
  }, [blueprint]);

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
    <>
      <KpiCards />

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <MineDigitalTwinContainer activePreset={cameraPreset} onSelectPreset={setCameraPreset}>
            <MineDigitalTwin
              sensors={sensorList}
              blueprintSections={blueprintSections}
              sensorLocations={sensorLocations}
              selectedSensor={selected}
              onSelectSensor={setSelected}
              cameraPreset={cameraPreset}
              onCameraPresetChange={setCameraPreset}
            />
          </MineDigitalTwinContainer>
        </div>

        <AiRiskAnalysis riskScore={avgRisk} />
      </div>

      <AnalyticsSection />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentAlerts />
        <QuickActions />
        <IncidentSignOff />
      </div>
    </>
  );
}
