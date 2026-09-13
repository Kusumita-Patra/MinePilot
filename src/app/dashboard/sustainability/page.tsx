"use client";

import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import Tabs from "@/components/ui/Tabs";
import SustainabilityOverviewPanel from "@/components/sustainability/SustainabilityOverviewPanel";
import WaterMetricsPanel from "@/components/sustainability/WaterMetricsPanel";
import EnergyMetricsPanel from "@/components/sustainability/EnergyMetricsPanel";
import WasteMetricsPanel from "@/components/sustainability/WasteMetricsPanel";
import LandMetricsPanel from "@/components/sustainability/LandMetricsPanel";
import EnvironmentalRequirementsPanel from "@/components/sustainability/EnvironmentalRequirementsPanel";
import CorrectiveActionsPanel from "@/components/sustainability/CorrectiveActionsPanel";
import SustainabilityTargetsPanel from "@/components/sustainability/SustainabilityTargetsPanel";
import SustainabilitySimulatorPanel from "@/components/sustainability/SustainabilitySimulatorPanel";
import MineDigitalTwinContainer from "@/components/digital-twin/MineDigitalTwinContainer";
import MineDigitalTwin from "@/components/digital-twin";
import { DEFAULT_CAMERA_PRESET } from "@/components/digital-twin/sectors";
import type { CameraPresetId } from "@/components/digital-twin";
import { SustainabilityTwinOverlay } from "@/components/digital-twin/sustainability/SustainabilityTwinOverlay";

type TabId = "overview" | "water" | "energy" | "waste" | "land" | "environment" | "actions" | "targets" | "twin";

export default function SustainabilityPage() {
  const { can, loading } = usePermissions();
  const [tab, setTab] = useState<TabId>("overview");
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>(DEFAULT_CAMERA_PRESET);

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Sustainability</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Water, energy, waste, land and environmental compliance, corrective actions, and an explainable
          sustainability score — every number here is labeled with where it came from (measured, manual,
          simulated, or calculated).
        </p>
      </div>

      {tab === "overview" && can("sustainability.simulate") && <SustainabilitySimulatorPanel />}

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "water", label: "Water" },
          { id: "energy", label: "Energy" },
          { id: "waste", label: "Waste" },
          { id: "land", label: "Land" },
          { id: "environment", label: "Environment" },
          { id: "actions", label: "Corrective Actions" },
          { id: "targets", label: "Targets" },
          { id: "twin", label: "3D View" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "overview" && <SustainabilityOverviewPanel />}
      {tab === "water" && <WaterMetricsPanel />}
      {tab === "energy" && <EnergyMetricsPanel />}
      {tab === "waste" && <WasteMetricsPanel />}
      {tab === "land" && <LandMetricsPanel />}
      {tab === "environment" && <EnvironmentalRequirementsPanel canEdit={can("governance.edit")} />}
      {tab === "actions" && <CorrectiveActionsPanel canManage={can("corrective_actions.manage")} />}
      {tab === "targets" && <SustainabilityTargetsPanel canEdit={can("governance.edit")} />}
      {tab === "twin" && (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">
            Sector-level Energy/Waste/Land markers and environmental sensor readings layered onto the mine&apos;s 3D
            digital twin. Hover a marker for its latest value. Markers only appear where real data exists.
          </p>
          <MineDigitalTwinContainer activePreset={cameraPreset} onSelectPreset={setCameraPreset}>
            <MineDigitalTwin cameraPreset={cameraPreset} onCameraPresetChange={setCameraPreset}>
              <SustainabilityTwinOverlay />
            </MineDigitalTwin>
          </MineDigitalTwinContainer>
        </div>
      )}
    </div>
  );
}
