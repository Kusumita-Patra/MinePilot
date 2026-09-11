"use client";

import { useEffect, useState } from "react";
import { Layers, Gauge } from "lucide-react";
import { getMineStructure, type MineStructure } from "@/lib/api";
import EmptyState from "@/components/ui/EmptyState";

const ZONE_BADGE: Record<string, string> = {
  NORMAL: "bg-white/10 text-neutral-300",
  RESTRICTED: "bg-amber-500/15 text-amber-400",
  EMERGENCY: "bg-red-500/15 text-red-400",
  HIGH_RISK: "bg-red-500/15 text-red-400",
  WORK_ZONE: "bg-sky-500/15 text-sky-400",
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-emerald-500/15 text-emerald-400",
  CLOSED: "bg-neutral-500/15 text-neutral-400",
  UNDER_MAINTENANCE: "bg-amber-500/15 text-amber-400",
};

/** Derived entirely from the active blueprint's traced sections (grouped by
 * level_label) — not a separate mine_levels/mine_zones table, since that data
 * already exists on BlueprintSection. Edit zone_type/status/levels from the
 * Blueprint Configuration page; this is the read-optimized structural view. */
export default function AdminZonesPage() {
  const [structure, setStructure] = useState<MineStructure | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMineStructure()
      .then(setStructure)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load mine structure"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white">Mine Levels &amp; Zones</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          The mine&apos;s logical structure, derived from the active blueprint&apos;s traced sections — grouped by
          level. Configure names, zone types, and status from Mine Configuration → Blueprint.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {structure && structure.levels.length === 0 && (
        <EmptyState
          icon={Layers}
          title="No blueprint sections yet"
          description="Upload a blueprint and trace sections from Mine Configuration → Blueprint to see the mine's structure here."
        />
      )}

      {structure && structure.levels.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">
            {structure.blueprint_name} · {structure.levels.length} level{structure.levels.length === 1 ? "" : "s"}
          </p>
          {structure.levels.map((level) => (
            <div key={level.level_label} className="bg-gray-900 border border-white/10 rounded-xl p-4">
              <p className="text-sm font-semibold text-neutral-200 flex items-center gap-2 mb-2">
                <Layers size={14} className="text-amber-400" />
                {level.level_label}
                <span className="text-xs font-normal text-neutral-600">
                  ({level.sections.length} section{level.sections.length === 1 ? "" : "s"})
                </span>
              </p>
              <ul className="space-y-1.5">
                {level.sections.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 text-xs bg-white/5 rounded-md px-3 py-2"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <Gauge size={12} className="text-neutral-500 shrink-0" />
                      <span className="truncate text-neutral-200">{s.name}</span>
                      <span className="text-neutral-600 shrink-0">{s.sector_id.replace(/^sector_/, "").replace(/_/g, " ")}</span>
                      <span className="text-neutral-600 shrink-0">{s.depth}m</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ZONE_BADGE[s.zone_type] ?? ZONE_BADGE.NORMAL}`}>
                        {s.zone_type.replace(/_/g, " ")}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_BADGE[s.status] ?? STATUS_BADGE.ACTIVE}`}>
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
