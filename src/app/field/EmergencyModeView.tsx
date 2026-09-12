"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, DoorOpen, MapPin, RotateCcw } from "lucide-react";
import { useEmergencyWebSocket } from "@/hooks/useEmergencyWebSocket";
import { getEvacuationGraph, getMyEvacuationRoute, getMyWorkerPosition } from "@/lib/emergencyApi";
import type { EmergencyEvent, EvacuationNode, EvacuationRoute, WorkerPosition } from "../../../shared/types/emergency";
import { formatSectorId } from "@/lib/format";

export default function EmergencyModeView({ event }: { event: EmergencyEvent }) {
  const [route, setRoute] = useState<EvacuationRoute | null>(null);
  const [position, setPosition] = useState<WorkerPosition | null>(null);
  const [nodesById, setNodesById] = useState<Record<string, EvacuationNode>>({});
  const [routeChangedBanner, setRouteChangedBanner] = useState(false);
  const lastRouteVersion = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const [routeData, positionData] = await Promise.all([
      getMyEvacuationRoute().catch(() => null),
      getMyWorkerPosition().catch(() => null),
    ]);
    if (routeData && lastRouteVersion.current !== null && routeData.route_version > lastRouteVersion.current) {
      setRouteChangedBanner(true);
    }
    if (routeData) lastRouteVersion.current = routeData.route_version;
    setRoute(routeData);
    setPosition(positionData);
  }, []);

  useEffect(() => {
    refresh();
    getEvacuationGraph()
      .then((graph) => setNodesById(Object.fromEntries(graph.nodes.map((n) => [n.id, n]))))
      .catch(() => {});
  }, [refresh]);

  useEmergencyWebSocket(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const isEvacuating = event.status === "EVACUATION_ACTIVE";
  const safeAtExit = position?.status === "SAFE_AT_EXIT";
  const unaccounted = position?.status === "UNACCOUNTED";

  return (
    <main className="min-h-screen bg-red-950/20 text-white p-4 max-w-md mx-auto">
      <div className="rounded-lg border border-red-500/50 bg-red-950/60 p-4 mb-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle size={20} className="animate-pulse" />
          <p className="font-bold uppercase tracking-wide text-sm">
            {event.hazard_type.replace(/_/g, " ")} — {event.status.replace(/_/g, " ")}
          </p>
        </div>
        <p className="text-sm text-neutral-300 mt-1">
          Hazard reported in {formatSectorId(event.trigger_sector_id)}. Follow instructions below.
        </p>
      </div>

      {routeChangedBanner && (
        <div className="rounded-lg border border-amber-500/50 bg-amber-950/50 p-3 mb-4 flex items-center gap-2">
          <RotateCcw size={16} className="text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-400">ROUTE CHANGED</p>
            <p className="text-xs text-neutral-400">Your evacuation route was updated due to a new hazard.</p>
          </div>
          <button onClick={() => setRouteChangedBanner(false)} className="text-xs text-neutral-500">
            Dismiss
          </button>
        </div>
      )}

      {!isEvacuating && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-neutral-300">
          An emergency has been detected. Stay alert — you will be guided to evacuate if it escalates.
        </div>
      )}

      {isEvacuating && safeAtExit && (
        <div className="rounded-lg border border-emerald-500/50 bg-emerald-950/40 p-6 text-center">
          <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-2" />
          <p className="text-lg font-bold text-emerald-400">You have reached safety</p>
          <p className="text-sm text-neutral-400 mt-1">Report to your assembly point and await the all-clear.</p>
        </div>
      )}

      {isEvacuating && unaccounted && (
        <div className="rounded-lg border border-red-500/60 bg-red-950/50 p-6 text-center">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-2" />
          <p className="text-lg font-bold text-red-400">NO SAFE ROUTE FOUND</p>
          <p className="text-sm text-neutral-300 mt-1">
            The system could not find a safe path from your current location. This has been escalated — remain where
            you are, use a refuge chamber if available, and await rescue instructions.
          </p>
        </div>
      )}

      {isEvacuating && route && !safeAtExit && !unaccounted && (
        <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <DoorOpen size={16} className="text-blue-400" />
            <p className="text-sm font-semibold">Your Evacuation Route</p>
          </div>
          <p className="text-sm text-neutral-300">{route.reason}</p>
          <div className="flex items-center gap-4 text-xs text-neutral-400">
            <span>ETA: {route.eta_seconds}s</span>
            <span>Distance: {Math.round(route.total_distance)}m</span>
            <span>Safety score: {route.safety_score.toFixed(0)}</span>
          </div>
          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-neutral-500 mb-1.5">Route steps</p>
            <ol className="space-y-1">
              {route.node_path.map((nodeId, idx) => {
                const node = nodesById[nodeId];
                const isCurrent = position?.current_node_id === nodeId;
                return (
                  <li
                    key={nodeId}
                    className={`text-sm flex items-center gap-2 ${isCurrent ? "text-blue-400 font-medium" : "text-neutral-400"}`}
                  >
                    <MapPin size={12} />
                    {idx + 1}. {node?.label ?? formatSectorId(node?.sector_id ?? "")}
                    {isCurrent && <span className="text-[10px] text-blue-400">(you are here)</span>}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      <p className="text-[10px] text-neutral-600 mt-4 text-center">
        Your location is SIMULATED for this prototype — there is no real underground GPS hardware.
      </p>
    </main>
  );
}
