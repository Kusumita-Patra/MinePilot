"use client";

import { Skull, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { useIncidents } from "@/hooks/useIncidents";

const LEVEL_STYLES: Record<string, { icon: typeof Skull; color: string; bg: string }> = {
  CRITICAL: { icon: Skull, color: "text-red-500", bg: "bg-red-500/10" },
  WARNING: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatSector(sectorId: string) {
  return sectorId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function RecentAlerts() {
  const { incidents } = useIncidents();
  const recent = incidents.slice(0, 6);

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-neutral-300 tracking-wide">RECENT ALERTS</p>
        <span className="text-[11px] text-neutral-500">{incidents.length} total</span>
      </div>
      <div className="space-y-1">
        {recent.length === 0 && (
          <p className="text-[11px] text-neutral-600 px-2 py-3">No active hazard alerts.</p>
        )}
        {recent.map((inc) => {
          const style = LEVEL_STYLES[inc.severity] ?? LEVEL_STYLES.WARNING;
          const Icon = style.icon;
          return (
            <div
              key={inc.ticket_id}
              className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 text-left transition-colors"
            >
              <div
                className={clsx(
                  "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                  style.bg
                )}
              >
                <Icon size={14} className={style.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">
                  {inc.ticket_id} · {inc.sensor_id}
                </p>
                <p className="text-[11px] text-neutral-500 truncate">
                  {formatSector(inc.sector_id)} · risk {inc.risk_score} · {inc.status}
                </p>
              </div>
              <span className="text-[10px] text-neutral-600 shrink-0">
                {formatTime(inc.created_at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}