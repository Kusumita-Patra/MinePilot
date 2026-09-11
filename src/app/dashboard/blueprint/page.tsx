"use client";

import { useActiveBlueprint, useBlueprintImageUrl } from "@/hooks/useBlueprint";
import { usePermissions } from "@/hooks/usePermissions";
import type { BlueprintSectorId } from "@/lib/blueprintApi";
import { ActiveBlueprintSummary, UploadPanel, TracerPanel, BlueprintHistoryPanel, sectorColor } from "@/components/blueprint/BlueprintEditor";
import { ImageOff } from "lucide-react";

const ZONE_BADGE: Record<string, string> = {
  NORMAL: "bg-white/10 text-neutral-300",
  RESTRICTED: "bg-amber-500/15 text-amber-400",
  EMERGENCY: "bg-red-500/15 text-red-400",
  HIGH_RISK: "bg-red-500/15 text-red-400",
  WORK_ZONE: "bg-sky-500/15 text-sky-400",
};

export default function BlueprintPage() {
  const { blueprint, loading, error, refresh } = useActiveBlueprint();
  const imageUrl = useBlueprintImageUrl(blueprint?.id ?? null);
  const { can, loading: permissionsLoading } = usePermissions();

  if (permissionsLoading) {
    return <p className="text-sm text-neutral-500">Loading…</p>;
  }

  return can("blueprint.write") ? (
    <EditableBlueprint
      blueprint={blueprint}
      imageUrl={imageUrl}
      loading={loading}
      error={error}
      refresh={refresh}
    />
  ) : (
    <ReadOnlyBlueprint blueprint={blueprint} imageUrl={imageUrl} loading={loading} error={error} />
  );
}

function EditableBlueprint({
  blueprint,
  imageUrl,
  loading,
  error,
  refresh,
}: {
  blueprint: ReturnType<typeof useActiveBlueprint>["blueprint"];
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Mine Blueprint</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          You&apos;ve been granted blueprint editing access by an administrator — upload, trace, and manage
          sections directly from here. Changes feed the 3D Digital Twin immediately.
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

/** Read-only for mine_manager/field_worker without the blueprint.write
 * capability — this page only ever calls GET endpoints in that case,
 * matching what the backend actually permits. */
function ReadOnlyBlueprint({
  blueprint,
  imageUrl,
  loading,
  error,
}: {
  blueprint: ReturnType<typeof useActiveBlueprint>["blueprint"];
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Mine Blueprint</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Read-only view of the mine&apos;s authoritative blueprint and traced tunnel sections, as configured by
          an administrator. This is what feeds the 3D Digital Twin.
        </p>
      </div>

      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && !error && !blueprint && (
        <div className="bg-gray-900 border border-white/10 rounded-xl p-6 text-sm text-neutral-500">
          No blueprint has been uploaded yet. An administrator can upload one from the Admin Console.
        </div>
      )}

      {blueprint && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          <div className="bg-gray-900 border border-white/10 rounded-xl p-3">
            {imageUrl ? (
              <div className="relative w-full" style={{ aspectRatio: `${blueprint.image_width} / ${blueprint.image_height}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Mine blueprint" className="absolute inset-0 w-full h-full object-contain" />
                <svg
                  viewBox={`0 0 ${blueprint.image_width} ${blueprint.image_height}`}
                  className="absolute inset-0 w-full h-full"
                >
                  {blueprint.sections.map((s) => (
                    <polyline
                      key={s.id}
                      points={s.path.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill="none"
                      stroke={sectorColor(s.sector_id as BlueprintSectorId)}
                      strokeWidth={Math.max(blueprint.image_width, blueprint.image_height) / 250}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.85}
                    />
                  ))}
                </svg>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-neutral-600 py-16">
                <ImageOff size={28} />
                <p className="text-xs">Blueprint image unavailable — the section list below is still current.</p>
              </div>
            )}
          </div>

          <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">
              Traced sections ({blueprint.sections.length})
            </p>
            {blueprint.sections.length === 0 ? (
              <p className="text-xs text-neutral-600">None traced yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {blueprint.sections.map((s) => (
                  <li key={s.id} className="text-xs bg-white/5 rounded-md px-2.5 py-1.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: sectorColor(s.sector_id as BlueprintSectorId) }}
                        />
                        <span className="truncate text-neutral-200">{s.name}</span>
                      </span>
                      <span className="text-neutral-600 shrink-0">{s.level_label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ZONE_BADGE[s.zone_type] ?? ZONE_BADGE.NORMAL}`}>
                        {s.zone_type.replace(/_/g, " ")}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/5 text-neutral-400">
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
