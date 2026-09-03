const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

import type { Incident, IncidentStatus } from "../../shared/types/telemetry";

export async function fetchIncidents(status?: IncidentStatus): Promise<Incident[]> {
  const url = new URL(`${API_URL}/api/v1/incidents`);
  if (status) url.searchParams.set("status", status);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`fetchIncidents failed: ${res.status}`);
  return res.json();
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
  const res = await fetch(`${API_URL}/api/v1/incidents/${ticketId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(detail.detail ?? `updateIncident failed: ${res.status}`);
  }
  return res.json();
}