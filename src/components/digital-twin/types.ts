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

/** One admin-traced tunnel path from an uploaded mine blueprint — the world-
 * space counterpart of a backend BlueprintSection (backend/app/models/blueprint.py).
 * The caller is responsible for converting the section's raw image-pixel
 * path into world X/Z (this module has no notion of the source image), so
 * `path` here is already in the same world units as everything else. */
export interface BlueprintTunnelSection {
  id: string;
  sectorId: MineSectorId;
  /** Place name as labeled on the blueprint (e.g. "North Trunk") — shown by
   * the click-to-inspect card in place of the procedural generator's names. */
  name: string;
  /** World-space Y (vertical) position for this section's tunnel tube. */
  depth: number;
  /** World-space [x, z] points forming the tunnel's traced path, in order. */
  path: [number, number][];
}

// ----------------------------------------------------------------------------
// Camera
// ----------------------------------------------------------------------------

export type CameraPresetId =
  | "northWall"
  | "mainPit"
  | "deepShaftB"
  | "surfaceConveyor"
  | "overview"
  | "topDown";

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
  /** Admin-traced tunnel sections from an uploaded blueprint (already
   * converted to world coordinates by the caller). When present and
   * non-empty, these REPLACE the procedural fallback tunnels for whichever
   * of the 4 sectors they cover — the shaft and conveyor's own structural
   * geometry always renders regardless. Omit/empty to keep the procedural
   * demo network (e.g. no blueprint uploaded yet). */
  blueprintSections?: BlueprintTunnelSection[];
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
  /** Scales the camera's distance from its current orbit target by `factor`
   * (< 1 zooms in, > 1 zooms out), clamped to ORBIT_BOUNDS. */
  zoomBy: (factor: number) => void;
  /** Flies in close to `point` (e.g. wherever the user clicked on a tunnel),
   * keeping the camera's current viewing direction. */
  focusPoint: (point: [number, number, number]) => void;
  /** Orbits the camera around its current target by `deltaAzimuth` radians
   * horizontally (positive = rotate right/clockwise viewed from above) and
   * `deltaPolar` radians vertically (positive = tilt down), clamped to
   * ORBIT_BOUNDS' polar limits. Distance from the target is unchanged. */
  rotateBy: (deltaAzimuth: number, deltaPolar: number) => void;
}
