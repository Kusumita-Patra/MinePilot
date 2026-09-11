"use client";

import { useState } from "react";
import { useActiveBlueprint, useBlueprintImageUrl } from "@/hooks/useBlueprint";
import { ActiveBlueprintSummary, UploadPanel, TracerPanel, BlueprintHistoryPanel } from "@/components/blueprint/BlueprintEditor";
import SensorPlacementPanel from "@/components/sensors/SensorPlacementPanel";
import Tabs from "@/components/ui/Tabs";

export default function AdminBlueprintPage() {
  const { blueprint, loading, error, refresh } = useActiveBlueprint();
  const imageUrl = useBlueprintImageUrl(blueprint?.id ?? null);
  const [tab, setTab] = useState<"sections" | "sensors">("sections");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Mine Blueprint &amp; Digital Twin Configuration</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Upload the mine&apos;s authoritative aerial/plan image, trace tunnel sections, and place sensors on
          it. This feeds the 3D Digital Twin on the Manager Dashboard directly. Administrators always have
          full access here; a mine manager only sees the tunnel-tracing editor on their own dashboard if
          granted the &quot;Upload / edit / delete blueprint &amp; sections&quot; capability from Roles &amp;
          Permissions — sensor placement is always administrator-only, not grantable.
        </p>
      </div>

      <ActiveBlueprintSummary blueprint={blueprint} />

      <UploadPanel hasExisting={!!blueprint} onUploaded={refresh} />

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {blueprint && (
        <>
          <Tabs
            tabs={[
              { id: "sections", label: "Tunnel Sections" },
              { id: "sensors", label: "Sensors" },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as "sections" | "sensors")}
          />

          {tab === "sections" ? (
            <TracerPanel
              blueprintId={blueprint.id}
              imageUrl={imageUrl}
              imageWidth={blueprint.image_width}
              imageHeight={blueprint.image_height}
              sections={blueprint.sections}
              onChanged={refresh}
            />
          ) : (
            <SensorPlacementPanel
              blueprintId={blueprint.id}
              imageUrl={imageUrl}
              imageWidth={blueprint.image_width}
              imageHeight={blueprint.image_height}
            />
          )}
        </>
      )}

      <BlueprintHistoryPanel />
    </div>
  );
}
