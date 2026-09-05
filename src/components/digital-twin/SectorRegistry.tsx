"use client";

// ============================================================================
// digital-twin/SectorRegistry.tsx
//
// Solves the "sensor.sector_id -> 3D sector mesh" mapping problem called out
// in the spec. Every identifiable sector mesh in the mine (GLB or
// procedural) registers itself here under its sector id as it mounts. The
// sensor-visualization developer can then resolve a live Object3D reference
// with `useSectorRegistry().getSector(sensor.sector_id)` — no scene
// traversal, no name-string guessing, and it stays correct even if geometry
// changes shape or moves.
//
// This context lives OUTSIDE <Canvas> in MineDigitalTwin.tsx. React Three
// Fiber (v8+) automatically bridges context providers wrapping <Canvas> into
// the R3F render tree, so components rendered inside the Canvas can still
// call `useSectorRegistry()` normally.
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { Object3D } from "three";

interface SectorRegistryValue {
  /** Register a mesh/group under a sector id. Returns an unregister fn — call
   * it from a useEffect cleanup so stale refs never linger past unmount. */
  register: (sectorId: string, object: Object3D) => () => void;
  /** Look up the live Object3D for a sector id (e.g. from `sensor.sector_id`). */
  getSector: (sectorId: string) => Object3D | undefined;
  /** All currently registered sector ids. Handy for building a legend/list. */
  getRegisteredSectorIds: () => string[];
}

const SectorRegistryContext = createContext<SectorRegistryValue | null>(null);

export function SectorRegistryProvider({ children }: { children: ReactNode }) {
  const sectorsRef = useRef<Map<string, Object3D>>(new Map());

  const register = useCallback((sectorId: string, object: Object3D) => {
    sectorsRef.current.set(sectorId, object);
    return () => {
      if (sectorsRef.current.get(sectorId) === object) {
        sectorsRef.current.delete(sectorId);
      }
    };
  }, []);

  const getSector = useCallback((sectorId: string) => sectorsRef.current.get(sectorId), []);

  const getRegisteredSectorIds = useCallback(() => Array.from(sectorsRef.current.keys()), []);

  const value = useMemo(
    () => ({ register, getSector, getRegisteredSectorIds }),
    [register, getSector, getRegisteredSectorIds]
  );

  return <SectorRegistryContext.Provider value={value}>{children}</SectorRegistryContext.Provider>;
}

/** Public hook for the sensor-visualization layer. Throws outside a provider
 * so a missing <SectorRegistryProvider> fails loudly during development
 * rather than silently no-op-ing. */
export function useSectorRegistry(): SectorRegistryValue {
  const ctx = useContext(SectorRegistryContext);
  if (!ctx) {
    throw new Error("useSectorRegistry() must be used inside <MineDigitalTwin />");
  }
  return ctx;
}
