"use client";

import { useEffect, useState, useCallback } from "react";
import { getKpis, type KpiSummary } from "@/lib/api";

const POLL_MS = 15000;

export function useKpis() {
  const [data, setData] = useState<KpiSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const kpis = await getKpis();
      setData(kpis);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load KPIs");
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

  return { data, error, loading };
}
