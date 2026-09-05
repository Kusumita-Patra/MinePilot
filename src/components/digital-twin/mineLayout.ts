// ============================================================================
// digital-twin/mineLayout.ts
//
// Single source of truth for the procedural fallback mine's dimensions.
// Every other file (terrain, camera presets, orbit-control bounds) derives
// its numbers from here so the scene, sector positions and camera targets
// can never drift out of sync when the layout is tuned.
//
// Units are arbitrary world units (treat as ~metres for intuition).
// ============================================================================

export const MINE_LAYOUT = {
  /** Radius of the pit at the surface rim (y = 0). */
  rimRadius: 45,
  /** Number of stepped benches from rim to floor. */
  benchCount: 4,
  /** Vertical height of a single bench wall. */
  benchHeight: 8,
  /** Horizontal inset per bench (how much narrower each successive bench is). */
  benchInset: 6,
  /** Radius of the surrounding surface terrain disc. */
  terrainRadius: 220,
} as const;

/** y = 0 is the original surface / rim level. Everything below is negative. */
export const FLOOR_Y = -(MINE_LAYOUT.benchCount * MINE_LAYOUT.benchHeight); // -32
export const FLOOR_RADIUS =
  MINE_LAYOUT.rimRadius - MINE_LAYOUT.benchCount * MINE_LAYOUT.benchInset; // 21

export const NORTH_WALL = {
  position: [0, -14, -38] as [number, number, number],
  size: [44, 32, 4] as [number, number, number], // width, height, depth
  tilt: -0.08, // slight inward lean, radians
};

export const DEEP_SHAFT_B = {
  /** Shaft sits on the pit floor and bores further down. */
  topY: FLOOR_Y,
  depth: 20,
  radius: 4,
  /** Horizontal placement on the pit floor (x, z) — kept separate from the
   * computed vertical `position` below to avoid any ambiguity about which
   * axis is which. */
  center: { x: 10, z: -6 },
  get position(): [number, number, number] {
    return [this.center.x, FLOOR_Y - this.depth / 2, this.center.z];
  },
};

export const SURFACE_CONVEYOR = {
  /** Group origin, out on the surrounding terrain beyond the rim. */
  position: [-58, 0, 25] as [number, number, number],
  beltLength: 22,
  beltIncline: -0.32,
};

export const HAUL_ROAD = {
  /** Ramp cuts from the south-east rim opening down to the floor edge. */
  angle: Math.PI / 4,
  width: 7,
  thickness: 1.2,
};
