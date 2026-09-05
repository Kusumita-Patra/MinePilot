const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import type { Incident, IncidentStatus } from "../../shared/types/telemetry";
import { useAuthStore, type AuthUser } from "./authStore";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T;
  status_code?: number;
  errors?: unknown[];
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
