"use client";

import type { Incident } from "../../shared/types/telemetry";
import type { updateIncident } from "@/lib/api";

const CACHE_KEY = "minepilot:incidents:cache";
const QUEUE_KEY = "minepilot:incidents:pending";

export type IncidentPatch = Parameters<typeof updateIncident>[1];

export interface PendingAction {
  id: string;
  ticketId: string;
  patch: IncidentPatch;
  createdAt: number;
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// All localStorage access is guarded because this module is imported by
// components that also render (in theory) during SSR, where `window` and
// `localStorage` don't exist.
function hasStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadCachedIncidents(): Incident[] {
  if (!hasStorage()) return [];
  return safeParse<Incident[]>(localStorage.getItem(CACHE_KEY), []);
}

export function saveCachedIncidents(incidents: Incident[]): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(incidents));
  } catch {
    // Storage full or unavailable (e.g. private browsing) — degrade silently,
    // the app still works, it just won't have offline history this session.
  }
}

export function loadPendingActions(): PendingAction[] {
  if (!hasStorage()) return [];
  return safeParse<PendingAction[]>(localStorage.getItem(QUEUE_KEY), []);
}

export function savePendingActions(actions: PendingAction[]): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(actions));
  } catch {
    // See note above.
  }
}

export function enqueueAction(ticketId: string, patch: IncidentPatch): PendingAction {
  const action: PendingAction = {
    id: `${ticketId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ticketId,
    patch,
    createdAt: Date.now(),
  };
  const queue = loadPendingActions();
  queue.push(action);
  savePendingActions(queue);
  return action;
}

export function removeAction(actionId: string): void {
  const queue = loadPendingActions().filter((a) => a.id !== actionId);
  savePendingActions(queue);
}

/**
 * Applies every queued patch (in order, oldest first) on top of a base
 * incident list, so the UI reflects actions the worker already took locally
 * even before they've reached the server. Later patches for the same
 * ticket override earlier ones, matching how the real backend would apply
 * them sequentially.
 */
export function applyPendingPatches(base: Incident[], pending: PendingAction[]): Incident[] {
  if (pending.length === 0) return base;
  const byId = new Map(base.map((inc) => [inc.ticket_id, { ...inc }]));
  for (const action of pending) {
    const existing = byId.get(action.ticketId);
    if (existing) {
      byId.set(action.ticketId, { ...existing, ...action.patch } as Incident);
    }
  }
  return Array.from(byId.values());
}