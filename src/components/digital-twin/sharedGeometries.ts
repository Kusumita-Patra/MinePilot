import * as THREE from "three";

/**
 * Every marker in the scene reuses these geometry instances. Building them at
 * module scope is safe under Next.js SSR — BufferGeometry construction is pure
 * math and never touches `window` or a WebGL context.
 *
 * Nothing here is ever disposed: the set is fixed and lives for the lifetime of
 * the app. Meshes that reference them are mounted with `dispose={null}` so R3F
 * cannot tear them down when a single marker unmounts.
 */

/** Height of the beacon stem, from the anchor point up to the sphere head. */
export const PIN_HEIGHT = 1.1;

export const CORE_GEOMETRY = new THREE.SphereGeometry(0.26, 24, 16);

/** Invisible, slightly generous pointer target. The only raycastable mesh. */
export const HIT_GEOMETRY = new THREE.SphereGeometry(0.6, 12, 8);

/** Unit-height open cylinder; scaled on Y to reach PIN_HEIGHT. */
export const STEM_GEOMETRY = new THREE.CylinderGeometry(0.035, 0.035, 1, 8, 1, true);

export const HALO_GEOMETRY = new THREE.PlaneGeometry(2, 2);

function horizontalRing(inner: number, outer: number, segments: number) {
  const geometry = new THREE.RingGeometry(inner, outer, segments);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Anchor ring drawn flat at the sensor's exact coordinate. */
export const BASE_RING_GEOMETRY = horizontalRing(0.16, 0.26, 32);

/** Neutral selection ring, larger than the anchor ring. */
export const SELECTION_RING_GEOMETRY = (() => {
  const geometry = new THREE.TorusGeometry(0.52, 0.018, 8, 48);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
})();

export const SELECTION_BEAM_GEOMETRY = new THREE.CylinderGeometry(0.028, 0.028, 1, 8, 1, true);

/**
 * N concentric horizontal rings merged into a single geometry, each tagged with
 * an `aRing` attribute. The vertex shader expands each ring on its own phase,
 * so a full multi-ring shockwave costs one draw call and zero CPU work.
 */
function buildShockwaveGeometry(ringCount: number, segments = 64): THREE.BufferGeometry {
  const positions: number[] = [];
  const ringIndices: number[] = [];
  const indices: number[] = [];

  const inner = 0.86;
  const outer = 1.0;
  let vertexOffset = 0;

  for (let ring = 0; ring < ringCount; ring++) {
    for (let segment = 0; segment <= segments; segment++) {
      const angle = (segment / segments) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      positions.push(cos * inner, 0, sin * inner);
      positions.push(cos * outer, 0, sin * outer);
      ringIndices.push(ring, ring);
    }

    for (let segment = 0; segment < segments; segment++) {
      const a = vertexOffset + segment * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }

    vertexOffset += (segments + 1) * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aRing", new THREE.Float32BufferAttribute(ringIndices, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

const shockwaveCache = new Map<number, THREE.BufferGeometry>();

export function getShockwaveGeometry(ringCount: number): THREE.BufferGeometry {
  const count = Math.max(1, Math.round(ringCount));
  let geometry = shockwaveCache.get(count);
  if (!geometry) {
    geometry = buildShockwaveGeometry(count);
    shockwaveCache.set(count, geometry);
  }
  return geometry;
}

/**
 * Draws nothing but still takes part in raycasting, which is exactly what the
 * pointer hit-sphere needs. (`visible={false}` is unreliable here — three
 * treats visibility as a render concern, not a picking one.)
 */
export const HIT_MATERIAL = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  colorWrite: false,
  depthWrite: false,
});

export const SELECTION_RING_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#FFFFFF",
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  toneMapped: false,
});

export const SELECTION_BEAM_MATERIAL = new THREE.MeshBasicMaterial({
  color: "#FFFFFF",
  transparent: true,
  opacity: 0.1,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  toneMapped: false,
});

/** Assign to a mesh's `raycast` prop to remove it from pointer picking. */
export const NO_RAYCAST: THREE.Object3D["raycast"] = () => null;

/* -------------------------------------------------------------------------- */
/* Pointer cursor, reference counted across overlapping markers               */
/* -------------------------------------------------------------------------- */

let hoverCount = 0;

export function pushPointerCursor(): void {
  if (typeof document === "undefined") return;
  hoverCount += 1;
  document.body.style.cursor = "pointer";
}

export function popPointerCursor(): void {
  if (typeof document === "undefined") return;
  hoverCount = Math.max(0, hoverCount - 1);
  if (hoverCount === 0) document.body.style.cursor = "auto";
}
