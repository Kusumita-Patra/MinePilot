import * as THREE from "three";

import { RISK_EFFECTS, RISK_LEVELS, getRiskColorObject } from "./sensorUtils";
import type { RiskLevel } from "./types";

/**
 * There are exactly three of each material — one per risk level — shared by
 * every marker in the scene. A single `useFrame` (see <RiskEffectClock />)
 * advances their uniforms once per frame, so adding sensors adds draw calls but
 * no additional per-frame JavaScript.
 *
 * The side effect is that all markers at the same risk level pulse in unison.
 * That is intentional: a synchronized alarm reads as a system-wide state, not a
 * collection of unrelated blinking dots.
 */

/* -------------------------------------------------------------------------- */
/* Halo shader — GPU billboarded radial pulse                                 */
/* -------------------------------------------------------------------------- */

/**
 * Billboarding happens in the vertex shader: the quad's origin is transformed
 * into view space and the corners are offset on the view plane. No per-frame
 * quaternion copy, no CPU cost, always camera-facing.
 */
const HALO_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uFrequency;
  uniform float uBreathe;

  varying vec2 vUv;

  void main() {
    vUv = uv;

    // Expand and contract on the level's pulse frequency.
    float breathe = 1.0 + sin(uTime * uFrequency) * uBreathe;

    // Honour any scale applied by the marker group (including hover growth).
    float worldScale = length(modelMatrix[0].xyz);

    vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    mvPosition.xy += position.xy * uScale * breathe * worldScale;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const HALO_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uFrequency;
  uniform float uIntensity;
  uniform float uRingCount;

  varying vec2 vUv;

  void main() {
    vec2 centered = vUv - 0.5;
    float dist = length(centered) * 2.0;
    if (dist > 1.0) discard;

    // Soft radial falloff.
    float core = pow(1.0 - dist, 2.5);
    float breathe = 0.65 + 0.35 * sin(uTime * uFrequency);

    // Rings travelling outward from the centre.
    float wave = fract(dist * uRingCount - uTime * uFrequency * 0.25);
    float ring = smoothstep(0.0, 0.25, wave) * (1.0 - smoothstep(0.25, 0.65, wave));
    ring *= 1.0 - smoothstep(0.25, 1.0, dist);
    ring *= step(0.5, uRingCount);

    float alpha = (core * 0.5 * breathe + ring * 0.75) * uIntensity;

    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));

    // three.js r152+. On r151 and older use <encodings_fragment> instead.
    #include <colorspace_fragment>
  }
`;

/* -------------------------------------------------------------------------- */
/* Shockwave shader — expanding ground rings, one draw call                   */
/* -------------------------------------------------------------------------- */

const SHOCKWAVE_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uMaxRadius;
  uniform float uRingCount;
  uniform float uOpacity;

  attribute float aRing;

  varying float vAlpha;

  void main() {
    // Each ring in the merged geometry runs on its own phase offset.
    float phase = fract(uTime * uSpeed + aRing / max(uRingCount, 1.0));
    float radius = mix(0.35, uMaxRadius, phase);

    float fade = 1.0 - phase;
    vAlpha = fade * fade * uOpacity;

    vec3 expanded = vec3(position.x * radius, position.y, position.z * radius);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(expanded, 1.0);
  }
`;

const SHOCKWAVE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;

  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uColor, vAlpha);

    #include <colorspace_fragment>
  }
`;

/* -------------------------------------------------------------------------- */
/* Material set                                                               */
/* -------------------------------------------------------------------------- */

export interface RiskMaterialSet {
  core: Record<RiskLevel, THREE.MeshStandardMaterial>;
  halo: Record<RiskLevel, THREE.ShaderMaterial>;
  shockwave: Record<RiskLevel, THREE.ShaderMaterial>;
  stem: Record<RiskLevel, THREE.MeshBasicMaterial>;
  base: Record<RiskLevel, THREE.MeshBasicMaterial>;
}

function createCoreMaterial(level: RiskLevel): THREE.MeshStandardMaterial {
  const color = getRiskColorObject(level);
  return new THREE.MeshStandardMaterial({
    color: color.clone(),
    emissive: color.clone(),
    emissiveIntensity: RISK_EFFECTS[level].emissiveBase,
    roughness: 0.3,
    metalness: 0.15,
    toneMapped: false,
  });
}

function createHaloMaterial(level: RiskLevel): THREE.ShaderMaterial {
  const config = RISK_EFFECTS[level];
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: getRiskColorObject(level).clone() },
      uScale: { value: config.haloRadius },
      uFrequency: { value: config.pulseSpeed },
      uBreathe: { value: config.scaleAmplitude },
      uIntensity: { value: config.haloIntensity },
      uRingCount: { value: config.haloRingCount },
    },
    vertexShader: HALO_VERTEX_SHADER,
    fragmentShader: HALO_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function createShockwaveMaterial(level: RiskLevel): THREE.ShaderMaterial {
  const config = RISK_EFFECTS[level];
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: getRiskColorObject(level).clone() },
      uSpeed: { value: config.shockwaveSpeed },
      uMaxRadius: { value: config.shockwaveRadius },
      uRingCount: { value: Math.max(1, config.shockwaveCount) },
      uOpacity: { value: config.shockwaveOpacity },
    },
    vertexShader: SHOCKWAVE_VERTEX_SHADER,
    fragmentShader: SHOCKWAVE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function createStemMaterial(level: RiskLevel): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: getRiskColorObject(level).clone(),
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function createBaseMaterial(level: RiskLevel): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: getRiskColorObject(level).clone(),
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function byLevel<T>(factory: (level: RiskLevel) => T): Record<RiskLevel, T> {
  return {
    NORMAL: factory("NORMAL"),
    WARNING: factory("WARNING"),
    CRITICAL: factory("CRITICAL"),
  };
}

let materials: RiskMaterialSet | null = null;

/** Lazily built once, then reused by every marker for the app's lifetime. */
export function getRiskMaterials(): RiskMaterialSet {
  if (!materials) {
    materials = {
      core: byLevel(createCoreMaterial),
      halo: byLevel(createHaloMaterial),
      shockwave: byLevel(createShockwaveMaterial),
      stem: byLevel(createStemMaterial),
      base: byLevel(createBaseMaterial),
    };
  }
  return materials;
}

/**
 * Advances every animated uniform. Called exactly once per frame regardless of
 * how many sensors are on screen.
 */
export function updateRiskMaterials(elapsed: number): void {
  const set = getRiskMaterials();

  for (const level of RISK_LEVELS) {
    const config = RISK_EFFECTS[level];
    if (config.pulseSpeed <= 0) continue; // NORMAL stays perfectly steady.

    set.halo[level].uniforms.uTime.value = elapsed;
    set.shockwave[level].uniforms.uTime.value = elapsed;
    set.core[level].emissiveIntensity =
      config.emissiveBase + Math.sin(elapsed * config.pulseSpeed) * config.emissiveAmplitude;
  }
}

/** Only needed for teardown in tests or hot-reload edge cases. */
export function disposeRiskMaterials(): void {
  if (!materials) return;

  const sets = [
    materials.core,
    materials.halo,
    materials.shockwave,
    materials.stem,
    materials.base,
  ];

  for (const set of sets) {
    for (const level of RISK_LEVELS) {
      (set[level] as THREE.Material).dispose();
    }
  }

  materials = null;
}
