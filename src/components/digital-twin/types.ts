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

import type { ReactNode } from "react";
import type { CanvasProps } from "@react-three/fiber";
import type { SensorFrame } from "../../../shared/types/telemetry";
import type { SectorHighlightMode } from "./SectorHighlight";

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
  | "sector_shaft_b"
  | "sector_conveyor_3"
  | "sector_south_face";

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

/** One administrator-registered sensor's physical placement (backend
 * SensorConfig, backend/app/models/sensor_config.py) — independent of live
 * telemetry. The caller converts pixel_x/pixel_y/depth to world coordinates
 * (same convention as BlueprintTunnelSection) before passing this in; this
 * module has no notion of the source blueprint image. Rendered by the
 * optional "sensor locations" overlay so a registered-but-not-yet-streaming
 * sensor is still visible somewhere in the 3D view. */
export interface SensorLocationMarker {
  id: string;
  sensorId: string;
  displayName: string;
  sensorType: string;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "RETIRED";
  /** Whether this sensor has sent telemetry recently (backend-computed) —
   * distinct from `status`, which is an admin-set lifecycle state. */
  isReporting: boolean;
  /** World-space [x, y, z] position. */
  position: [number, number, number];
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
  /** Registered-sensor placements (already converted to world coordinates
   * by the caller, same as blueprintSections). Rendered behind a built-in
   * HUD toggle ("Sensor Locations") — off by default, since it's a
   * registry/configuration overlay rather than part of the live view. */
  sensorLocations?: SensorLocationMarker[];
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

  /** Fired on hover/unhover of a sensor marker. Fires with null when the
   * pointer leaves. */
  onHoverSensor?: (sensor: SensorFrame | null) => void;
  /** Extra content rendered inside the Canvas alongside the built-in mine
   * environment (e.g. an overlay mesh). The module owns its own environment
   * via `modelUrl` regardless of whether children are passed. */
  children?: ReactNode;
  /** Uniform size multiplier for every sensor marker. */
  markerScale?: number;
  /** Show the 3D hover tooltip on sensor markers. Default true. */
  showTooltips?: boolean;
  /** Attach a point light to CRITICAL sensors. Off by default: every light
   * adds real cost to the scene's shaders, so only enable it when the number
   * of simultaneously critical sensors stays small. */
  emitLights?: boolean;
  /** Tint sector meshes by their aggregated risk. Default true. */
  highlightSectors?: boolean;
  sectorHighlightMode?: SectorHighlightMode;
  /** Forwarded to <Canvas> so camera, dpr, shadows etc. stay configurable
   * beyond the built-in defaults. */
  canvasProps?: Omit<CanvasProps, "children">;
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

// ----------------------------------------------------------------------------
// Sensor visualization layer
//
// These types mirror the backend telemetry payload (SensorFrame above).
// Field names are part of the cross-team contract and must not be renamed.
// ----------------------------------------------------------------------------

export type RiskLevel = "NORMAL" | "WARNING" | "CRITICAL";

export interface SensorCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface SensorTelemetry {
  ch4_pct: number;
  co_ppm: number;
  displacement_mm: number;
  temp_c: number;
  dust_pm10: number;
}

/** The canonical sensor payload delivered over /ws/telemetry. */
export interface SensorData {
  sensor_id: string;

  sector_id: string;

  coordinates: SensorCoordinates;

  telemetry: SensorTelemetry;

  risk_score: number;

  risk_level: RiskLevel;

  timestamp: string;

  historicalData?: unknown[];
}

/**
 * Aggregated risk state for one mine sector, derived from every sensor that
 * reports into it. Consumed by <SectorHighlight />.
 */
export interface SectorState {
  sector_id: string;
  /** CRITICAL wins over WARNING, WARNING wins over NORMAL. */
  risk_level: RiskLevel;
  max_risk_score: number;
  sensor_count: number;
  warning_count: number;
  critical_count: number;
  /** Sensor driving the sector's current risk level. */
  worst_sensor_id: string | null;
}

export type SectorStates = Record<string, SectorState>;

export interface SensorMarkersProps {
  /** Live sensor list. Updating this prop updates the visualization. */
  sensors: SensorData[];

  /** Currently selected sensor, or null. Owned by the parent. */
  selectedSensor: SensorData | null;

  /** Receives the complete SensorData object on click. */
  onSelectSensor: (sensor: SensorData) => void;

  /** Optional hover notification. Fires with null when the pointer leaves. */
  onHoverSensor?: (sensor: SensorData | null) => void;

  /** Uniform size multiplier for every marker. Tune to your mine's scale. */
  markerScale?: number;

  /** Show the 3D hover tooltip. Default true. */
  showTooltips?: boolean;

  /**
   * Attach a point light to CRITICAL sensors. Off by default: every light adds
   * real cost to the scene's shaders, so only enable it when the number of
   * simultaneously critical sensors stays small.
   */
  emitLights?: boolean;
}
