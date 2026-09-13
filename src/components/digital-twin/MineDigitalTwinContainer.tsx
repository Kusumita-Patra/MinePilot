"use client";

import { RefreshCw, Crosshair, Layers, X } from "lucide-react";
import clsx from "clsx";
import { useTelemetry } from "@/lib/telemetryContext";
import { formatSectorId } from "@/lib/format";
import type { CameraPresetId } from "./types";

// Each level maps to the camera preset that actually frames that depth —
// there is no independent per-level filtering of the 3D scene, so "showing
// a level" means flying the camera to look at it. Matches the real depths
// in mineLayout.ts's LEVELS constant (surface=0, level1=north section,
// level2=main network, level3=shaft sump) — there is no "Level -4" in the
// mine model, so it was dropped rather than wired to a preset that doesn't
// represent anything real.
const LEVELS: { label: string; preset: CameraPresetId }[] = [
  { label: "Surface", preset: "surfaceConveyor" },
  { label: "Level -1", preset: "northWall" },
  { label: "Level -2", preset: "mainPit" },
  { label: "Level -3", preset: "deepShaftB" },
];

// bg-sky-400 for Normal matches riskColors.ts's RISK_COLOR.NORMAL (#2f7dff,
// blue) — the single source of truth for the 3-color risk language used by
// the tunnel tinting and sensor markers, so the legend agrees with what's
// actually drawn in the 3D view.
const LEGEND = [
  { label: "Normal", color: "bg-sky-400" },
  { label: "Warning", color: "bg-amber-400" },
  { label: "High Risk", color: "bg-red-500" },
  { label: "Restricted", color: "bg-neutral-500" },
];

export default function MineDigitalTwinContainer({
  children,
  activePreset,
  onSelectPreset,
}: {
  children: React.ReactNode;
  /** Currently active camera preset, so the matching level button highlights
   * even when the preset was reached via the 3D view's own top-right buttons. */
  activePreset?: CameraPresetId;
  /** Fired when a level button is clicked — the caller is expected to feed
   * this straight into <MineDigitalTwin cameraPreset={...}>. */
  onSelectPreset: (preset: CameraPresetId) => void;
}) {
  const { selected, setSelected, connected, usingMockData } = useTelemetry();

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-neutral-300 tracking-wide">
            3D UNDERGROUND MINE VIEW
          </p>
          <span
            className={clsx(
              "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium",
              connected
                ? "bg-emerald-400/10 text-emerald-400"
                : usingMockData
                ? "bg-amber-400/10 text-amber-400"
                : "bg-white/5 text-neutral-500"
            )}
            title={
              connected
                ? "Connected to the live telemetry stream"
                : usingMockData
                ? "Backend/simulator unreachable — showing simulated demo data, not real sensor readings"
                : "Connecting to the live telemetry stream…"
            }
          >
            <span
              className={clsx(
                "w-1.5 h-1.5 rounded-full",
                connected ? "bg-emerald-400" : usingMockData ? "bg-amber-400" : "bg-neutral-500 animate-pulse"
              )}
            />
            {connected ? "Live" : usingMockData ? "Demo Data" : "Connecting…"}
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-neutral-400">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={clsx("w-2 h-2 rounded-full", l.color)} />
              {l.label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-neutral-400">
          <button className="hover:text-white"><RefreshCw size={14} /></button>
          <button className="hover:text-white"><Crosshair size={14} /></button>
          <button className="hover:text-white"><Layers size={14} /></button>
        </div>
      </div>

      <div className="flex flex-1 min-h-[460px]">
        {/* Level selector — each button flies the camera to the preset that
            actually frames that depth (see LEVELS above). */}
        <div className="w-24 border-r border-white/10 flex flex-col p-2 gap-1 shrink-0">
          {LEVELS.map(({ label, preset }) => (
            <button
              key={label}
              onClick={() => onSelectPreset(preset)}
              className={clsx(
                "text-[11px] px-2 py-1.5 rounded-md text-left transition-colors",
                activePreset === preset
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* === TEAM 1 INTEGRATION AREA — DO NOT MODIFY CONTENT === */}
        <div className="flex-1 relative flex items-center justify-center">
          {children}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-white/10 text-[11px] text-neutral-500 flex items-center justify-between gap-2">
        {selected ? (
          <>
            <span>
              Focused on <span className="text-blue-400 font-medium">{formatSectorId(selected.sector_id)}</span> —
              AI Risk Analysis and Sector Risk Ranking are filtered to match.
            </span>
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors shrink-0"
            >
              Clear <X size={11} />
            </button>
          </>
        ) : (
          <span>Click on any sensor to focus this sector across the dashboard</span>
        )}
      </div>
    </div>
  );
}
