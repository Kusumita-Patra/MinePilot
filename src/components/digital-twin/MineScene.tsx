"use client";

// ============================================================================
// digital-twin/MineScene.tsx
//
// Everything that lives INSIDE <Canvas>: lighting, the model-or-fallback
// terrain, bounded/animated camera, and the sensor placeholder layer. Kept
// separate from MineDigitalTwin.tsx so the Canvas wrapper, HUD and context
// providers stay uncluttered.
// ============================================================================

import { forwardRef, Suspense, useImperativeHandle, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import MineLighting from "./MineLighting";
import MineModel from "./MineModel";
import MineTerrain from "./MineTerrain";
import ModelErrorBoundary from "./ModelErrorBoundary";
import CameraController from "./CameraController";
import SensorPlaceholder from "./SensorPlaceholder";
import { useModelAvailability } from "./useModelAvailability";
import type { BlueprintTunnelSection, CameraPresetId, MineDigitalTwinHandle, SensorFrame } from "./types";

interface MineSceneProps {
  modelUrl: string;
  sensors: SensorFrame[];
  blueprintSections?: BlueprintTunnelSection[];
  onSelectSensor?: (sensor: SensorFrame) => void;
  cameraPreset?: CameraPresetId;
  onPresetArrive?: (preset: CameraPresetId) => void;
}

const MineScene = forwardRef<MineDigitalTwinHandle, MineSceneProps>(function MineScene(
  { modelUrl, sensors, blueprintSections, onSelectSensor, cameraPreset, onPresetArrive },
  ref
) {
  // Check the model actually exists before ever calling useGLTF: it throws
  // a rejected promise on a 404 (only catchable by ModelErrorBoundary below),
  // and Next's dev overlay reports every boundary-caught error regardless of
  // how gracefully the app recovers. A checkout without mine.glb yet (see
  // public/models/README.txt) is an expected case, not a bug to surface.
  const modelAvailable = useModelAvailability(modelUrl);

  if (modelAvailable) {
    // Only warm the GLB request once we know it will resolve.
    useGLTF.preload(modelUrl);
  }

  // A local ref to the camera's imperative handle — forwarded out to the
  // caller's own `ref` below, and also used directly here so a tunnel click
  // (bubbled up from MineTerrain) can trigger a camera focus without the
  // caller having to wire that up itself.
  const cameraRef = useRef<MineDigitalTwinHandle>(null);
  useImperativeHandle(
    ref,
    (): MineDigitalTwinHandle => ({
      flyToPreset: (id) => cameraRef.current?.flyToPreset(id),
      flyToPoint: (position, target) => cameraRef.current?.flyToPoint(position, target),
      zoomBy: (factor) => cameraRef.current?.zoomBy(factor),
      focusPoint: (point) => cameraRef.current?.focusPoint(point),
      rotateBy: (deltaAzimuth, deltaPolar) => cameraRef.current?.rotateBy(deltaAzimuth, deltaPolar),
    }),
    []
  );

  const handleSelectTunnel = (point: [number, number, number]) => {
    cameraRef.current?.focusPoint(point);
  };

  return (
    <>
      <color attach="background" args={["#050a14"]} />
      <fog attach="fog" args={["#050a14", 160, 520]} />

      <MineLighting />

      {modelAvailable ? (
        <ModelErrorBoundary
          fallback={
            <MineTerrain sensors={sensors} blueprintSections={blueprintSections} onSelectTunnel={handleSelectTunnel} />
          }
        >
          <Suspense
            fallback={
              <MineTerrain
                sensors={sensors}
                blueprintSections={blueprintSections}
                onSelectTunnel={handleSelectTunnel}
              />
            }
          >
            <MineModel url={modelUrl} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <MineTerrain sensors={sensors} blueprintSections={blueprintSections} onSelectTunnel={handleSelectTunnel} />
      )}

      <SensorPlaceholder sensors={sensors} onSelectSensor={onSelectSensor} />

      <CameraController ref={cameraRef} activePreset={cameraPreset} onPresetArrive={onPresetArrive} />
    </>
  );
});

export default MineScene;
