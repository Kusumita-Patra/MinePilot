import { apiFetch } from "./api";
import type {
  EmergencyEvent,
  EmergencyEventStatus,
  EmergencyRule,
  EvacuationExit,
  EvacuationRoute,
  GraphSnapshot,
  HazardType,
  WorkerPosition,
} from "../../shared/types/emergency";

export async function getEmergencyEvents(filters?: {
  status?: EmergencyEventStatus;
  hazard_type?: HazardType;
}): Promise<EmergencyEvent[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.hazard_type) params.set("hazard_type", filters.hazard_type);
  const qs = params.toString();
  return apiFetch<EmergencyEvent[]>(`/api/emergency/events${qs ? `?${qs}` : ""}`);
}

export async function getEmergencyEvent(id: string): Promise<EmergencyEvent> {
  return apiFetch<EmergencyEvent>(`/api/emergency/events/${id}`);
}

export async function updateEmergencyEvent(
  id: string,
  payload: { status: EmergencyEventStatus; resolution_notes?: string; cancel_reason?: string }
): Promise<EmergencyEvent> {
  return apiFetch<EmergencyEvent>(`/api/emergency/events/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function simulateEmergencyEvent(payload: {
  hazard_type: HazardType;
  sector_id: string;
  sensor_id?: string;
  value: number;
}): Promise<EmergencyEvent> {
  return apiFetch<EmergencyEvent>("/api/emergency/events/simulate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getEmergencyRules(): Promise<EmergencyRule[]> {
  return apiFetch<EmergencyRule[]>("/api/emergency/rules");
}

export async function updateEmergencyRule(
  id: string,
  payload: Partial<{
    warning_threshold: number;
    critical_threshold: number;
    unit: string;
    escalation_timeout_seconds: number;
    is_active: boolean;
  }>
): Promise<EmergencyRule> {
  return apiFetch<EmergencyRule>(`/api/emergency/rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getEvacuationGraph(): Promise<GraphSnapshot> {
  return apiFetch<GraphSnapshot>("/api/emergency/graph");
}

export async function createEvacuationExit(payload: {
  node_id: string;
  name: string;
  sector_id: string;
  capacity_note?: string;
}): Promise<EvacuationExit> {
  return apiFetch<EvacuationExit>("/api/emergency/exits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateEvacuationExit(
  id: string,
  payload: Partial<{ name: string; is_active: boolean; capacity_note: string }>
): Promise<EvacuationExit> {
  return apiFetch<EvacuationExit>(`/api/emergency/exits/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteEvacuationExit(id: string): Promise<void> {
  await apiFetch<void>(`/api/emergency/exits/${id}`, { method: "DELETE" });
}

export async function blockEvacuationEdge(id: string, blocked: boolean, reason?: string) {
  return apiFetch(`/api/emergency/edges/${id}/block`, {
    method: "PATCH",
    body: JSON.stringify({ blocked, reason }),
  });
}

export async function getEvacuationRoutes(filters?: {
  emergency_event_id?: string;
  worker_id?: string;
}): Promise<EvacuationRoute[]> {
  const params = new URLSearchParams();
  if (filters?.emergency_event_id) params.set("emergency_event_id", filters.emergency_event_id);
  if (filters?.worker_id) params.set("worker_id", filters.worker_id);
  const qs = params.toString();
  return apiFetch<EvacuationRoute[]>(`/api/emergency/routes${qs ? `?${qs}` : ""}`);
}

export async function getMyEvacuationRoute(): Promise<EvacuationRoute | null> {
  return apiFetch<EvacuationRoute | null>("/api/emergency/routes/mine");
}

export async function getWorkerPositions(): Promise<WorkerPosition[]> {
  return apiFetch<WorkerPosition[]>("/api/emergency/workers/positions");
}

export async function getMyWorkerPosition(): Promise<WorkerPosition | null> {
  return apiFetch<WorkerPosition | null>("/api/emergency/workers/positions/me");
}

export async function advanceSimulatedWorkerPositions(): Promise<WorkerPosition[]> {
  return apiFetch<WorkerPosition[]>("/api/emergency/workers/positions/simulate/advance", { method: "POST" });
}

export async function setWorkerStalled(workerId: string, stalled: boolean): Promise<WorkerPosition> {
  return apiFetch<WorkerPosition>(`/api/emergency/workers/positions/${workerId}/simulate/stall`, {
    method: "PATCH",
    body: JSON.stringify({ stalled }),
  });
}
