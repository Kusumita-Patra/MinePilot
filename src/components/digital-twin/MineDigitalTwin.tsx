"use client";

// ============================================================================
// digital-twin/MineDigitalTwin.tsx
//
// Public entry point for the 3D environment & camera module.
//
//   <MineDigitalTwin
//     sensors={sensorList}
//     selectedSensor={selected}
//     onSelectSensor={setSelected}
//   />
//
// This is what replaces the placeholder currently rendered inside
// <MineDigitalTwinContainer> on the dashboard page. It owns the <Canvas>,
// the sector registry (kept outside the Canvas so both R3F code and any
// future non-R3F UI can read it), and a small camera-preset HUD.
// ============================================================================

import { forwardRef, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import clsx from "clsx";
import { SectorRegistryProvider } from "./SectorRegistry";
import MineScene from "./MineScene";
import { cameraPresetList, cameraPresets, DEFAULT_CAMERA_PRESET } from "./sectors";
import type { CameraPresetId, MineDigitalTwinHandle, MineDigitalTwinProps } from "./types";

const DEFAULT_MODEL_URL = "/models/mine.glb";

const MineDigitalTwin = forwardRef<MineDigitalTwinHandle, MineDigitalTwinProps>(
  function MineDigitalTwin(
    {
      sensors = [],
      // `selectedSensor` is part of the shared contract (for the sensor layer
      // to drive selection-highlight visuals) but this module doesn't read it
      // itself — accepted here only so the prop type-checks for callers.
      onSelectSensor,
      cameraPreset,
      onCameraPresetChange,
      modelUrl = DEFAULT_MODEL_URL,
      showPresetControls = true,
      className,
    },
    ref
  ) {
    // Uncontrolled fallback so the HUD works even if the parent doesn't
    // manage camera state itself.
    const [internalPreset, setInternalPreset] = useState<CameraPresetId>(DEFAULT_CAMERA_PRESET);
    const effectivePreset = cameraPreset ?? internalPreset;

    const handlePresetClick = useCallback(
      (id: CameraPresetId) => {
        setInternalPreset(id);
        onCameraPresetChange?.(id);
      },
      [onCameraPresetChange]
    );

    return (
      <SectorRegistryProvider>
        <div className={clsx("relative w-full h-full min-h-[420px]", className)}>
          <Canvas
            shadows
            dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            camera={{
              position: cameraPresets[DEFAULT_CAMERA_PRESET].position,
              fov: 50,
              near: 0.1,
              far: 1000,
            }}
          >
            <MineScene
              ref={ref}
              modelUrl={modelUrl}
              sensors={sensors}
              onSelectSensor={onSelectSensor}
              cameraPreset={effectivePreset}
              onPresetArrive={(id) => {
                if (cameraPreset === undefined) setInternalPreset(id);
              }}
            />
          </Canvas>

          {showPresetControls && (
            <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-10">
              {cameraPresetList.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset.id)}
                  className={clsx(
                    "px-2.5 py-1.5 rounded-md text-[11px] font-medium border transition-colors backdrop-blur-sm",
                    effectivePreset === preset.id
                      ? "bg-blue-600 border-blue-500 text-white"
                      : "bg-neutral-900/70 border-white/10 text-neutral-300 hover:bg-neutral-800/80 hover:text-white"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </SectorRegistryProvider>
    );
  }
);

export default MineDigitalTwin;
