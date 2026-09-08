"use client";

// ============================================================================
// digital-twin/MineScene.tsx
//
// Everything that lives INSIDE <Canvas>: lighting, the model-or-fallback
// terrain, bounded/animated camera, and the sensor visualization layer. Kept
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
import { SensorMarkers, useSectorStates } from "./SensorMarkers";
import { SectorHighlight, type SectorHighlightMode } from "./SectorHighlight";
import { useModelAvailability } from "./useModelAvailability";
import type { CameraPresetId, MineDigitalTwinHandle, SensorFrame } from "./types";

interface MineSceneProps {
  modelUrl: string;
  sensors: SensorFrame[];
  selectedSensor?: SensorFrame | null;
  onSelectSensor?: (sensor: SensorFrame) => void;
  onHoverSensor?: (sensor: SensorFrame | null) => void;
  cameraPreset?: CameraPresetId;
  onPresetArrive?: (preset: CameraPresetId) => void;
  markerScale?: number;
  showTooltips?: boolean;
  emitLights?: boolean;
  highlightSectors?: boolean;
  sectorHighlightMode?: SectorHighlightMode;
}

const MineScene = forwardRef<MineDigitalTwinHandle, MineSceneProps>(function MineScene(
  {
    modelUrl,
    sensors,
    selectedSensor = null,
    onSelectSensor,
    onHoverSensor,
    cameraPreset,
    onPresetArrive,
    markerScale = 1,
    showTooltips = true,
    emitLights = false,
    highlightSectors = true,
    sectorHighlightMode = "overlay",
  },
  ref
) {
  const sectorStates = useSectorStates(sensors);

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

  return (
    <>
      <color attach="background" args={["#0b0e12"]} />
      <fog attach="fog" args={["#0b0e12", 90, 260]} />

      <MineLighting />

      {modelAvailable ? (
        <ModelErrorBoundary fallback={<MineTerrain />}>
          <Suspense fallback={<MineTerrain />}>
            <MineModel url={modelUrl} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        <MineTerrain />
      )}

      <SensorMarkers
        sensors={sensors}
        selectedSensor={selectedSensor}
        onSelectSensor={onSelectSensor ?? (() => {})}
        onHoverSensor={onHoverSensor}
        markerScale={markerScale}
        showTooltips={showTooltips}
        emitLights={emitLights}
      />

      {highlightSectors && (
        <SectorHighlight sectorStates={sectorStates} mode={sectorHighlightMode} />
      )}

      <CameraController ref={ref} activePreset={cameraPreset} onPresetArrive={onPresetArrive} />
    </>
  );
});

export default MineScene;
