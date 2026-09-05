// ============================================================================
// digital-twin/types.ts
//
// Type contracts for the 3D mine environment & camera module.
//
// IMPORTANT: `SensorFrame` is imported from the project-wide shared contract
// (shared/types/telemetry.ts) rather than redefined here. That file is the
// single source of truth for the WebSocket telemetry schema shared with the
// backend and the sensor-visualization half of the 3D module. Do not fork it.
// ============================================================================

import type { SensorFrame } from "../../../shared/types/telemetry";

export type { SensorFrame };

/** Canonical world-space point. Matches SensorFrame["coordinates"] 1:1 — no
 * scaling or axis remapping is applied anywhere in this module, so
 * `position={[x, y, z]}` always places an object where the backend expects. */
export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

// ----------------------------------------------------------------------------
// Sectors
// ----------------------------------------------------------------------------

/** The set of sector ids this environment currently exposes. Extend this
 * union (and `sectors.ts`) if the mine model grows more identifiable zones —
 * everything downstream (registry, highlighting) is written generically
 * against `string` ids, so adding a sector never requires touching the
 * camera or registry code. */
export type MineSectorId =
  | "sector_north_wall"
  | "sector_deep_shaft_b"
  | "sector_surface_conveyor"
  | "sector_main_pit";

export interface MineSectorConfig {
  id: MineSectorId;
  name: string;
  /** Short human-readable description, useful for tooltips/legends built by
   * the sensor-visualization side. */
  description: string;
}

// ----------------------------------------------------------------------------
// Camera
// ----------------------------------------------------------------------------

export type CameraPresetId =
  | "northWall"
  | "deepShaftB"
  | "surfaceConveyor"
  | "overview";

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  /** World-space camera position. */
  position: [number, number, number];
  /** World-space point the camera looks at (becomes OrbitControls.target). */
  target: [number, number, number];
}

// ----------------------------------------------------------------------------
// Public component contract
// ----------------------------------------------------------------------------

export interface MineDigitalTwinProps {
  /** Full sensor list. Passed straight through to the (placeholder) sensor
   * layer — this module never reads telemetry values itself. */
  sensors?: SensorFrame[];
  /** Currently selected sensor, if any (controlled by the parent). */
  selectedSensor?: SensorFrame | null;
  /** Fired when a sensor marker is clicked. Only wired up as a pass-through
   * placeholder here; full raycasting/hover/tooltip behaviour belongs to the
   * sensor-visualization developer. */
  onSelectSensor?: (sensor: SensorFrame) => void;
  /** Controlled active camera preset. If provided, the environment flies to
   * this preset whenever it changes. Uncontrolled if omitted. */
  cameraPreset?: CameraPresetId;
  /** Fired after the user picks a preset from the built-in HUD buttons. Only
   * relevant if you want to lift preset state up to the parent. */
  onCameraPresetChange?: (preset: CameraPresetId) => void;
  /** Override the default `/models/mine.glb` path. */
  modelUrl?: string;
  /** Hide the built-in top-right camera preset buttons (e.g. if the parent
   * dashboard wants to drive the camera from its own toolbar instead). */
  showPresetControls?: boolean;
  className?: string;
}

/** Imperative handle exposed via `ref` for parents that want to trigger
 * camera moves from outside (e.g. a toolbar button, or a sensor click
 * handled entirely by the other developer's layer). */
export interface MineDigitalTwinHandle {
  flyToPreset: (preset: CameraPresetId) => void;
  flyToPoint: (position: [number, number, number], target: [number, number, number]) => void;
}
