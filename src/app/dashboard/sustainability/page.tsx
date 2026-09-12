"use client";

import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import Tabs from "@/components/ui/Tabs";
import SustainabilityOverviewPanel from "@/components/sustainability/SustainabilityOverviewPanel";
import WaterMetricsPanel from "@/components/sustainability/WaterMetricsPanel";
import EnvironmentalRequirementsPanel from "@/components/sustainability/EnvironmentalRequirementsPanel";
import CorrectiveActionsPanel from "@/components/sustainability/CorrectiveActionsPanel";
import SustainabilityTargetsPanel from "@/components/sustainability/SustainabilityTargetsPanel";

type TabId = "overview" | "water" | "environment" | "actions" | "targets";

export default function SustainabilityPage() {
  const { can, loading } = usePermissions();
  const [tab, setTab] = useState<TabId>("overview");

  if (loading) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Sustainability</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Environmental compliance, water sustainability, corrective actions, and an explainable
          sustainability score — every number here is labeled with where it came from (measured, manual,
          simulated, or calculated).
        </p>
      </div>

      <Tabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "water", label: "Water" },
          { id: "environment", label: "Environment" },
          { id: "actions", label: "Corrective Actions" },
          { id: "targets", label: "Targets" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as TabId)}
      />

      {tab === "overview" && <SustainabilityOverviewPanel />}
      {tab === "water" && <WaterMetricsPanel />}
      {tab === "environment" && <EnvironmentalRequirementsPanel canEdit={can("governance.edit")} />}
      {tab === "actions" && <CorrectiveActionsPanel canManage={can("corrective_actions.manage")} />}
      {tab === "targets" && <SustainabilityTargetsPanel canEdit={can("governance.edit")} />}
    </div>
  );
}
