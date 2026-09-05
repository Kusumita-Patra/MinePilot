"use client";

// ============================================================================
// digital-twin/CameraController.tsx
//
// Bounded orbit navigation + smooth camera-preset transitions.
//
// - OrbitControls: damped, zoom-clamped, pitch-clamped, and pan is bounded to
//   a horizontal radius + vertical band around the pit (so panning is
//   "reasonable" rather than either disabled or unlimited).
// - Preset transitions: exponential-decay interpolation of both camera
//   position and orbit target (framerate-independent, no easing library
//   needed — see `dampVector` below). Swap this for @react-spring/three
//   later if you want spring physics instead; the imperative API
//   (`flyToPreset` / `flyToPoint`) stays the same either way.
// ============================================================================

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3 } from "three";
import { cameraPresets, DEFAULT_CAMERA_PRESET, ORBIT_BOUNDS } from "./sectors";
import { FLOOR_Y, MINE_LAYOUT } from "./mineLayout";
import type { CameraPresetId, MineDigitalTwinHandle } from "./types";

// How quickly the camera "catches up" to its transition target. Higher =
// snappier, lower = more floaty. Framerate-independent thanks to the
// exp(-lambda*dt) formulation below.
const TRANSITION_LAMBDA = 3.2;
const ARRIVAL_EPSILON = 0.05;

const PAN_MAX_RADIUS = MINE_LAYOUT.terrainRadius * 0.55;
const PAN_MIN_Y = FLOOR_Y - 10;
const PAN_MAX_Y = 40;

interface CameraControllerProps {
  activePreset?: CameraPresetId;
  onPresetArrive?: (preset: CameraPresetId) => void;
}

const CameraController = forwardRef<MineDigitalTwinHandle, CameraControllerProps>(
  function CameraController({ activePreset, onPresetArrive }, ref) {
    const { camera } = useThree();
    const controlsRef = useRef<OrbitControlsImpl>(null);

    const transition = useRef<{
      active: boolean;
      targetPosition: Vector3;
      targetLookAt: Vector3;
      arrivingPreset: CameraPresetId | null;
    }>({
      active: false,
      targetPosition: new Vector3(),
      targetLookAt: new Vector3(),
      arrivingPreset: null,
    });

    const beginTransition = (
      position: [number, number, number],
      target: [number, number, number],
      preset: CameraPresetId | null = null
    ) => {
      transition.current.targetPosition.set(...position);
      transition.current.targetLookAt.set(...target);
      transition.current.arrivingPreset = preset;
      transition.current.active = true;
      // Let the animation drive the camera without orbit-drag fighting it.
      if (controlsRef.current) controlsRef.current.enabled = false;
    };

    useImperativeHandle(
      ref,
      (): MineDigitalTwinHandle => ({
        flyToPreset: (presetId) => {
          const preset = cameraPresets[presetId];
          if (!preset) return;
          beginTransition(preset.position, preset.target, presetId);
        },
        flyToPoint: (position, target) => beginTransition(position, target, null),
      }),
      []
    );

    // Controlled usage: fly whenever the parent changes `activePreset`.
    const lastAppliedPreset = useRef<CameraPresetId | undefined>(undefined);
    useEffect(() => {
      if (!activePreset || activePreset === lastAppliedPreset.current) return;
      lastAppliedPreset.current = activePreset;
      const preset = cameraPresets[activePreset];
      if (preset) beginTransition(preset.position, preset.target, activePreset);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePreset]);

    // Initial framing on mount.
    useEffect(() => {
      const preset = cameraPresets[DEFAULT_CAMERA_PRESET];
      camera.position.set(...preset.position);
      controlsRef.current?.target.set(...preset.target);
      controlsRef.current?.update();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useFrame((_, delta) => {
      const controls = controlsRef.current;
      if (!controls) return;

      if (transition.current.active) {
        const alpha = 1 - Math.exp(-TRANSITION_LAMBDA * delta);
        camera.position.lerp(transition.current.targetPosition, alpha);
        controls.target.lerp(transition.current.targetLookAt, alpha);

        const positionDone = camera.position.distanceTo(transition.current.targetPosition) < ARRIVAL_EPSILON;
        const targetDone = controls.target.distanceTo(transition.current.targetLookAt) < ARRIVAL_EPSILON;

        if (positionDone && targetDone) {
          camera.position.copy(transition.current.targetPosition);
          controls.target.copy(transition.current.targetLookAt);
          transition.current.active = false;
          controls.enabled = true;
          if (transition.current.arrivingPreset) onPresetArrive?.(transition.current.arrivingPreset);
        }
      }

      // Bounded panning: clamp the orbit target to a horizontal radius and
      // vertical band around the mine, regardless of transitions vs. free
      // user drag. Prevents the user from panning off into the void.
      const t = controls.target;
      const horizontalDist = Math.hypot(t.x, t.z);
      if (horizontalDist > PAN_MAX_RADIUS) {
        const scale = PAN_MAX_RADIUS / horizontalDist;
        t.x *= scale;
        t.z *= scale;
      }
      t.y = Math.min(PAN_MAX_Y, Math.max(PAN_MIN_Y, t.y));

      controls.update();
    });

    return (
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={ORBIT_BOUNDS.minDistance}
        maxDistance={ORBIT_BOUNDS.maxDistance}
        minPolarAngle={ORBIT_BOUNDS.minPolarAngle}
        maxPolarAngle={ORBIT_BOUNDS.maxPolarAngle}
        enablePan
        screenSpacePanning={false}
      />
    );
  }
);

export default CameraController;
