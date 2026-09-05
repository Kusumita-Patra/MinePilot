// ============================================================================
// digital-twin/geometryUtils.ts
//
// Small, pure helpers for building procedural geometry transforms. Kept
// separate from MineTerrain.tsx so the math is easy to unit-test and reuse
// (e.g. if a second haul road or ramp is added later).
// ============================================================================

import { Object3D, Quaternion, Vector3 } from "three";

export interface BeamTransform {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  length: number;
}

/**
 * Computes the position/orientation/length needed to place a BoxGeometry
 * (authored with its long axis along local Z, i.e. `new THREE.BoxGeometry(width,
 * thickness, length)`) so that it spans from point `a` to point `b` — used
 * for the haul-road ramp. Uses a throwaway Object3D + lookAt rather than
 * hand-rolled trig so the slope/rotation is always correct.
 */
export function computeBeamTransform(a: Vector3, b: Vector3): BeamTransform {
  const dummy = new Object3D();
  const midpoint = a.clone().add(b).multiplyScalar(0.5);
  dummy.position.copy(midpoint);
  dummy.lookAt(b);
  dummy.updateMatrixWorld();

  const quat = new Quaternion();
  dummy.getWorldQuaternion(quat);

  return {
    position: [midpoint.x, midpoint.y, midpoint.z],
    quaternion: [quat.x, quat.y, quat.z, quat.w],
    length: a.distanceTo(b),
  };
}

/** Point on the pit rim (y = 0) at a given angle (radians) and radius. */
export function pointOnCircle(radius: number, angle: number, y: number): Vector3 {
  return new Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
}
