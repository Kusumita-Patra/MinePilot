"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { getRiskColorObject } from "./sensorUtils";
import type { RiskLevel, SectorState, SectorStates } from "./types";

/**
 * Tints the mine's sector meshes according to the aggregated risk of the
 * sensors reporting into them.
 *
 * This component never rebuilds, replaces or permanently modifies the mine
 * environment. In the default "overlay" mode it adds a child mesh that reuses
 * the target's own geometry and renders an additive tint on top of it — the
 * original material is not touched at all, and everything is removed on
 * unmount.
 */

export type SectorHighlightMode = "overlay" | "emissive";

export interface SectorHighlightProps {
  /** One state per sector. Build it with useSectorStates(sensors). */
  sectorStates: SectorStates;

  /**
   * Where to look for sector meshes. Defaults to the whole scene, which is
   * usually what you want — pass a ref'd group to narrow the search.
   */
  root?: THREE.Object3D | null;

  /**
   * How a mesh declares which sector it belongs to. The default accepts
   * `userData.sectorId`, `userData.sector_id`, or a name beginning with
   * "sector_", and walks up the parents so a GLB group can tag its children.
   */
  resolveSectorId?: (object: THREE.Object3D) => string | undefined;

  mode?: SectorHighlightMode;

  /** Peak tint strength in overlay mode. */
  opacity?: number;

  /** Breathe the tint so an alarming sector reads as live. Default true. */
  pulse?: boolean;

  /** Change this value to force a re-scan (e.g. after swapping mine models). */
  rescanKey?: string | number;
}

interface EmissiveBackup {
  material: THREE.MeshStandardMaterial;
  emissive: THREE.Color;
  intensity: number;
}

interface SectorBinding {
  sectorId: string;
  level: RiskLevel;
  material: THREE.MeshBasicMaterial | null;
  overlays: THREE.Mesh[];
  emissiveTargets: EmissiveBackup[];
}

const MAX_SCAN_ATTEMPTS = 20;
const OVERLAY_FLAG = "__sectorHighlight";

/** Default mesh -> sector_id resolution. */
export function defaultResolveSectorId(object: THREE.Object3D): string | undefined {
  const data = object.userData as
    | { sectorId?: unknown; sector_id?: unknown }
    | undefined;

  if (typeof data?.sectorId === "string") return data.sectorId;
  if (typeof data?.sector_id === "string") return data.sector_id;
  if (object.name && object.name.startsWith("sector_")) return object.name;
  return undefined;
}

function resolveThroughAncestors(
  object: THREE.Object3D,
  resolve: (object: THREE.Object3D) => string | undefined,
  root: THREE.Object3D,
): string | undefined {
  let current: THREE.Object3D | null = object;
  let depth = 0;

  while (current && depth < 8) {
    const id = resolve(current);
    if (id) return id;
    if (current === root) break;
    current = current.parent;
    depth += 1;
  }

  return undefined;
}

function createOverlayMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

export function SectorHighlight({
  sectorStates,
  root = null,
  resolveSectorId,
  mode = "overlay",
  opacity = 0.28,
  pulse = true,
  rescanKey,
}: SectorHighlightProps) {
  const scene = useThree((state) => state.scene);
  const searchRoot = root ?? scene;

  const bindingsRef = useRef<Map<string, SectorBinding>>(new Map());
  const attemptsRef = useRef(0);
  const [scanAttempt, setScanAttempt] = useState(0);

  const resolveRef = useRef(resolveSectorId);
  resolveRef.current = resolveSectorId;

  const opacityRef = useRef(opacity);
  opacityRef.current = opacity;

  const pulseRef = useRef(pulse);
  pulseRef.current = pulse;

  // Stable dependency: the set of sector ids changes rarely, telemetry changes
  // constantly. Binding must only re-run for the former.
  const sectorKey = useMemo(
    () => Object.keys(sectorStates).sort().join("|"),
    [sectorStates],
  );

  /* ---------------------------------------------------------------------- */
  /* Bind: find the sector meshes and attach tint overlays                   */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const bindings = new Map<string, SectorBinding>();
    const wanted = new Set(sectorKey ? sectorKey.split("|") : []);

    if (wanted.size === 0 || !searchRoot) {
      bindingsRef.current = bindings;
      return;
    }

    const resolve = resolveRef.current ?? defaultResolveSectorId;

    // Collect first, mutate afterwards: attaching overlays during traverse
    // would feed them straight back into the same walk.
    const targets: { mesh: THREE.Mesh; sectorId: string }[] = [];

    searchRoot.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (object.userData?.[OVERLAY_FLAG]) return;

      const sectorId = resolveThroughAncestors(object, resolve, searchRoot);
      if (!sectorId || !wanted.has(sectorId)) return;

      targets.push({ mesh, sectorId });
    });

    for (const { mesh, sectorId } of targets) {
      let binding = bindings.get(sectorId);
      if (!binding) {
        binding = {
          sectorId,
          level: "NORMAL",
          material: null,
          overlays: [],
          emissiveTargets: [],
        };
        bindings.set(sectorId, binding);
      }

      if (mode === "overlay") {
        // Instanced and skinned meshes cannot be mirrored by a plain Mesh.
        if ((mesh as unknown as { isInstancedMesh?: boolean }).isInstancedMesh) continue;
        if ((mesh as unknown as { isSkinnedMesh?: boolean }).isSkinnedMesh) continue;

        if (!binding.material) binding.material = createOverlayMaterial();

        const overlay = new THREE.Mesh(mesh.geometry, binding.material);
        overlay.name = `sector-highlight:${sectorId}`;
        overlay.userData[OVERLAY_FLAG] = true;
        overlay.raycast = () => null;
        overlay.renderOrder = 4;
        overlay.frustumCulled = mesh.frustumCulled;
        overlay.visible = false;

        // Added as a child with an identity transform, so it inherits the
        // target's world matrix and stays aligned for free.
        mesh.add(overlay);
        binding.overlays.push(overlay);
      } else {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          const standard = material as THREE.MeshStandardMaterial;
          if (!standard || !standard.isMeshStandardMaterial) continue;
          binding.emissiveTargets.push({
            material: standard,
            emissive: standard.emissive.clone(),
            intensity: standard.emissiveIntensity,
          });
        }
      }
    }

    bindingsRef.current = bindings;

    return () => {
      for (const binding of bindings.values()) {
        for (const overlay of binding.overlays) overlay.parent?.remove(overlay);
        binding.material?.dispose();
        for (const backup of binding.emissiveTargets) {
          backup.material.emissive.copy(backup.emissive);
          backup.material.emissiveIntensity = backup.intensity;
        }
      }
      bindingsRef.current = new Map();
    };
  }, [searchRoot, sectorKey, mode, rescanKey, scanAttempt]);

  /* ---------------------------------------------------------------------- */
  /* Retry while nothing is bound — the mine GLB may still be loading        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    attemptsRef.current = 0;
  }, [searchRoot, sectorKey, mode, rescanKey]);

  useEffect(() => {
    if (bindingsRef.current.size > 0) return;
    if (!sectorKey || attemptsRef.current >= MAX_SCAN_ATTEMPTS) return;

    const timer = window.setInterval(() => {
      if (bindingsRef.current.size > 0 || attemptsRef.current >= MAX_SCAN_ATTEMPTS) {
        window.clearInterval(timer);
        return;
      }
      attemptsRef.current += 1;
      setScanAttempt((value) => value + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [scanAttempt, sectorKey, mode, searchRoot, rescanKey]);

  /* ---------------------------------------------------------------------- */
  /* Apply: risk level -> tint                                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    for (const [sectorId, binding] of bindingsRef.current) {
      const level: RiskLevel = sectorStates[sectorId]?.risk_level ?? "NORMAL";
      binding.level = level;
      const alarming = level !== "NORMAL";

      if (binding.material) {
        binding.material.color.copy(getRiskColorObject(level));
        binding.material.opacity = alarming ? opacity : 0;
        for (const overlay of binding.overlays) overlay.visible = alarming;
      }

      for (const backup of binding.emissiveTargets) {
        if (alarming) {
          backup.material.emissive.copy(getRiskColorObject(level));
          backup.material.emissiveIntensity = level === "CRITICAL" ? 0.9 : 0.5;
        } else {
          backup.material.emissive.copy(backup.emissive);
          backup.material.emissiveIntensity = backup.intensity;
        }
      }
    }
  }, [sectorStates, opacity, scanAttempt]);

  /* ---------------------------------------------------------------------- */
  /* One frame callback for every sector's breathing tint                    */
  /* ---------------------------------------------------------------------- */

  useFrame((state) => {
    if (!pulseRef.current) return;

    const bindings = bindingsRef.current;
    if (bindings.size === 0) return;

    const time = state.clock.elapsedTime;
    const critical = 0.55 + 0.45 * Math.sin(time * 6);
    const warning = 0.7 + 0.3 * Math.sin(time * 2.5);

    for (const binding of bindings.values()) {
      if (!binding.material || binding.level === "NORMAL") continue;
      binding.material.opacity =
        opacityRef.current * (binding.level === "CRITICAL" ? critical : warning);
    }
  });

  return null;
}

/**
 * Single-sector convenience wrapper:
 *
 *   <SectorTint sectorId="sector_north_wall" riskLevel="WARNING" />
 */
export interface SectorTintProps
  extends Omit<SectorHighlightProps, "sectorStates"> {
  sectorId: string;
  riskLevel: RiskLevel;
}

export function SectorTint({ sectorId, riskLevel, ...rest }: SectorTintProps) {
  const sectorStates = useMemo<SectorStates>(() => {
    const state: SectorState = {
      sector_id: sectorId,
      risk_level: riskLevel,
      max_risk_score: 0,
      sensor_count: 0,
      warning_count: riskLevel === "WARNING" ? 1 : 0,
      critical_count: riskLevel === "CRITICAL" ? 1 : 0,
      worst_sensor_id: null,
    };
    return { [sectorId]: state };
  }, [sectorId, riskLevel]);

  return <SectorHighlight sectorStates={sectorStates} {...rest} />;
}
