"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

import { getRiskMaterials, updateRiskMaterials } from "./riskMaterials";
import { RISK_EFFECTS } from "./sensorUtils";
import {
  HALO_GEOMETRY,
  NO_RAYCAST,
  SELECTION_BEAM_GEOMETRY,
  SELECTION_BEAM_MATERIAL,
  SELECTION_RING_GEOMETRY,
  SELECTION_RING_MATERIAL,
  getShockwaveGeometry,
} from "./sharedGeometries";
import type { RiskLevel } from "./types";

/**
 * The only `useFrame` that touches risk animation. It advances the three shared
 * material sets once per frame, so a scene with 10 sensors and a scene with
 * 1000 sensors do exactly the same amount of animation work on the CPU.
 *
 * Mounted once by <SensorMarkers />.
 */
export function RiskEffectClock() {
  useFrame((state) => {
    updateRiskMaterials(state.clock.elapsedTime);
  });

  return null;
}

/* -------------------------------------------------------------------------- */
/* Halo                                                                       */
/* -------------------------------------------------------------------------- */

export interface RiskHaloProps {
  riskLevel: RiskLevel;
}

/**
 * Camera-facing radial glow. Billboarding, breathing and the travelling rings
 * all happen inside the vertex/fragment shader, so this component renders one
 * quad and never runs a frame callback of its own.
 *
 *   NORMAL   steady, subtle
 *   WARNING  expands and contracts at sin(t * 4)
 *   CRITICAL fast strobe at sin(t * 12) with three travelling rings
 */
export function RiskHalo({ riskLevel }: RiskHaloProps) {
  const materials = getRiskMaterials();

  return (
    <mesh
      geometry={HALO_GEOMETRY}
      material={materials.halo[riskLevel]}
      raycast={NO_RAYCAST}
      renderOrder={2}
      frustumCulled={false}
      dispose={null}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Shockwave rings                                                            */
/* -------------------------------------------------------------------------- */

export interface ShockwaveRingsProps {
  riskLevel: RiskLevel;
}

/**
 * Horizontal rings expanding outward from the marker, giving the alarm a sense
 * of depth that a billboard alone cannot. Every ring lives in a single merged
 * geometry and is expanded in the vertex shader — one draw call, no CPU work.
 *
 * Only mounted for WARNING and CRITICAL.
 */
export function ShockwaveRings({ riskLevel }: ShockwaveRingsProps) {
  const materials = getRiskMaterials();
  const config = RISK_EFFECTS[riskLevel];

  if (config.shockwaveCount <= 0) return null;

  return (
    <mesh
      geometry={getShockwaveGeometry(config.shockwaveCount)}
      material={materials.shockwave[riskLevel]}
      raycast={NO_RAYCAST}
      renderOrder={1}
      frustumCulled={false}
      dispose={null}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Selection indicator                                                        */
/* -------------------------------------------------------------------------- */

export interface SelectionIndicatorProps {
  /** Height of the beacon stem, used to size the vertical beam. */
  height: number;
}

/**
 * Neutral white ring plus a vertical beam. Deliberately colorless so a selected
 * marker keeps its risk color: selected + WARNING still reads as amber.
 *
 * At most one of these exists at a time, so its rotation frame callback is free.
 */
export function SelectionIndicator({ height }: SelectionIndicatorProps) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    const ring = ringRef.current;
    if (ring) ring.rotation.y += delta * 0.8;
  });

  return (
    <group>
      <mesh
        ref={ringRef}
        geometry={SELECTION_RING_GEOMETRY}
        material={SELECTION_RING_MATERIAL}
        position={[0, 0.02, 0]}
        raycast={NO_RAYCAST}
        renderOrder={3}
        dispose={null}
      />
      <mesh
        geometry={SELECTION_BEAM_GEOMETRY}
        material={SELECTION_BEAM_MATERIAL}
        position={[0, height * 1.6, 0]}
        scale={[1, height * 3.2, 1]}
        raycast={NO_RAYCAST}
        renderOrder={1}
        dispose={null}
      />
    </group>
  );
}
