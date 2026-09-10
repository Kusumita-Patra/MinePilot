"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchBlueprintImageBlobUrl, getActiveBlueprint, type MineBlueprint } from "@/lib/blueprintApi";

/** Loads the active (most recently uploaded) blueprint and its traced
 * sections. `null` blueprint (once loaded) means none has been uploaded yet
 * — callers fall back to whatever default view they'd otherwise show. */
export function useActiveBlueprint() {
  const [blueprint, setBlueprint] = useState<MineBlueprint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getActiveBlueprint();
      setBlueprint(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load blueprint");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { blueprint, loading, error, refresh };
}

/** Fetches the blueprint image as an authenticated blob and hands back an
 * object URL, revoking it on unmount/blueprintId change so it doesn't leak. */
export function useBlueprintImageUrl(blueprintId: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blueprintId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;

    fetchBlueprintImageBlobUrl(blueprintId).then(
      (u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
      },
      () => {
        if (!cancelled) setUrl(null);
      }
    );

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [blueprintId]);

  return url;
}
