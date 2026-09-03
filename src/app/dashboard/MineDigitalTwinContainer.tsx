"use client";

import { useState } from "react";
import { RefreshCw, Crosshair, Layers } from "lucide-react";
import clsx from "clsx";

const LEVELS = ["Surface", "Level -1", "Level -2", "Level -3", "Level -4"];

const LEGEND = [
  { label: "Normal", color: "bg-emerald-400" },
  { label: "Warning", color: "bg-amber-400" },
  { label: "High Risk", color: "bg-red-500" },
  { label: "Restricted", color: "bg-neutral-500" },
];

export default function MineDigitalTwinContainer({ children }: { children: React.ReactNode }) {
  const [level, setLevel] = useState("Level -3");

  return (
    <div className="bg-neutral-900 border border-white/10 rounded-xl overflow-hidden flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide">
          3D UNDERGROUND MINE VIEW
        </p>
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
        {/* Level selector */}
        <div className="w-24 border-r border-white/10 flex flex-col p-2 gap-1 shrink-0">
          {LEVELS.map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l)}
              className={clsx(
                "text-[11px] px-2 py-1.5 rounded-md text-left transition-colors",
                level === l
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {l}
            </button>
          ))}
        </div>

        {/* === TEAM 1 INTEGRATION AREA — DO NOT MODIFY CONTENT === */}
        <div className="flex-1 relative flex items-center justify-center">
          {children}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-white/10 text-[11px] text-neutral-500">
        Click on any section to view detailed information
      </div>
    </div>
  );
}