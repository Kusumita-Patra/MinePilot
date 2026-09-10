"use client";

import { useEffect, useState, useCallback } from "react";
import { getTelemetryHistory, type SensorFrameHistoryPoint } from "@/lib/api";
import { rangeToWindow } from "@/lib/timeRanges";

export function useTelemetryHistory(sectorId: string | null, limit = 100, rangeId?: string) {
  const [points, setPoints] = useState<SensorFrameHistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // The requested [from, to] window itself, distinct from the span of data
  // actually returned — a gap at the start/end of the window (an ingestion
  // outage, e.g.) must not make the chart silently shrink to fit the data.
  const [window, setWindow] = useState<{ from: string; to: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (!sectorId) {
      setPoints([]);
      setWindow(null);
      setLoading(false);
      return;
    }
    try {
      const requestedWindow = rangeId ? rangeToWindow(rangeId) : undefined;
      const data = await getTelemetryHistory({
        sector_id: sectorId,
        limit,
        from: requestedWindow?.from,
        to: requestedWindow?.to,
      });
      setPoints([...data].reverse());
      setWindow(requestedWindow ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load telemetry history");
    } finally {
      setLoading(false);
    }
  }, [sectorId, limit, rangeId]);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  return { points, error, loading, refresh, window };
}
