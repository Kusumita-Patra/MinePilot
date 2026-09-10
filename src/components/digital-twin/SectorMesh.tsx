"use client";

// ============================================================================
// digital-twin/SectorMesh.tsx
//
// Wrap any terrain geometry (a single <mesh>, or a <group> of several) to
// make it an identifiable, registry-backed sector:
//
//   <SectorMesh sectorId="sector_north_wall">
//     <mesh geometry={...} material={...} />
//   </SectorMesh>
//
// This guarantees every sector is a NAMED object with `userData.sectorId`
// set (satisfying the spec's "do not create anonymous sector meshes"
// requirement) and is registered in the SectorRegistry so
// `sensor.sector_id -> mesh` lookups work regardless of how the geometry
// inside is structured.
// ============================================================================

import { useEffect, useRef, type ReactNode } from "react";
import type { Group } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { MineSectorId } from "./types";
import { useSectorRegistry } from "./SectorRegistry";

interface SectorMeshProps {
  sectorId: MineSectorId;
  children: ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Fires for a click anywhere inside this sector (bubbles up from
   * whichever child mesh was actually hit, so `event.point` is the real
   * world-space click location — not just the sector's own origin). */
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
}

export default function SectorMesh({
  sectorId,
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  onClick,
}: SectorMeshProps) {
  const groupRef = useRef<Group>(null);
  const { register } = useSectorRegistry();

  useEffect(() => {
    const node = groupRef.current;
    if (!node) return;
    return register(sectorId, node);
  }, [register, sectorId]);

  return (
    <group
      ref={groupRef}
      name={sectorId}
      userData={{ sectorId }}
      position={position}
      rotation={rotation}
      onClick={onClick}
    >
      {children}
    </group>
  );
}
