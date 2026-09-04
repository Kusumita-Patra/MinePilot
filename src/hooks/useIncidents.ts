"use client";

import { useEffect, useState, useCallback } from "react";
import type { Incident } from "../../shared/types/telemetry";
import { fetchIncidents } from "@/lib/api";

const POLL_MS = 4000;

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchIncidents();
      setIncidents(data);
      setError(null);
    } catch (e) {
      // Backend not reachable — leave the last-known list in place rather
      // than clearing it, so a brief network blip doesn't flash the UI empty.
      setError(e instanceof Error ? e.message : "Failed to load incidents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(id);
    };
  }, [refresh]);

  return { incidents, error, loading, refresh };
}