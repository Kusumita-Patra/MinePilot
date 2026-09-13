"use client";

import { useMemo } from "react";
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
import type { BlueprintTunnelSection, SensorLocationMarker } from "@/components/digital-twin";

export default function DashboardPage() {
  const { sensors, selected, setSelected } = useTelemetry();
  const { blueprint } = useActiveBlueprint();
  const { sensors: sensorConfigs } = useSensorConfigs();

  const sensorList = Object.values(sensors);
  // Worst-case, not an average — every other aggregation in this app
  // (computeSectorStates, governance escalation) uses "worst sensor wins,
  // never downgrade." Averaging a CRITICAL sector together with calm ones
  // would dilute the headline into a falsely reassuring number, which is
  // the wrong failure mode for a safety alarm.
  const worstRisk = sensorList.length ? Math.max(...sensorList.map((s) => s.risk_score)) : 0;

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
          <MineDigitalTwinContainer>
            <MineDigitalTwin
              sensors={sensorList}
              blueprintSections={blueprintSections}
              sensorLocations={sensorLocations}
              selectedSensor={selected}
              onSelectSensor={setSelected}
            />
          </MineDigitalTwinContainer>
        </div>

        <AiRiskAnalysis
          sensors={sensorList}
          riskScore={worstRisk}
          selected={selected}
          onClearSelection={() => setSelected(null)}
          onFocusSensor={setSelected}
        />
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
