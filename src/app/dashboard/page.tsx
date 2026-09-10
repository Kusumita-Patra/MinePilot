"use client";

import { useMemo } from "react";
import { useTelemetry } from "@/lib/telemetryContext";
import { useActiveBlueprint } from "@/hooks/useBlueprint";
import KpiCards from "@/app/dashboard/KpiCards";
import MineDigitalTwinContainer from "@/app/dashboard/MineDigitalTwinContainer";
import AiRiskAnalysis from "@/app/dashboard/AiRiskAnalysis";
import RecentAlerts from "@/app/dashboard/RecentAlerts";
import AnalyticsSection from "@/app/dashboard/AnalyticsSection";
import QuickActions from "@/app/dashboard/QuickActions";
import IncidentSignOff from "@/app/dashboard/IncidentSignOff";
import MineDigitalTwin from "@/components/digital-twin";
import type { BlueprintTunnelSection } from "@/components/digital-twin";

// A blueprint image can be any pixel size; normalize it to roughly the same
// world-unit footprint the procedural fallback network already uses so the
// two are visually comparable regardless of the source image's resolution.
const BLUEPRINT_WORLD_SPAN = 500;

export default function DashboardPage() {
  const { sensors, selected, setSelected } = useTelemetry();
  const { blueprint } = useActiveBlueprint();

  const sensorList = Object.values(sensors);
  const avgRisk = sensorList.length
    ? Math.round(sensorList.reduce((a, s) => a + s.risk_score, 0) / sensorList.length)
    : 70;

  const blueprintSections = useMemo<BlueprintTunnelSection[]>(() => {
    if (!blueprint) return [];
    const scale = BLUEPRINT_WORLD_SPAN / Math.max(blueprint.image_width, blueprint.image_height);
    return blueprint.sections.map((section) => ({
      id: section.id,
      sectorId: section.sector_id,
      name: section.name,
      depth: section.depth,
      path: section.path.map(
        ([px, py]): [number, number] => [
          (px - blueprint.image_width / 2) * scale,
          (py - blueprint.image_height / 2) * scale,
        ]
      ),
    }));
  }, [blueprint]);

  return (
    <>
      <KpiCards />

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <MineDigitalTwinContainer>
            <MineDigitalTwin
              sensors={sensorList}
              blueprintSections={blueprintSections}
              selectedSensor={selected}
              onSelectSensor={setSelected}
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
