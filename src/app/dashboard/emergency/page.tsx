"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Siren, CheckCircle2, ArrowUpCircle, DoorOpen, ShieldCheck, XCircle } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmergencyWebSocket } from "@/hooks/useEmergencyWebSocket";
import {
  getEmergencyEvents,
  getEvacuationGraph,
  getEvacuationRoutes,
  getWorkerPositions,
  updateEmergencyEvent,
} from "@/lib/emergencyApi";
import { getUsers } from "@/lib/api";
import type { AuthUser } from "@/lib/authStore";
import type {
  EmergencyEvent,
  EvacuationEdge,
  EvacuationNode,
  EvacuationRoute,
  WorkerPosition,
} from "../../../../shared/types/emergency";
import EmergencyStatusBanner from "@/components/emergency/EmergencyStatusBanner";
import WorkerAccountabilityPanel from "@/components/emergency/WorkerAccountabilityPanel";
import SimulateEmergencyModal from "@/components/emergency/SimulateEmergencyModal";
import WorkerInspectorDrawer from "@/components/emergency/WorkerInspectorDrawer";
import SkeletonLoader from "@/components/ui/SkeletonLoader";
import EmptyState from "@/components/ui/EmptyState";
import { formatSectorId } from "@/lib/format";
import MineDigitalTwinContainer from "@/components/digital-twin/MineDigitalTwinContainer";
import MineDigitalTwin from "@/components/digital-twin";
import { DEFAULT_CAMERA_PRESET } from "@/components/digital-twin/sectors";
import type { CameraPresetId } from "@/components/digital-twin";
import { EmergencyTwinOverlay } from "@/components/digital-twin/emergency/EmergencyTwinOverlay";

const NON_TERMINAL = new Set(["DETECTED", "ACTIVE", "ACKNOWLEDGED", "ESCALATED", "EVACUATION_ACTIVE"]);
const KNOWN_SECTORS = ["sector_north_wall", "sector_south_face", "sector_shaft_b", "sector_conveyor_3"];

export default function EmergencyDashboardPage() {
  const { can, loading: permissionsLoading } = usePermissions();
  const [events, setEvents] = useState<EmergencyEvent[]>([]);
  const [positions, setPositions] = useState<WorkerPosition[]>([]);
  const [routes, setRoutes] = useState<EvacuationRoute[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [nodes, setNodes] = useState<EvacuationNode[]>([]);
  const [edges, setEdges] = useState<EvacuationEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>(DEFAULT_CAMERA_PRESET);

  const refresh = useCallback(async () => {
    try {
      const [eventsData, positionsData, usersData, graph] = await Promise.all([
        getEmergencyEvents(),
        getWorkerPositions(),
        getUsers().catch(() => [] as AuthUser[]),
        getEvacuationGraph().catch(() => ({ nodes: [], edges: [], exits: [] })),
      ]);
      setEvents(eventsData);
      setPositions(positionsData);
      setUsers(usersData);
      setNodes(graph.nodes);
      setEdges(graph.edges);

      const active = eventsData.find((e) => e.status === "EVACUATION_ACTIVE");
      if (active) {
        const routesData = await getEvacuationRoutes({ emergency_event_id: active.id });
        setRoutes(routesData.filter((r) => r.status === "ACTIVE"));
      } else {
        setRoutes([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load emergency data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEmergencyWebSocket(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const usersById = useMemo(() => Object.fromEntries(users.map((u) => [u.id, u])), [users]);
  const routesByWorker = useMemo(() => Object.fromEntries(routes.map((r) => [r.worker_id, r])), [routes]);
  const workerNameById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u.full_name])),
    [users]
  );
  const activeEvents = events.filter((e) => NON_TERMINAL.has(e.status));
  const recentHistory = events.filter((e) => !NON_TERMINAL.has(e.status)).slice(0, 8);
  const evacuationActive = activeEvents.some((e) => e.status === "EVACUATION_ACTIVE");
  const selectedWorkerPosition = positions.find((p) => p.worker_id === selectedWorkerId) ?? null;

  async function handleTransition(event: EmergencyEvent, status: string, extra?: Record<string, string>) {
    setBusyEventId(event.id);
    setError(null);
    try {
      await updateEmergencyEvent(event.id, { status: status as never, ...extra });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update emergency event");
    } finally {
      setBusyEventId(null);
    }
  }

  function actionsFor(event: EmergencyEvent) {
    const busy = busyEventId === event.id;
    const buttons: React.ReactNode[] = [];
    const btnClass =
      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed";

    if ((event.status === "ACTIVE" || event.status === "ESCALATED") && can("emergency.acknowledge")) {
      buttons.push(
        <button
          key="ack"
          disabled={busy}
          onClick={() => handleTransition(event, "ACKNOWLEDGED")}
          className={`${btnClass} bg-amber-600 hover:bg-amber-500`}
        >
          <CheckCircle2 size={14} /> Acknowledge
        </button>
      );
    }
    if (event.status === "ACTIVE" && can("emergency.escalate")) {
      buttons.push(
        <button
          key="esc"
          disabled={busy}
          onClick={() => handleTransition(event, "ESCALATED")}
          className={`${btnClass} bg-red-700 hover:bg-red-600`}
        >
          <ArrowUpCircle size={14} /> Escalate now
        </button>
      );
    }
    if ((event.status === "ACKNOWLEDGED" || event.status === "ESCALATED") && can("emergency.escalate")) {
      buttons.push(
        <button
          key="evac"
          disabled={busy}
          onClick={() => handleTransition(event, "EVACUATION_ACTIVE")}
          className={`${btnClass} bg-orange-600 hover:bg-orange-500`}
        >
          <DoorOpen size={14} /> Activate Evacuation
        </button>
      );
    }
    if (event.status === "EVACUATION_ACTIVE" && can("emergency.resolve")) {
      buttons.push(
        <button
          key="resolve"
          disabled={busy}
          onClick={() =>
            handleTransition(event, "RESOLVED", { resolution_notes: "Hazard cleared, all workers accounted for." })
          }
          className={`${btnClass} bg-emerald-600 hover:bg-emerald-500`}
        >
          <ShieldCheck size={14} /> All Clear / Resolve
        </button>
      );
    }
    if (NON_TERMINAL.has(event.status) && event.status !== "DETECTED" && can("emergency.resolve")) {
      buttons.push(
        <button
          key="cancel"
          disabled={busy}
          onClick={() => handleTransition(event, "CANCELLED", { cancel_reason: "False alarm / manually cancelled." })}
          className={`${btnClass} bg-slate-700 hover:bg-slate-600`}
        >
          <XCircle size={14} /> Cancel
        </button>
      );
    }
    return buttons.length ? buttons : null;
  }

  if (loading || permissionsLoading) {
    return (
      <div className="space-y-3">
        <SkeletonLoader className="h-24" />
        <SkeletonLoader className="h-48" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-semibold text-white flex items-center gap-2">
            <Siren size={18} /> Emergency Safety & Evacuation
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Detect → Decide → Alert → Escalate → Guide → Evacuate → Verify. Worker positions are SIMULATED — this
            prototype has no real underground GPS hardware.
          </p>
        </div>
        {can("emergency.simulate") && (
          <button
            onClick={() => setSimulateOpen(true)}
            className="bg-red-600/90 hover:bg-red-500 rounded-md px-3 py-2 text-xs font-semibold flex items-center gap-1.5"
          >
            <Siren size={14} /> Simulate Emergency (Demo)
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {activeEvents.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No active emergencies"
          description="Every monitored hazard channel is within normal limits."
        />
      ) : (
        <div className="space-y-3">
          {activeEvents.map((event) => (
            <EmergencyStatusBanner key={event.id} event={event} actions={actionsFor(event)} />
          ))}
        </div>
      )}

      {evacuationActive && (
        <>
          <WorkerAccountabilityPanel positions={positions} routesByWorker={routesByWorker} usersById={usersById} />

          <MineDigitalTwinContainer activePreset={cameraPreset} onSelectPreset={setCameraPreset}>
            <MineDigitalTwin cameraPreset={cameraPreset} onCameraPresetChange={setCameraPreset}>
              <EmergencyTwinOverlay
                nodes={nodes}
                edges={edges}
                positions={positions}
                routes={routes}
                workerNameById={workerNameById}
                onSelectWorker={setSelectedWorkerId}
              />
            </MineDigitalTwin>
          </MineDigitalTwinContainer>
        </>
      )}

      {recentHistory.length > 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-semibold">Recent Emergency History</p>
          </div>
          <div className="divide-y divide-white/5">
            {recentHistory.map((event) => (
              <div key={event.id} className="px-4 py-2.5 text-sm flex items-center justify-between gap-3 flex-wrap">
                <span className="text-neutral-300">
                  {event.hazard_type.replace(/_/g, " ")} — {formatSectorId(event.trigger_sector_id)}
                </span>
                <span
                  className={
                    event.status === "RESOLVED"
                      ? "text-emerald-400 text-xs"
                      : "text-neutral-500 text-xs"
                  }
                >
                  {event.status} · {new Date(event.updated_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <SimulateEmergencyModal
        open={simulateOpen}
        onClose={() => setSimulateOpen(false)}
        onSimulated={refresh}
        sectorOptions={KNOWN_SECTORS}
      />

      <WorkerInspectorDrawer
        workerId={selectedWorkerId}
        workerName={selectedWorkerId ? (workerNameById[selectedWorkerId] ?? selectedWorkerId.slice(0, 8)) : ""}
        position={selectedWorkerPosition}
        route={selectedWorkerId ? (routesByWorker[selectedWorkerId] ?? null) : null}
        onClose={() => setSelectedWorkerId(null)}
        onChanged={refresh}
      />
    </div>
  );
}
