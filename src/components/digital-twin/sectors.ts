// ============================================================================
// digital-twin/sectors.ts
//
// Centralized sector configuration + camera presets.
//
// `sensor.sector_id` (from the shared telemetry contract) must always be a
// key of `mineSectors`. The sensor-visualization layer looks a sector up by
// id here for display metadata, and resolves the actual 3D mesh at runtime
// via the SectorRegistry (see SectorRegistry.tsx) — never by re-deriving
// positions from this file.
// ============================================================================

import type { CameraPreset, MineSectorConfig, MineSectorId } from "./types";
import {
  DEEP_SHAFT_B,
  FLOOR_Y,
  MINE_LAYOUT,
  NORTH_WALL,
  SURFACE_CONVEYOR,
} from "./mineLayout";

export const mineSectors: Record<MineSectorId, MineSectorConfig> = {
  sector_north_wall: {
    id: "sector_north_wall",
    name: "North Wall",
    description: "High wall on the northern face of the pit.",
  },
  sector_deep_shaft_b: {
    id: "sector_deep_shaft_b",
    name: "Deep Shaft B",
    description: "Vertical access/ventilation shaft below the pit floor.",
  },
  sector_surface_conveyor: {
    id: "sector_surface_conveyor",
    name: "Surface Conveyor",
    description: "Surface-level overland conveyor and hopper.",
  },
  sector_main_pit: {
    id: "sector_main_pit",
    name: "Main Pit",
    description: "Stepped benches and pit floor.",
  },
};

export const mineSectorList: MineSectorConfig[] = Object.values(mineSectors);

// ----------------------------------------------------------------------------
// Camera presets
//
// Targets are derived from the same layout constants the terrain is built
// from (see mineLayout.ts), so a preset always frames the sector it's named
// after — tune geometry in one place and the camera follows.
// ----------------------------------------------------------------------------

export const cameraPresets: Record<CameraPreset["id"], CameraPreset> = {
  overview: {
    id: "overview",
    label: "Overview",
    position: [90, 70, 90],
    target: [0, FLOOR_Y / 2, 0],
  },
  northWall: {
    id: "northWall",
    label: "North Wall",
    position: [0, 6, NORTH_WALL.position[2] - 35],
    target: [NORTH_WALL.position[0], NORTH_WALL.position[1], NORTH_WALL.position[2]],
  },
  deepShaftB: {
    id: "deepShaftB",
    label: "Deep Shaft B",
    position: [
      DEEP_SHAFT_B.center.x + 22,
      FLOOR_Y + 18,
      DEEP_SHAFT_B.center.z + 22,
    ],
    target: [DEEP_SHAFT_B.center.x, FLOOR_Y, DEEP_SHAFT_B.center.z],
  },
  surfaceConveyor: {
    id: "surfaceConveyor",
    label: "Surface Conveyor",
    position: [
      SURFACE_CONVEYOR.position[0] - 25,
      SURFACE_CONVEYOR.position[1] + 20,
      SURFACE_CONVEYOR.position[2] + 30,
    ],
    target: SURFACE_CONVEYOR.position,
  },
};

export const cameraPresetList: CameraPreset[] = Object.values(cameraPresets);

export const DEFAULT_CAMERA_PRESET: CameraPreset["id"] = "overview";

/** Bounds re-exported for OrbitControls tuning, kept here so camera code and
 * layout code agree on scale without a circular import back into the scene. */
export const ORBIT_BOUNDS = {
  minDistance: 12,
  maxDistance: MINE_LAYOUT.terrainRadius * 0.85,
  minPolarAngle: 0.15,
  maxPolarAngle: 1.45,
};
