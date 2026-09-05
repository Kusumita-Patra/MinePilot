"use client";

import { useEffect, useState, useCallback } from "react";
import { getInspections, type Inspection, type InspectionStatus } from "@/lib/api";

const POLL_MS = 8000;

export function useInspections(status?: InspectionStatus) {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await getInspections(status);
      setInspections(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inspections");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    const timer = setTimeout(refresh, 0);
    const id = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(id);
    };
  }, [refresh]);

  return { inspections, error, loading, refresh };
}
