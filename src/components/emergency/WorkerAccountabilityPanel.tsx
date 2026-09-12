"use client";

import clsx from "clsx";
import { CheckCircle2, HelpCircle, Navigation, RotateCcw, UserRound } from "lucide-react";
import type { EvacuationRoute, WorkerEvacuationStatus, WorkerPosition } from "../../../shared/types/emergency";
import type { AuthUser } from "@/lib/authStore";
import { formatSectorId } from "@/lib/format";
import EmptyState from "@/components/ui/EmptyState";

const STATUS_BADGE: Record<WorkerEvacuationStatus, { className: string; icon: typeof UserRound }> = {
  NOT_AFFECTED: { className: "bg-slate-700/40 text-slate-300", icon: UserRound },
  EVACUATION_ASSIGNED: { className: "bg-blue-500/15 text-blue-400", icon: Navigation },
  MOVING: { className: "bg-blue-500/15 text-blue-400", icon: Navigation },
  DELAYED: { className: "bg-amber-500/15 text-amber-400", icon: HelpCircle },
  ROUTE_CHANGED: { className: "bg-amber-500/15 text-amber-400", icon: RotateCcw },
  SAFE_AT_EXIT: { className: "bg-emerald-500/15 text-emerald-400", icon: CheckCircle2 },
  UNACCOUNTED: { className: "bg-red-500/15 text-red-400", icon: HelpCircle },
  TRACKING_LOST: { className: "bg-red-500/15 text-red-400", icon: HelpCircle },
};

export default function WorkerAccountabilityPanel({
  positions,
  routesByWorker,
  usersById,
}: {
  positions: WorkerPosition[];
  routesByWorker: Record<string, EvacuationRoute>;
  usersById: Record<string, AuthUser>;
}) {
  const affected = positions.filter((p) => p.status !== "NOT_AFFECTED");
  const safe = affected.filter((p) => p.status === "SAFE_AT_EXIT").length;
  const unaccounted = affected.filter((p) => p.status === "UNACCOUNTED" || p.status === "TRACKING_LOST").length;

  if (affected.length === 0) {
    return (
      <EmptyState
        icon={UserRound}
        title="No workers affected"
        description="No evacuation is currently in progress — every field worker's position shows NOT_AFFECTED."
      />
    );
  }

  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold">Worker Accountability</p>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{safe} safe</span>
          <span className="text-neutral-500">/</span>
          <span className="text-neutral-300">{affected.length} affected</span>
          {unaccounted > 0 && <span className="text-red-400 font-semibold">{unaccounted} UNACCOUNTED</span>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500 text-xs border-b border-white/10">
              <th className="px-4 py-2 font-medium">Worker</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Sector</th>
              <th className="px-4 py-2 font-medium">Route</th>
              <th className="px-4 py-2 font-medium">ETA</th>
              <th className="px-4 py-2 font-medium">Safety</th>
            </tr>
          </thead>
          <tbody>
            {affected.map((position) => {
              const user = usersById[position.worker_id];
              const badge = STATUS_BADGE[position.status];
              const Icon = badge.icon;
              const route = routesByWorker[position.worker_id];
              return (
                <tr key={position.worker_id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-2.5">{user?.full_name ?? position.worker_id.slice(0, 8)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={clsx(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium",
                        badge.className
                      )}
                    >
                      <Icon size={11} />
                      {position.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400">
                    {position.sector_id ? formatSectorId(position.sector_id) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400 max-w-xs truncate" title={route?.reason}>
                    {route ? route.reason : "No safe route — see honest status above"}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400 tabular-nums">
                    {route ? `${route.eta_seconds}s (${Math.round(route.total_distance)}m)` : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400 tabular-nums">
                    {route ? route.safety_score.toFixed(0) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-neutral-600 border-t border-white/10">
        Worker location is SIMULATED for this prototype — there is no real underground GPS hardware.
      </p>
    </div>
  );
}
