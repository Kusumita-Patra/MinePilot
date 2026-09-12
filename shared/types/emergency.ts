// Shared Emergency Safety & Evacuation types — matches backend/app/schemas/emergency.py
// Worker location is SIMULATED only (no real underground GPS hardware exists).
// Alarm/notification state derived here is a virtual/digital signal, not real siren hardware.

import type { RiskLevel } from "./telemetry";

export type HazardType =
  | "METHANE"
  | "CARBON_MONOXIDE"
  | "FIRE"
  | "FLOOD"
  | "ROCKFALL"
  | "EQUIPMENT_FAILURE"
  | "OTHER";

export type EmergencyEventStatus =
  | "DETECTED"
  | "ACTIVE"
  | "ACKNOWLEDGED"
  | "ESCALATED"
  | "EVACUATION_ACTIVE"
  | "RESOLVED"
  | "CANCELLED";

export interface EmergencyEvent {
  id: string;
  hazard_type: HazardType;
  severity: RiskLevel;
  status: EmergencyEventStatus;
  trigger_sector_id: string;
  trigger_sensor_id: string | null;
  trigger_value: number | null;
  trigger_incident_ticket_id: string | null;
  escalation_timeout_seconds: number;
  activated_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  escalated_at: string | null;
  escalated_reason: string | null;
  evacuation_started_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmergencyRule {
  id: string;
  hazard_type: HazardType;
  display_name: string;
  warning_threshold: number | null;
  critical_threshold: number | null;
  unit: string | null;
  escalation_timeout_seconds: number;
  is_active: boolean;
  updated_by: string | null;
  updated_at: string;
}

export type EvacuationNodeType = "JUNCTION" | "EXIT" | "REFUGE_CHAMBER" | "WORK_AREA";

export interface EvacuationNode {
  id: string;
  node_type: EvacuationNodeType;
  sector_id: string;
  world_x: number;
  world_y: number;
  world_z: number;
  label: string | null;
}

export interface EvacuationEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  sector_id: string;
  distance: number;
  manually_blocked: boolean;
  blocked_reason: string | null;
  // Computed, not stored: the current hazard severity along this edge's
  // sector, and whether pathfinding would exclude it entirely right now.
  hazard_level: RiskLevel | null;
  is_excluded: boolean;
}

export interface EvacuationExit {
  id: string;
  node_id: string;
  name: string;
  sector_id: string;
  is_active: boolean;
  capacity_note: string | null;
}

export interface GraphSnapshot {
  nodes: EvacuationNode[];
  edges: EvacuationEdge[];
  exits: EvacuationExit[];
}

export type EvacuationRouteStatus = "ACTIVE" | "INVALIDATED" | "COMPLETED";

export interface EvacuationRoute {
  id: string;
  emergency_event_id: string;
  worker_id: string;
  origin_node_id: string;
  destination_exit_id: string;
  node_path: string[];
  total_distance: number;
  eta_seconds: number;
  safety_score: number;
  hazards_avoided: Record<string, unknown>[] | null;
  reason: string;
  route_version: number;
  status: EvacuationRouteStatus;
  generated_at: string;
  invalidated_at: string | null;
  superseded_by_route_id: string | null;
}

export type WorkerEvacuationStatus =
  | "NOT_AFFECTED"
  | "EVACUATION_ASSIGNED"
  | "MOVING"
  | "DELAYED"
  | "ROUTE_CHANGED"
  | "SAFE_AT_EXIT"
  | "UNACCOUNTED"
  | "TRACKING_LOST";

// source_type is always SIMULATED today — there is no real underground GPS
// hardware in this system. Never display this position as a real GPS fix.
export interface WorkerPosition {
  worker_id: string;
  current_node_id: string | null;
  sector_id: string | null;
  source_type: "SIMULATED" | "REAL_TRACKER" | "MANUAL";
  status: WorkerEvacuationStatus;
  active_route_id: string | null;
  manual_stall: boolean;
  updated_at: string;
}

export type EmergencyWsEventType =
  | "EMERGENCY_CREATED"
  | "EMERGENCY_UPDATED"
  | "EMERGENCY_ESCALATED"
  | "ALL_CLEAR"
  | "ROUTE_CREATED"
  | "ROUTE_CHANGED"
  | "WORKER_POSITION_UPDATED"
  | "WORKER_SAFE";

export interface EmergencyWsMessage<T = unknown> {
  type: EmergencyWsEventType;
  data: T;
  timestamp: string;
}
