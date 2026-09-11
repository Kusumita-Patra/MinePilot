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
import { Fog, MOUSE, Spherical, TOUCH, Vector3 } from "three";
import { cameraPresets, DEFAULT_CAMERA_PRESET, ORBIT_BOUNDS } from "./sectors";
import { FLOOR_Y, MINE_LAYOUT } from "./mineLayout";
import type { CameraPresetId, MineDigitalTwinHandle } from "./types";

// How quickly the camera "catches up" to its transition target. Higher =
// snappier, lower = more floaty. Framerate-independent thanks to the
// exp(-lambda*dt) formulation below.
const TRANSITION_LAMBDA = 3.2;
const ARRIVAL_EPSILON = 0.05;

// The network now spans the whole terrain disc, so panning needs to reach
// nearly all of it — not just a tight radius around the shaft — for a drag
// to actually "see the whole view" rather than hitting an invisible wall
// partway across.
const PAN_MAX_RADIUS = MINE_LAYOUT.terrainRadius * 0.95;
const PAN_MIN_Y = FLOOR_Y - 10;
const PAN_MAX_Y = 40;

interface CameraControllerProps {
  activePreset?: CameraPresetId;
  onPresetArrive?: (preset: CameraPresetId) => void;
}

const CameraController = forwardRef<MineDigitalTwinHandle, CameraControllerProps>(
  function CameraController({ activePreset, onPresetArrive }, ref) {
    const { camera, scene } = useThree();
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
        zoomBy: (factor) => {
          const controls = controlsRef.current;
          if (!controls) return;
          const target = controls.target;
          const offset = camera.position.clone().sub(target);
          const newDistance = Math.min(
            ORBIT_BOUNDS.maxDistance,
            Math.max(ORBIT_BOUNDS.minDistance, offset.length() * factor)
          );
          offset.setLength(newDistance);
          const newPosition = target.clone().add(offset);
          beginTransition([newPosition.x, newPosition.y, newPosition.z], [target.x, target.y, target.z], null);
        },
        rotateBy: (deltaAzimuth, deltaPolar) => {
          const controls = controlsRef.current;
          if (!controls) return;
          const target = controls.target;
          const offset = camera.position.clone().sub(target);
          const spherical = new Spherical().setFromVector3(offset);
          spherical.theta += deltaAzimuth;
          spherical.phi = Math.min(
            ORBIT_BOUNDS.maxPolarAngle,
            Math.max(ORBIT_BOUNDS.minPolarAngle, spherical.phi + deltaPolar)
          );
          spherical.makeSafe();
          const newOffset = new Vector3().setFromSpherical(spherical);
          const newPosition = target.clone().add(newOffset);
          beginTransition([newPosition.x, newPosition.y, newPosition.z], [target.x, target.y, target.z], null);
        },
        focusPoint: (point) => {
          const targetPoint = new Vector3(...point);
          // Keep whatever direction the user is currently looking from, just
          // pull the camera in close along it — reads as "zoom into what I
          // clicked" rather than snapping to some unrelated fixed angle.
          const currentDir = camera.position.clone().sub(controlsRef.current?.target ?? targetPoint);
          const dir = currentDir.lengthSq() > 1e-6 ? currentDir.normalize() : new Vector3(0.6, 0.5, 0.6).normalize();
          const focusDistance = Math.max(ORBIT_BOUNDS.minDistance * 3, 40);
          const newPosition = targetPoint.clone().add(dir.multiplyScalar(focusDistance));
          beginTransition(
            [newPosition.x, newPosition.y, newPosition.z],
            [targetPoint.x, targetPoint.y, targetPoint.z],
            null
          );
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [camera]
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

      // Keep the fog's far plane ahead of whatever is actually visible,
      // scaled to the camera's current zoom distance. A fixed far plane
      // fogs out the whole terrain once the camera zooms past it (the far
      // side of the ~520-radius network can be up to
      // distanceToTarget + terrainRadius away from the camera), which read
      // as the view going dark/empty when zoomed out. `near` scales down
      // too so close-up detail doesn't get hazy at tight zoom levels.
      const fog = scene.fog;
      if (fog instanceof Fog) {
        const distanceToTarget = camera.position.distanceTo(controls.target);
        fog.near = Math.max(20, distanceToTarget * 0.2);
        fog.far = distanceToTarget + MINE_LAYOUT.terrainRadius + 150;
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
        panSpeed={1.3}
        // The mine now spans a huge area, so the primary "just drag" gesture
        // pans across it (like sliding a map) instead of orbiting in place —
        // orbiting moves to the right mouse button / two-finger touch, still
        // reachable but no longer the default single-drag action.
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
      />
    );
  }
);

export default CameraController;
