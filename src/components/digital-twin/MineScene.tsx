"use client";

// ============================================================================
// digital-twin/MineScene.tsx
//
// Everything that lives INSIDE <Canvas>: lighting, the model-or-fallback
// terrain, bounded/animated camera, and the sensor placeholder layer. Kept
// separate from MineDigitalTwin.tsx so the Canvas wrapper, HUD and context
// providers stay uncluttered.
// ============================================================================

import { forwardRef, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import MineLighting from "./MineLighting";
import MineModel from "./MineModel";
import MineTerrain from "./MineTerrain";
import ModelErrorBoundary from "./ModelErrorBoundary";
import CameraController from "./CameraController";
import SensorPlaceholder from "./SensorPlaceholder";
import type { CameraPresetId, MineDigitalTwinHandle, SensorFrame } from "./types";

interface MineSceneProps {
  modelUrl: string;
  sensors: SensorFrame[];
  onSelectSensor?: (sensor: SensorFrame) => void;
  cameraPreset?: CameraPresetId;
  onPresetArrive?: (preset: CameraPresetId) => void;
}

const MineScene = forwardRef<MineDigitalTwinHandle, MineSceneProps>(function MineScene(
  { modelUrl, sensors, onSelectSensor, cameraPreset, onPresetArrive },
  ref
) {
  // Warm the GLB request as soon as the scene mounts; a no-op if the file
  // doesn't exist (ModelErrorBoundary handles the eventual rejection).
  useGLTF.preload(modelUrl);

  return (
    <>
      <color attach="background" args={["#0b0e12"]} />
      <fog attach="fog" args={["#0b0e12", 90, 260]} />

      <MineLighting />

      <ModelErrorBoundary fallback={<MineTerrain />}>
        <Suspense fallback={<MineTerrain />}>
          <MineModel url={modelUrl} />
        </Suspense>
      </ModelErrorBoundary>

      <SensorPlaceholder sensors={sensors} onSelectSensor={onSelectSensor} />

      <CameraController ref={ref} activePreset={cameraPreset} onPresetArrive={onPresetArrive} />
    </>
  );
});

export default MineScene;
