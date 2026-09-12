"use client";

import { useState } from "react";
import { AlertOctagon, PlayCircle } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import { formatSectorId } from "@/lib/format";
import { setWorkerStalled } from "@/lib/emergencyApi";
import { usePermissions } from "@/hooks/usePermissions";
import type { EvacuationRoute, WorkerPosition } from "../../../shared/types/emergency";

export default function WorkerInspectorDrawer({
  workerId,
  workerName,
  position,
  route,
  onClose,
  onChanged,
}: {
  workerId: string | null;
  workerName: string;
  position: WorkerPosition | null;
  route: EvacuationRoute | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { can } = usePermissions();
  const [busy, setBusy] = useState(false);
  const canSimulate = can("emergency.simulate");
  const isAdvancing =
    position && ["EVACUATION_ASSIGNED", "MOVING", "ROUTE_CHANGED", "DELAYED"].includes(position.status);

  async function toggleStall() {
    if (!workerId) return;
    setBusy(true);
    try {
      await setWorkerStalled(workerId, !position?.manual_stall);
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={!!workerId} onClose={onClose} title={workerId ? workerName : undefined} widthClassName="w-full max-w-md">
      {position && (
        <div className="space-y-4 text-sm">
          <div>
            <p className="text-xs text-neutral-500 mb-1">Status</p>
            <p className="font-medium">{position.status.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 mb-1">Sector</p>
            <p>{position.sector_id ? formatSectorId(position.sector_id) : "—"}</p>
          </div>
          {route ? (
            <>
              <div>
                <p className="text-xs text-neutral-500 mb-1">Evacuation reason</p>
                <p className="text-neutral-300">{route.reason}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-xs text-neutral-500">ETA</p>
                  <p className="font-medium">{route.eta_seconds}s</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Distance</p>
                  <p className="font-medium">{Math.round(route.total_distance)}m</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500">Safety score</p>
                  <p className="font-medium">{route.safety_score.toFixed(0)}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-neutral-500 mb-1">Route version</p>
                <p>v{route.route_version}</p>
              </div>
            </>
          ) : (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">
              No safe route currently assigned to this worker.
            </div>
          )}
          {canSimulate && isAdvancing && (
            <div className="pt-2 border-t border-white/10">
              <button
                disabled={busy}
                onClick={toggleStall}
                className={`w-full inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium disabled:opacity-40 ${
                  position.manual_stall
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-amber-600 hover:bg-amber-500"
                }`}
              >
                {position.manual_stall ? (
                  <>
                    <PlayCircle size={14} /> Resume Movement
                  </>
                ) : (
                  <>
                    <AlertOctagon size={14} /> Simulate "Worker Not Moving" (Demo)
                  </>
                )}
              </button>
              <p className="text-[10px] text-neutral-600 mt-1.5">
                DEMO ONLY — pauses this worker's SIMULATED movement so the DELAYED state can be demonstrated.
              </p>
            </div>
          )}

          <p className="text-[11px] text-neutral-600 pt-2 border-t border-white/10">
            Location is SIMULATED for this prototype — there is no real underground GPS hardware.
          </p>
        </div>
      )}
    </Drawer>
  );
}
