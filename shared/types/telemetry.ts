// Shared telemetry & incident types — matches the backend WebSocket schema

export type RiskLevel = "NORMAL" | "WARNING" | "CRITICAL";

export interface TelemetryReading {
  ch4_pct: number;
  co_ppm: number;
  displacement_mm: number;
  temp_c: number;
  dust_pm10: number;
}

export interface SensorFrame {
  sensor_id: string;
  sector_id: string;
  coordinates: { x: number; y: number; z: number };
  telemetry: TelemetryReading;
  risk_score: number; // 0-100
  risk_level: RiskLevel;
  timestamp: string; // ISO 8601
}

export type IncidentStatus =
  | "TRIGGERED"
  | "ASSIGNED"
  | "RESOLVED"
  | "ESCALATED"
  | "SIGNED_OFF";

export interface Incident {
  ticket_id: string;
  sector_id: string;
  sensor_id: string;
  risk_score: number;
  severity: RiskLevel;
  status: IncidentStatus;
  assigned_worker_id?: string;
  field_remarks?: string;
  resolution_photo_url?: string;
  created_at: string;
  resolved_at?: string;
}