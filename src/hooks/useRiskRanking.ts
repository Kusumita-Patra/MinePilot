"use client";

import { useEffect, useState, useCallback } from "react";
import { getRiskRanking, type SectorRiskRanking } from "@/lib/api";

const POLL_MS = 15000;

export function useRiskRanking() {
  const [data, setData] = useState<SectorRiskRanking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const ranking = await getRiskRanking();
      setData(ranking);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load risk ranking");
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
