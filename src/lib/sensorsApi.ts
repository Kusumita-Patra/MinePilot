import { apiFetch } from "./api";
import type { BlueprintSectorId } from "./blueprintApi";

export type SensorType =
  | "METHANE"
  | "CARBON_MONOXIDE"
  | "TEMPERATURE"
  | "VENTILATION"
  | "HUMIDITY"
  | "PRESSURE"
  | "VIBRATION"
  | "DUST"
  | "ELECTRICAL"
  | "NOISE";

export type SensorConfigStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "RETIRED";
export type CalibrationStatus = "VALID" | "DUE_SOON" | "OVERDUE";

// Mirrors backend governance_risk_service.py's SENSOR_TYPE_METRIC exactly —
// the sensor types whose warning/critical thresholds are now live-enforced
// (escalate this sensor's risk level on breach) because the frozen
// SensorFrame telemetry contract carries a matching raw field. Sensor types
// not listed here (VENTILATION, HUMIDITY, PRESSURE, ELECTRICAL, NOISE) have
// no matching field yet, so their thresholds stay display-only.
export const SENSOR_TYPE_WITH_LIVE_METRIC: Partial<Record<SensorType, string>> = {
  METHANE: "ch4_pct",
  CARBON_MONOXIDE: "co_ppm",
  TEMPERATURE: "temp_c",
  DUST: "dust_pm10",
  VIBRATION: "displacement_mm",
};

export interface CurrentReading {
  ch4_pct: number;
  co_ppm: number;
  displacement_mm: number;
  temp_c: number;
  dust_pm10: number;
  risk_score: number;
  risk_level: string;
  timestamp: string;
}

export interface SensorConfig {
  id: string;
  sensor_id: string;
  display_name: string;
  sensor_type: SensorType;
  manufacturer: string | null;
  model: string | null;
  status: SensorConfigStatus;
  blueprint_id: string;
  section_id: string | null;
  sector_id: BlueprintSectorId;
  level_label: string;
  depth: number;
  pixel_x: number;
  pixel_y: number;
  warning_threshold: number | null;
  critical_threshold: number | null;
  installation_date: string | null;
  last_calibration_at: string | null;
  next_calibration_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Enrichment — computed by the backend, not stored columns.
  is_reporting: boolean;
  current_reading: CurrentReading | null;
  calibration_status: CalibrationStatus | null;
}

export interface SensorHistoryEntry {
  id: string;
  actor_user_id: string;
  actor_role: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SensorStats {
  total: number;
  by_status: Record<SensorConfigStatus, number>;
  offline_count: number;
}

export async function getSensors(filters?: {
  sensor_type?: SensorType;
  status?: SensorConfigStatus;
  sector_id?: string;
  level_label?: string;
}): Promise<SensorConfig[]> {
  const search = new URLSearchParams();
  if (filters?.sensor_type) search.set("sensor_type", filters.sensor_type);
  if (filters?.status) search.set("status", filters.status);
  if (filters?.sector_id) search.set("sector_id", filters.sector_id);
  if (filters?.level_label) search.set("level_label", filters.level_label);
  const query = search.toString();
  return apiFetch<SensorConfig[]>(`/api/sensors${query ? `?${query}` : ""}`);
}

export async function getSensor(sensorId: string): Promise<SensorConfig> {
  return apiFetch<SensorConfig>(`/api/sensors/${encodeURIComponent(sensorId)}`);
}

export async function getSensorHistory(sensorId: string): Promise<SensorHistoryEntry[]> {
  return apiFetch<SensorHistoryEntry[]>(`/api/sensors/${encodeURIComponent(sensorId)}/history`);
}

export async function getSensorStats(): Promise<SensorStats> {
  return apiFetch<SensorStats>("/api/sensors/stats");
}

export async function createSensor(payload: {
  sensor_id: string;
  display_name: string;
  sensor_type: SensorType;
  manufacturer?: string;
  model?: string;
  blueprint_id: string;
  section_id?: string;
  sector_id: BlueprintSectorId;
  level_label: string;
  depth: number;
  pixel_x: number;
  pixel_y: number;
  warning_threshold?: number;
  critical_threshold?: number;
  installation_date?: string;
  last_calibration_at?: string;
  next_calibration_at?: string;
}): Promise<SensorConfig> {
  return apiFetch<SensorConfig>("/api/sensors", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSensor(
  sensorId: string,
  patch: Partial<{
    display_name: string;
    sensor_type: SensorType;
    manufacturer: string;
    model: string;
    warning_threshold: number;
    critical_threshold: number;
    installation_date: string;
    last_calibration_at: string;
    next_calibration_at: string;
  }>
): Promise<SensorConfig> {
  return apiFetch<SensorConfig>(`/api/sensors/${encodeURIComponent(sensorId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function updateSensorStatus(sensorId: string, status: SensorConfigStatus): Promise<SensorConfig> {
  return apiFetch<SensorConfig>(`/api/sensors/${encodeURIComponent(sensorId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function updateSensorLocation(
  sensorId: string,
  payload: {
    section_id?: string | null;
    sector_id: BlueprintSectorId;
    level_label: string;
    depth: number;
    pixel_x: number;
    pixel_y: number;
  }
): Promise<SensorConfig> {
  return apiFetch<SensorConfig>(`/api/sensors/${encodeURIComponent(sensorId)}/location`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
