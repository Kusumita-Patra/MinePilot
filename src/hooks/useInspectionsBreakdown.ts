"use client";

import { useEffect, useState, useCallback } from "react";
import { getInspectionsBreakdown, type InspectionsBreakdown } from "@/lib/api";

const POLL_MS = 15000;

export function useInspectionsBreakdown() {
  const [data, setData] = useState<InspectionsBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const breakdown = await getInspectionsBreakdown();
      setData(breakdown);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inspections breakdown");
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
