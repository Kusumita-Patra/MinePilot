"use client";

import { useEffect, useState, useCallback } from "react";
import { getTelemetryHistory, type SensorFrameHistoryPoint } from "@/lib/api";
import { rangeToWindow } from "@/lib/timeRanges";

export function useTelemetryHistory(sectorId: string | null, limit = 100, rangeId?: string) {
  const [points, setPoints] = useState<SensorFrameHistoryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    if (!sectorId) {
      setPoints([]);
      setLoading(false);
      return;
    }
    try {
      const window = rangeId ? rangeToWindow(rangeId) : undefined;
      const data = await getTelemetryHistory({
        sector_id: sectorId,
        limit,
        from: window?.from,
        to: window?.to,
      });
      setPoints([...data].reverse());
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

  return { points, error, loading, refresh };
}
