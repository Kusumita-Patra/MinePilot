export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import type { Incident, IncidentStatus, TelemetryReading } from "../../shared/types/telemetry";
import { useAuthStore, type AuthUser } from "./authStore";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T;
  status_code?: number;
  errors?: unknown[];
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    // A FormData body needs the browser to set its own multipart boundary —
    // forcing JSON here would silently send the wrong Content-Type for any
    // file upload (spreading options.headers below never removes this key).
    ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = (await res.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!res.ok) {
    if (res.status === 401) {
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") window.location.href = "/login";
    }
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }

  return body.data as T;
}

export async function fetchIncidents(status?: IncidentStatus): Promise<Incident[]> {
  const search = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<Incident[]>(`/api/incidents${search}`);
}

export async function updateIncident(
  ticketId: string,
  patch: {
    status?: IncidentStatus;
    assigned_worker_id?: string;
    field_remarks?: string;
    resolution_photo_url?: string;
  }
): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(payload: {
  email: string;
  password: string;
  full_name: string;
  role: "mine_manager" | "field_worker";
}): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch<Record<string, never>>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
}

export async function updateFullName(fullName: string): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify({ full_name: fullName }),
  });
}

export async function updateEmail(newEmail: string, currentPassword: string): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/update-email", {
    method: "POST",
    body: JSON.stringify({ new_email: newEmail, current_password: currentPassword }),
  });
}

export interface KpiMetric {
  value: number;
  trend: string | null;
}

export interface KpiSummary {
  overall_compliance: KpiMetric;
  open_violations: KpiMetric;
  pending_actions: KpiMetric;
  inspections_this_month: KpiMetric;
}

export async function getKpis(): Promise<KpiSummary> {
  return apiFetch<KpiSummary>("/api/kpis");
}

export interface SectorRiskRanking {
  sector_id: string;
  avg_risk_score: number;
  risk_level: "NORMAL" | "WARNING" | "CRITICAL";
}

export async function getRiskRanking(): Promise<SectorRiskRanking[]> {
  return apiFetch<SectorRiskRanking[]>("/api/analytics/risk-ranking");
}

export interface InspectionsBreakdown {
  completed: number;
  in_progress: number;
  scheduled: number;
}

export async function getInspectionsBreakdown(): Promise<InspectionsBreakdown> {
  return apiFetch<InspectionsBreakdown>("/api/analytics/inspections");
}

export type InspectionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";

export interface Inspection {
  id: string;
  sector_id: string;
  status: InspectionStatus;
  scheduled_date: string;
  completed_at: string | null;
  inspector_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function getInspections(status?: InspectionStatus): Promise<Inspection[]> {
  const search = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<Inspection[]>(`/api/inspections${search}`);
}

export async function createInspection(payload: {
  sector_id: string;
  scheduled_date: string;
  notes?: string;
}): Promise<Inspection> {
  return apiFetch<Inspection>("/api/inspections", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateInspection(
  id: string,
  patch: { status?: InspectionStatus; notes?: string; completed_at?: string }
): Promise<Inspection> {
  return apiFetch<Inspection>(`/api/inspections/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function getUsers(): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>("/api/users");
}

/** What the signed-in user can actually do, per the dynamic role_permissions
 * table (administrator gets every capability back as true). Used to decide
 * what UI to show — see src/hooks/usePermissions.ts. The backend's
 * require_permission(...) checks remain the real authorization boundary. */
export async function getMyPermissions(): Promise<Record<string, boolean>> {
  return apiFetch<Record<string, boolean>>("/api/auth/permissions");
}

export async function createUser(payload: {
  email: string;
  password: string;
  full_name: string;
  role: "administrator" | "mine_manager" | "field_worker";
}): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateUserRole(
  userId: string,
  role: "administrator" | "mine_manager" | "field_worker"
): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}

export async function updateUserStatus(userId: string, isActive: boolean): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export interface ComplianceCategoryScore {
  category: string;
  score_pct: number;
}

export async function getComplianceBreakdown(): Promise<ComplianceCategoryScore[]> {
  return apiFetch<ComplianceCategoryScore[]>("/api/analytics/compliance");
}

export interface SensorFrameHistoryPoint {
  sensor_id: string;
  sector_id: string;
  coordinates: { x: number; y: number; z: number };
  telemetry: TelemetryReading;
  risk_score: number;
  risk_level: "NORMAL" | "WARNING" | "CRITICAL";
  timestamp: string;
}

export async function getTelemetryHistory(params: {
  sector_id?: string;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<SensorFrameHistoryPoint[]> {
  const search = new URLSearchParams();
  if (params.sector_id) search.set("sector_id", params.sector_id);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  const query = search.toString();
  return apiFetch<SensorFrameHistoryPoint[]>(`/api/telemetry/history${query ? `?${query}` : ""}`);
}

// ---------------------------------------------------------------------------
// Administrator-only endpoints (backend enforces the role check — these are
// only reachable at all when the signed-in user is an administrator).
// ---------------------------------------------------------------------------

export interface AdminDashboardSummary {
  total_users: number;
  users_by_role: Record<string, number>;
  active_blueprint_name: string | null;
  active_blueprint_section_count: number;
  offline_sensor_count: number;
  open_incident_count: number;
  recent_audit_logs: AuditLogEntry[];
}

export async function getAdminDashboard(): Promise<AdminDashboardSummary> {
  return apiFetch<AdminDashboardSummary>("/api/admin/dashboard");
}

export type ComponentHealthStatus = "healthy" | "degraded" | "unavailable";

export interface ComponentHealth {
  name: string;
  status: ComponentHealthStatus;
  detail: string;
}

export async function getSystemHealth(): Promise<{ components: ComponentHealth[] }> {
  return apiFetch<{ components: ComponentHealth[] }>("/api/admin/system-health");
}

export interface AuditLogEntry {
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

export async function getAuditLogs(params?: { limit?: number; offset?: number }): Promise<AuditLogEntry[]> {
  const search = new URLSearchParams();
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.offset) search.set("offset", String(params.offset));
  const query = search.toString();
  return apiFetch<AuditLogEntry[]>(`/api/admin/audit-logs${query ? `?${query}` : ""}`);
}

export interface MineStructureSection {
  id: string;
  name: string;
  sector_id: string;
  zone_type: string;
  status: string;
  depth: number;
}

export interface MineStructureLevel {
  level_label: string;
  sections: MineStructureSection[];
}

export interface MineStructure {
  blueprint_id: string | null;
  blueprint_name: string | null;
  levels: MineStructureLevel[];
}

export async function getMineStructure(): Promise<MineStructure> {
  return apiFetch<MineStructure>("/api/admin/mine-structure");
}

export interface AlertRule {
  id: string;
  rule_key: string;
  display_name: string;
  warning_threshold: number | null;
  critical_threshold: number | null;
  unit: string | null;
  is_active: boolean;
  updated_at: string;
}

export async function getAlertRules(): Promise<AlertRule[]> {
  return apiFetch<AlertRule[]>("/api/admin/alert-rules");
}

export async function updateAlertRule(
  ruleId: string,
  patch: { warning_threshold?: number; critical_threshold?: number; is_active?: boolean }
): Promise<AlertRule> {
  return apiFetch<AlertRule>(`/api/admin/alert-rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export type ComplianceRequirementAppliesTo = "WORKER" | "CONTRACTOR";

export interface ComplianceRequirement {
  id: string;
  applies_to: ComplianceRequirementAppliesTo;
  document_type: string;
  warning_threshold_days: number;
  critical_threshold_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getComplianceRequirements(): Promise<ComplianceRequirement[]> {
  return apiFetch<ComplianceRequirement[]>("/api/admin/compliance-rules");
}

export async function createComplianceRequirement(payload: {
  applies_to: ComplianceRequirementAppliesTo;
  document_type: string;
  warning_threshold_days: number;
  critical_threshold_days: number;
}): Promise<ComplianceRequirement> {
  return apiFetch<ComplianceRequirement>("/api/admin/compliance-rules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateComplianceRequirement(
  requirementId: string,
  patch: Partial<{
    document_type: string;
    warning_threshold_days: number;
    critical_threshold_days: number;
    is_active: boolean;
  }>
): Promise<ComplianceRequirement> {
  return apiFetch<ComplianceRequirement>(`/api/admin/compliance-rules/${requirementId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface RolePermissionCell {
  id: string | null;
  allowed: boolean;
}

export interface RolePermissionMatrixRow {
  capability: string;
  label: string;
  mine_manager: RolePermissionCell;
  field_worker: RolePermissionCell;
}

export async function getPermissionMatrix(): Promise<RolePermissionMatrixRow[]> {
  return apiFetch<RolePermissionMatrixRow[]>("/api/admin/permissions");
}

export async function updatePermission(permissionId: string, allowed: boolean): Promise<{ id: string; allowed: boolean }> {
  return apiFetch<{ id: string; allowed: boolean }>(`/api/admin/permissions/${permissionId}`, {
    method: "PATCH",
    body: JSON.stringify({ allowed }),
  });
}
