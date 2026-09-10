"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Incident } from "../../shared/types/telemetry";
import { fetchIncidents, updateIncident } from "@/lib/api";
import {
  loadCachedIncidents,
  saveCachedIncidents,
  loadPendingActions,
  applyPendingPatches,
  enqueueAction,
  removeAction,
  type IncidentPatch,
  type PendingAction,
} from "@/lib/offlineQueue";

const POLL_MS = 4000;

export function useIncidents() {
  // Seed from localStorage synchronously on first render so the field page
  // shows the last-known tickets immediately, even with zero connectivity
  // (e.g. underground) and even before the first fetch has a chance to run.
  const [serverIncidents, setServerIncidents] = useState<Incident[]>(() => loadCachedIncidents());
  const [pending, setPending] = useState<PendingAction[]>(() => loadPendingActions());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const syncingRef = useRef(false);

  const incidents = applyPendingPatches(serverIncidents, pending);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchIncidents();
      setServerIncidents(data);
      saveCachedIncidents(data);
      setError(null);
      setIsOffline(false);
    } catch (e) {
      // Backend unreachable — keep showing cached + pending-patched data
      // rather than clearing the screen. This is the expected, normal path
      // whenever the field worker has no signal underground.
      setError(e instanceof Error ? e.message : "Failed to load incidents");
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Attempts to send every queued action to the server, oldest first. Stops
  // at the first failure (keeps remaining actions queued in original order)
  // rather than firing them all in parallel, since a later action on the
  // same ticket depends on an earlier one having already applied.
  const flushQueue = useCallback(async () => {
    if (syncingRef.current) return;
    const queue = loadPendingActions();
    if (queue.length === 0) return;

    syncingRef.current = true;
    try {
      for (const action of queue) {
        try {
          await updateIncident(action.ticketId, action.patch);
          removeAction(action.id);
          setPending(loadPendingActions());
        } catch {
          // Still offline (or server rejected it) — stop here, leave the
          // rest queued, try again on the next poll/online event.
          setIsOffline(true);
          return;
        }
      }
      // Every queued action made it through — pull the authoritative state.
      await refresh();
    } finally {
      syncingRef.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const id = setInterval(() => {
      refresh();
      flushQueue();
    }, POLL_MS);

    function handleOnline() {
      setIsOffline(false);
      flushQueue();
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(timer);
      clearInterval(id);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refresh, flushQueue]);

  /**
   * Applies a patch immediately in the UI (optimistic) and queues it for
   * background sync. Still tries to send it right away — if that succeeds,
   * it's removed from the queue immediately rather than waiting for the
   * next poll. If it fails (no connectivity), it stays queued and the UI
   * has already updated, so the field worker isn't blocked by their
   * signal underground.
   */
  const updateIncidentOffline = useCallback(async (ticketId: string, patch: IncidentPatch) => {
    const action = enqueueAction(ticketId, patch);
    setPending(loadPendingActions());

    try {
      await updateIncident(ticketId, patch);
      removeAction(action.id);
      setPending(loadPendingActions());
      setIsOffline(false);
      await refresh();
    } catch {
      setIsOffline(true);
      // Stays queued — flushQueue will retry once connectivity returns.
    }
  }, [refresh]);

  return {
    incidents,
    error,
    loading,
    isOffline,
    pendingCount: pending.length,
    refresh,
    updateIncidentOffline,
  };
}