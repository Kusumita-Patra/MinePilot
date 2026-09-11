"use client";

import { useActiveBlueprint, useBlueprintImageUrl } from "@/hooks/useBlueprint";
import { ActiveBlueprintSummary, UploadPanel, TracerPanel, BlueprintHistoryPanel } from "@/components/blueprint/BlueprintEditor";

export default function AdminBlueprintPage() {
  const { blueprint, loading, error, refresh } = useActiveBlueprint();
  const imageUrl = useBlueprintImageUrl(blueprint?.id ?? null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Mine Blueprint &amp; Digital Twin Configuration</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Upload the mine&apos;s authoritative aerial/plan image and trace each tunnel section on it. This feeds
          the 3D Digital Twin on the Manager Dashboard directly. Administrators always have full access here;
          a mine manager or field worker only sees this editor on their own dashboard if granted the
          &quot;Upload / edit / delete blueprint &amp; sections&quot; capability from Roles &amp; Permissions.
        </p>
      </div>

      <ActiveBlueprintSummary blueprint={blueprint} />

      <UploadPanel hasExisting={!!blueprint} onUploaded={refresh} />

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {blueprint && (
        <TracerPanel
          blueprintId={blueprint.id}
          imageUrl={imageUrl}
          imageWidth={blueprint.image_width}
          imageHeight={blueprint.image_height}
          sections={blueprint.sections}
          onChanged={refresh}
        />
      )}

      <BlueprintHistoryPanel />
    </div>
  );
}
