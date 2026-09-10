export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import type { Incident, IncidentStatus } from "../../shared/types/telemetry";
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
  risk_score: number;
  risk_level: "NORMAL" | "WARNING" | "CRITICAL";
  timestamp: string;
}

export async function getTelemetryHistory(params: {
  sector_id?: string;
  limit?: number;
}): Promise<SensorFrameHistoryPoint[]> {
  const search = new URLSearchParams();
  if (params.sector_id) search.set("sector_id", params.sector_id);
  if (params.limit) search.set("limit", String(params.limit));
  const query = search.toString();
  return apiFetch<SensorFrameHistoryPoint[]>(`/api/telemetry/history${query ? `?${query}` : ""}`);
}
