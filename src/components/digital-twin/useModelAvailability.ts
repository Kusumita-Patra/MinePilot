"use client";

// ============================================================================
// digital-twin/useModelAvailability.ts
//
// `useGLTF` (drei) throws a rejected promise when the asset 404s, which
// React only lets a class Error Boundary catch (see ModelErrorBoundary.tsx).
// That's the correct *safety net*, but Next.js's dev overlay reports every
// boundary-caught error regardless of how gracefully the app recovers, which
// reads as a real bug on a checkout that simply hasn't dropped a mine.glb in
// yet (see public/models/README.txt). A HEAD request first means the app
// only ever attempts useGLTF when the file demonstrably exists, so the
// expected-missing-asset case never throws in the first place.
// ============================================================================

import { useEffect, useState } from "react";

// Module-level cache: one HEAD check per URL for the life of the tab, shared
// across every mount (including Fast Refresh remounts during development).
const cache = new Map<string, boolean>();

export function useModelAvailability(url: string): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(() => cache.get(url) ?? null);

  useEffect(() => {
    const cached = cache.get(url);
    if (cached !== undefined) {
      const timer = setTimeout(() => setAvailable(cached), 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        cache.set(url, res.ok);
        setAvailable(res.ok);
      })
      .catch(() => {
        if (cancelled) return;
        cache.set(url, false);
        setAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return available;
}
