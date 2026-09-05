"use client";

// ============================================================================
// digital-twin/MineModel.tsx
//
// Loads /models/mine.glb via drei's useGLTF. Wrap this in <ModelErrorBoundary>
// + <Suspense> (done in MineScene.tsx) so a missing/broken file falls back to
// the procedural terrain instead of crashing the app.
//
// Sector identification for GLB content: the DCC-authored model is expected
// to name its sector objects exactly like the ids in sectors.ts
// (sector_north_wall, sector_deep_shaft_b, sector_surface_conveyor —
// e.g. as Blender Empty/object names, which glTF export preserves as
// `Object3D.name`). On load we walk the scene graph once and register any
// object whose name matches a known sector id, stamping userData.sectorId
// if the authoring tool didn't already set it. No anonymous sector meshes
// make it through either path (GLB or procedural).
// ============================================================================

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import type { Object3D } from "three";
import { useSectorRegistry } from "./SectorRegistry";
import { mineSectors } from "./sectors";

const KNOWN_SECTOR_IDS = new Set(Object.keys(mineSectors));

interface MineModelProps {
  url: string;
}

export default function MineModel({ url }: MineModelProps) {
  const { scene } = useGLTF(url);
  const { register } = useSectorRegistry();

  // Clone so multiple mounts (e.g. hot reload) never share/mutate the single
  // cached GLTF scene that useGLTF holds internally.
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    const unregisterFns: Array<() => void> = [];

    cloned.traverse((object: Object3D) => {
      const candidateId = object.userData?.sectorId ?? object.name;
      if (KNOWN_SECTOR_IDS.has(candidateId)) {
        object.userData.sectorId = candidateId;
        unregisterFns.push(register(candidateId, object));
      }
      // Reasonable defaults for a dark industrial look; artists can still
      // override per-mesh via material settings baked into the GLB.
      if ("castShadow" in object) object.castShadow = true;
      if ("receiveShadow" in object) object.receiveShadow = true;
    });

    if (unregisterFns.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        "[MineModel] No objects in mine.glb matched a known sector id " +
          `(${Array.from(KNOWN_SECTOR_IDS).join(", ")}). ` +
          "Sensor sector highlighting will have nothing to resolve to."
      );
    }

    return () => unregisterFns.forEach((fn) => fn());
  }, [cloned, register]);

  return <primitive object={cloned} />;
}

// Note: preloading (useGLTF.preload(url)) is triggered from MineScene.tsx,
// where the effective `url` (default or caller-overridden) is known, rather
// than hardcoded here.
