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

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ZoomIn, ZoomOut } from "lucide-react";
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
      blueprintSections = [],
      // `selectedSensor` drives selection-highlight visuals in the sensor
      // layer (MineScene / the sensor-visualization side) — this component
      // just threads it through, it doesn't read it itself.
      selectedSensor = null,
      onSelectSensor,
      onHoverSensor,
      cameraPreset,
      onCameraPresetChange,
      modelUrl = DEFAULT_MODEL_URL,
      showPresetControls = true,
      className,
      children,
      markerScale,
      showTooltips,
      emitLights,
      highlightSectors,
      sectorHighlightMode,
      canvasProps,
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

    // A local ref to the imperative camera handle, kept in addition to (and
    // forwarded through) the caller's own `ref` — the zoom buttons below are
    // part of this component's own HUD, so they need direct access too.
    const cameraHandleRef = useRef<MineDigitalTwinHandle>(null);
    useImperativeHandle(
      ref,
      (): MineDigitalTwinHandle => ({
        flyToPreset: (id) => cameraHandleRef.current?.flyToPreset(id),
        flyToPoint: (position, target) => cameraHandleRef.current?.flyToPoint(position, target),
        zoomBy: (factor) => cameraHandleRef.current?.zoomBy(factor),
        focusPoint: (point) => cameraHandleRef.current?.focusPoint(point),
        rotateBy: (deltaAzimuth, deltaPolar) => cameraHandleRef.current?.rotateBy(deltaAzimuth, deltaPolar),
      }),
      []
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
              fov: 58,
              near: 0.1,
              far: 1200,
            }}
            {...canvasProps}
          >
            <MineScene
              ref={cameraHandleRef}
              modelUrl={modelUrl}
              sensors={sensors}
              blueprintSections={blueprintSections}
              selectedSensor={selectedSensor}
              onSelectSensor={onSelectSensor}
              onHoverSensor={onHoverSensor}
              cameraPreset={effectivePreset}
              onPresetArrive={(id) => {
                if (cameraPreset === undefined) setInternalPreset(id);
              }}
              markerScale={markerScale}
              showTooltips={showTooltips}
              emitLights={emitLights}
              highlightSectors={highlightSectors}
              sectorHighlightMode={sectorHighlightMode}
            />

            {children}
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

          {/* Explicit rotate controls — dragging the canvas now pans (see
              CameraController's mouseButtons mapping), so "shift the camera
              angle" needs its own affordance rather than the drag gesture.
              Right-click-drag / two-finger-touch still free-rotates too;
              this is the discoverable, click-driven equivalent. */}
          <div className="absolute bottom-3 left-3 z-10">
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: "repeat(3, auto)", gridTemplateRows: "repeat(3, auto)" }}
            >
              <div />
              <button
                type="button"
                aria-label="Tilt up"
                onClick={() => cameraHandleRef.current?.rotateBy(0, -0.25)}
                className="p-1.5 rounded-md border border-white/10 bg-neutral-900/70 text-neutral-300 backdrop-blur-sm transition-colors hover:bg-neutral-800/80 hover:text-white"
              >
                <ChevronUp size={14} />
              </button>
              <div />
              <button
                type="button"
                aria-label="Rotate left"
                onClick={() => cameraHandleRef.current?.rotateBy(-0.35, 0)}
                className="p-1.5 rounded-md border border-white/10 bg-neutral-900/70 text-neutral-300 backdrop-blur-sm transition-colors hover:bg-neutral-800/80 hover:text-white"
              >
                <ChevronLeft size={14} />
              </button>
              <div />
              <button
                type="button"
                aria-label="Rotate right"
                onClick={() => cameraHandleRef.current?.rotateBy(0.35, 0)}
                className="p-1.5 rounded-md border border-white/10 bg-neutral-900/70 text-neutral-300 backdrop-blur-sm transition-colors hover:bg-neutral-800/80 hover:text-white"
              >
                <ChevronRight size={14} />
              </button>
              <div />
              <button
                type="button"
                aria-label="Tilt down"
                onClick={() => cameraHandleRef.current?.rotateBy(0, 0.25)}
                className="p-1.5 rounded-md border border-white/10 bg-neutral-900/70 text-neutral-300 backdrop-blur-sm transition-colors hover:bg-neutral-800/80 hover:text-white"
              >
                <ChevronDown size={14} />
              </button>
              <div />
            </div>
          </div>

          {/* Explicit zoom controls — scroll/pinch on the canvas already
              zooms (OrbitControls), but a visible +/- pair makes that
              discoverable and gives precise, click-driven control too. */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
            <button
              type="button"
              aria-label="Zoom in"
              onClick={() => cameraHandleRef.current?.zoomBy(0.75)}
              className="p-1.5 rounded-md border border-white/10 bg-neutral-900/70 text-neutral-300 backdrop-blur-sm transition-colors hover:bg-neutral-800/80 hover:text-white"
            >
              <ZoomIn size={14} />
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              onClick={() => cameraHandleRef.current?.zoomBy(1.35)}
              className="p-1.5 rounded-md border border-white/10 bg-neutral-900/70 text-neutral-300 backdrop-blur-sm transition-colors hover:bg-neutral-800/80 hover:text-white"
            >
              <ZoomOut size={14} />
            </button>
          </div>
        </div>
      </SectorRegistryProvider>
    );
  }
);

export default MineDigitalTwin;