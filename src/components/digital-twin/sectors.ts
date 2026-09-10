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
//
// Sector IDs are unchanged from the open-pit version (they're a stored
// contract shared with the backend/mock data) — only their names,
// descriptions and what they physically represent were updated for the
// underground rebuild.
// ============================================================================

import type { CameraPreset, MineSectorConfig, MineSectorId } from "./types";
import { LEVELS, MINE_LAYOUT, SURFACE_CONVEYOR } from "./mineLayout";

export const mineSectors: Record<MineSectorId, MineSectorConfig> = {
  sector_north_wall: {
    id: "sector_north_wall",
    name: "North Section",
    description: "Level -1 branch tunnels running north of the main shaft.",
  },
  sector_deep_shaft_b: {
    id: "sector_deep_shaft_b",
    name: "Deep Shaft B",
    description: "Main vertical access shaft, including its narrow lower run and sump.",
  },
  sector_surface_conveyor: {
    id: "sector_surface_conveyor",
    name: "Surface Conveyor",
    description: "Surface-level headframe and overland conveyor at the shaft collar.",
  },
  sector_main_pit: {
    id: "sector_main_pit",
    name: "Main Tunnel Network",
    description: "Level -2 cross network of tunnels — the main working area.",
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
    // Deliberately closer than a "fit everything" framing — the network now
    // spreads a long way in all four directions, and the goal on first load
    // is a large, legible view of the core layout, not a tiny distant blob
    // with empty space around it. The far crosscut tips extend past the
    // frame edges; OrbitControls (maxDistance below) lets the user zoom out
    // to see the full extent whenever they want.
    position: [130, 85, 130],
    target: [0, LEVELS.level2, 0],
  },
  northWall: {
    id: "northWall",
    label: "North Section",
    position: [40, LEVELS.level1 + 55, -150],
    target: [10, LEVELS.level1, -45],
  },
  mainPit: {
    id: "mainPit",
    label: "Main Tunnel Network",
    // Framed from the south-east, looking back along the east trunk — the
    // network's densest, longest-reaching side (it also carries the
    // surface-conveyor hub), so this angle reads as the "main working area"
    // shot the way northWall reads as the north section's.
    position: [230, LEVELS.level2 + 70, 130],
    target: [90, LEVELS.level2, 20],
  },
  deepShaftB: {
    id: "deepShaftB",
    label: "Deep Shaft B",
    position: [28, LEVELS.level2 - 5, 28],
    target: [0, LEVELS.level3 + 8, 0],
  },
  surfaceConveyor: {
    id: "surfaceConveyor",
    label: "Surface Conveyor",
    position: [
      SURFACE_CONVEYOR.position[0] - 22,
      SURFACE_CONVEYOR.position[1] + 18,
      SURFACE_CONVEYOR.position[2] + 24,
    ],
    target: SURFACE_CONVEYOR.position,
  },
  topDown: {
    id: "topDown",
    label: "Top Down",
    // A near-vertical bird's-eye establishing shot over the whole layout —
    // the best angle for seeing how widely the tunnel network actually
    // spreads. Offset just enough off-axis to stay above ORBIT_BOUNDS'
    // minPolarAngle so a subsequent orbit-drag doesn't jump.
    position: [70, 450, 35],
    target: [0, LEVELS.level2, 0],
  },
};

export const cameraPresetList: CameraPreset[] = Object.values(cameraPresets);

export const DEFAULT_CAMERA_PRESET: CameraPreset["id"] = "overview";

/** Bounds re-exported for OrbitControls tuning, kept here so camera code and
 * layout code agree on scale without a circular import back into the scene. */
export const ORBIT_BOUNDS = {
  minDistance: 8,
  maxDistance: MINE_LAYOUT.terrainRadius * 2,
  minPolarAngle: 0.1,
  maxPolarAngle: 1.55,
};
