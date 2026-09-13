"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { UploadCloud, Trash2, Undo2, XCircle, History } from "lucide-react";
import clsx from "clsx";
import {
  createBlueprintSection,
  deleteBlueprintSection,
  updateBlueprintSection,
  getBlueprintHistory,
  readImageDimensions,
  uploadBlueprint,
  type BlueprintHistoryItem,
  type BlueprintSection,
  type BlueprintSectorId,
  type BlueprintZoneType,
  type BlueprintSectionStatus,
} from "@/lib/blueprintApi";

/** Shared by /admin/mine/blueprint (always the full editor, administrator's
 * own portal) and /dashboard/blueprint (the full editor only when the
 * current user has been granted the `blueprint.write` capability — see
 * usePermissions — otherwise the read-only viewer). Keeping one editor
 * implementation means a permission grant/revoke just changes which UI a
 * role sees, never two different codepaths that can drift apart. */

export const SECTOR_OPTIONS: { id: BlueprintSectorId; label: string; color: string }[] = [
  { id: "sector_north_wall", label: "North Section", color: "#38d6ff" },
  { id: "sector_shaft_b", label: "Deep Shaft B", color: "#a855f7" },
  { id: "sector_conveyor_3", label: "Surface Conveyor", color: "#f97316" },
  { id: "sector_south_face", label: "Main Tunnel Network", color: "#22c55e" },
];

const ZONE_TYPE_OPTIONS: BlueprintZoneType[] = ["NORMAL", "RESTRICTED", "EMERGENCY", "HIGH_RISK", "WORK_ZONE"];
const SECTION_STATUS_OPTIONS: BlueprintSectionStatus[] = ["ACTIVE", "CLOSED", "UNDER_MAINTENANCE"];

export const sectorColor = (id: BlueprintSectorId) => SECTOR_OPTIONS.find((s) => s.id === id)?.color ?? "#38d6ff";

export function ActiveBlueprintSummary({
  blueprint,
}: {
  blueprint: { name: string; original_filename: string; uploaded_by: string; created_at: string; sections: BlueprintSection[] } | null;
}) {
  if (!blueprint) {
    return (
      <div className="bg-gray-900 border border-white/10 rounded-xl p-4 text-sm text-neutral-500">
        No blueprint uploaded yet.
      </div>
    );
  }
  const levelCount = new Set(blueprint.sections.map((s) => s.level_label)).size;
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      <SummaryStat label="Active Blueprint" value={blueprint.name} />
      <SummaryStat label="Source File" value={blueprint.original_filename} />
      <SummaryStat label="Sections" value={String(blueprint.sections.length)} />
      <SummaryStat label="Levels" value={String(levelCount)} />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-600 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-neutral-200 truncate mt-0.5">{value}</p>
    </div>
  );
}

export function UploadPanel({ hasExisting, onUploaded }: { hasExisting: boolean; onUploaded: () => void }) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { width, height } = await readImageDimensions(file);
      await uploadBlueprint({ file, name: name.trim(), width, height });
      setName("");
      setFile(null);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">
        {hasExisting ? "Upload new version" : "Upload a blueprint"}
      </p>
      {hasExisting && (
        <p className="text-[11px] text-neutral-500">
          Uploading creates a new version and immediately becomes the active blueprint (most-recent-upload =
          active). The previous version is kept in history below, not deleted.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="Blueprint name (e.g. Raniganj Level -1 Plan)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 min-w-[220px] bg-neutral-900/70 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
        />
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm text-neutral-400 file:mr-3 file:py-2 file:px-3 file:rounded-md file:border-0 file:bg-white/10 file:text-neutral-200 file:text-sm hover:file:bg-white/20"
        />
        <button
          type="button"
          disabled={!file || !name.trim() || busy}
          onClick={handleUpload}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white transition-colors"
        >
          <UploadCloud size={14} />
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function TracerPanel({
  blueprintId,
  imageUrl,
  imageWidth,
  imageHeight,
  sections,
  onChanged,
}: {
  blueprintId: string;
  imageUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  sections: BlueprintSection[];
  onChanged: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [sectorId, setSectorId] = useState<BlueprintSectorId>("sector_north_wall");
  const [name, setName] = useState("");
  const [levelLabel, setLevelLabel] = useState("Level -1");
  const [depth, setDepth] = useState("-15");
  const [zoneType, setZoneType] = useState<BlueprintZoneType>("NORMAL");
  const [status, setStatus] = useState<BlueprintSectionStatus>("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const startDrawing = () => {
    setDrawing(true);
    setPoints([]);
    setError(null);
  };

  const cancelDrawing = () => {
    setDrawing(false);
    setPoints([]);
  };

  const handleImageClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!drawing || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * imageWidth;
    const y = ((e.clientY - rect.top) / rect.height) * imageHeight;
    setPoints((prev) => [...prev, [Math.round(x), Math.round(y)]]);
  };

  const undoPoint = () => setPoints((prev) => prev.slice(0, -1));

  const saveSection = async () => {
    const depthNum = Number(depth);
    if (points.length < 2 || !name.trim() || Number.isNaN(depthNum)) return;
    setSaving(true);
    setError(null);
    try {
      await createBlueprintSection(blueprintId, {
        sector_id: sectorId,
        name: name.trim(),
        level_label: levelLabel.trim() || "Level",
        depth: depthNum,
        path: points,
        zone_type: zoneType,
        status,
      });
      setPoints([]);
      setDrawing(false);
      setName("");
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save section");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (sectionId: string) => {
    try {
      await deleteBlueprintSection(blueprintId, sectionId);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete section");
    }
  };

  const handleQuickUpdate = async (sectionId: string, patch: Partial<{ zone_type: BlueprintZoneType; status: BlueprintSectionStatus }>) => {
    setEditingId(sectionId);
    try {
      await updateBlueprintSection(blueprintId, sectionId, patch);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update section");
    } finally {
      setEditingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      <div className="bg-gray-900 border border-white/10 rounded-xl p-3">
        {imageUrl ? (
          <div className="relative w-full" style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Mine blueprint" className="absolute inset-0 w-full h-full object-contain" />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${imageWidth} ${imageHeight}`}
              className={clsx("absolute inset-0 w-full h-full", drawing ? "cursor-crosshair" : "cursor-default")}
              onClick={handleImageClick}
            >
              {sections.map((s) => (
                <polyline
                  key={s.id}
                  points={s.path.map(([x, y]) => `${x},${y}`).join(" ")}
                  fill="none"
                  stroke={sectorColor(s.sector_id)}
                  strokeWidth={Math.max(imageWidth, imageHeight) / 250}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.85}
                />
              ))}
              {points.length > 0 && (
                <>
                  <polyline
                    points={points.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="none"
                    stroke={sectorColor(sectorId)}
                    strokeWidth={Math.max(imageWidth, imageHeight) / 200}
                    strokeDasharray={`${Math.max(imageWidth, imageHeight) / 120} ${
                      Math.max(imageWidth, imageHeight) / 240
                    }`}
                    strokeLinecap="round"
                  />
                  {points.map(([x, y], i) => (
                    <circle key={i} cx={x} cy={y} r={Math.max(imageWidth, imageHeight) / 220} fill="#fff" />
                  ))}
                </>
              )}
            </svg>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 text-neutral-600 py-24">
            <p className="text-sm">Blueprint image unavailable.</p>
            <p className="text-xs max-w-sm text-center">
              The stored image file couldn&apos;t be loaded (local disk storage doesn&apos;t survive every
              redeploy). Upload a new version above to restore tracing — existing sections are listed and
              still editable on the right.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">Trace a tunnel</p>

          {!drawing ? (
            <button
              type="button"
              disabled={!imageUrl}
              onClick={startDrawing}
              title={imageUrl ? undefined : "Upload a blueprint image first"}
              className="w-full px-3 py-2 rounded-md text-sm font-medium bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 text-white transition-colors"
            >
              Start new section
            </button>
          ) : (
            <>
              <p className="text-[11px] text-neutral-500">
                Click points on the image to draw the tunnel&apos;s path ({points.length} point
                {points.length === 1 ? "" : "s"}).
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={undoPoint}
                  disabled={points.length === 0}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-white/10 text-neutral-300 hover:bg-white/5 disabled:opacity-40"
                >
                  <Undo2 size={12} /> Undo point
                </button>
                <button
                  type="button"
                  onClick={cancelDrawing}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-white/10 text-neutral-300 hover:bg-white/5"
                >
                  <XCircle size={12} /> Cancel
                </button>
              </div>

              <label className="block text-xs text-neutral-400">
                Section name (shown on click in the 3D view)
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. North Trunk"
                  className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-500"
                />
              </label>

              <label className="block text-xs text-neutral-400">
                Broad section category
                <select
                  value={sectorId}
                  onChange={(e) => setSectorId(e.target.value as BlueprintSectorId)}
                  className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                >
                  {SECTOR_OPTIONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-2">
                <label className="block text-xs text-neutral-400 flex-1">
                  Level label
                  <input
                    type="text"
                    value={levelLabel}
                    onChange={(e) => setLevelLabel(e.target.value)}
                    className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </label>
                <label className="block text-xs text-neutral-400 w-24">
                  Depth (m)
                  <input
                    type="number"
                    value={depth}
                    onChange={(e) => setDepth(e.target.value)}
                    className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </label>
              </div>

              <div className="flex gap-2">
                <label className="block text-xs text-neutral-400 flex-1">
                  Zone type
                  <select
                    value={zoneType}
                    onChange={(e) => setZoneType(e.target.value as BlueprintZoneType)}
                    className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {ZONE_TYPE_OPTIONS.map((z) => (
                      <option key={z} value={z}>
                        {z.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-neutral-400 flex-1">
                  Status
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as BlueprintSectionStatus)}
                    className="mt-1 w-full bg-neutral-900/70 border border-white/10 rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {SECTION_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                type="button"
                disabled={points.length < 2 || !name.trim() || saving}
                onClick={saveSection}
                className="w-full px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white transition-colors"
              >
                {saving ? "Saving…" : "Save section"}
              </button>
            </>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase">
            Traced sections ({sections.length})
          </p>
          {sections.length === 0 ? (
            <p className="text-xs text-neutral-600">None yet — trace one on the left.</p>
          ) : (
            <ul className="space-y-1.5">
              {sections.map((s) => (
                <li key={s.id} className="text-xs bg-white/5 rounded-md px-2.5 py-1.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: sectorColor(s.sector_id) }}
                      />
                      <span className="truncate text-neutral-200">{s.name}</span>
                      <span className="text-neutral-600 shrink-0">{s.level_label}</span>
                    </span>
                    <button
                      type="button"
                      aria-label={`Delete ${s.name}`}
                      onClick={() => handleDelete(s.id)}
                      className="text-neutral-500 hover:text-red-400 shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={s.zone_type}
                      disabled={editingId === s.id}
                      onChange={(e) => handleQuickUpdate(s.id, { zone_type: e.target.value as BlueprintZoneType })}
                      className="bg-neutral-900/70 border border-white/10 rounded px-1.5 py-1 text-[10px] text-neutral-300 focus:outline-none focus:border-amber-500"
                    >
                      {ZONE_TYPE_OPTIONS.map((z) => (
                        <option key={z} value={z}>
                          {z.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <select
                      value={s.status}
                      disabled={editingId === s.id}
                      onChange={(e) => handleQuickUpdate(s.id, { status: e.target.value as BlueprintSectionStatus })}
                      className="bg-neutral-900/70 border border-white/10 rounded px-1.5 py-1 text-[10px] text-neutral-300 focus:outline-none focus:border-amber-500"
                    >
                      {SECTION_STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function BlueprintHistoryPanel() {
  const [history, setHistory] = useState<BlueprintHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      getBlueprintHistory()
        .then((items) => setHistory([...items].reverse()))
        .catch((e) => setError(e instanceof Error ? e.message : "Failed to load history"));
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold text-neutral-300 tracking-wide uppercase flex items-center gap-1.5">
        <History size={13} />
        Blueprint History
      </p>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {history.length === 0 && !error && <p className="text-xs text-neutral-600">No uploads yet.</p>}
      <ul className="divide-y divide-white/5">
        {history.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div>
              <p className="text-neutral-200">
                {item.name} <span className="text-neutral-600">v{item.version}</span>
              </p>
              <p className="text-xs text-neutral-500">
                Uploaded by {item.uploaded_by_name} · {new Date(item.created_at).toLocaleDateString()} ·{" "}
                {item.section_count} section{item.section_count === 1 ? "" : "s"}
              </p>
            </div>
            <span
              className={clsx(
                "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
                item.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-neutral-500/15 text-neutral-400"
              )}
            >
              {item.is_active ? "Active" : "Archived"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
