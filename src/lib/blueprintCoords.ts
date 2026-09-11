// A blueprint image can be any pixel size; normalize it to roughly the same
// world-unit footprint the procedural fallback network already uses so
// anything traced/placed on it is visually comparable regardless of the
// source image's resolution. Shared by the tunnel-section conversion
// (dashboard/page.tsx) and sensor-location conversion (below) so both stay
// on the exact same scale.
//
// Sized to comfortably cover the procedural network's actual full diameter
// (MINE_LAYOUT.terrainRadius * 2 = 1040, in digital-twin/mineLayout.ts) with
// margin — was previously 500, less than half that, which squeezed any real
// traced blueprint into a small box in the middle of the much bigger
// procedural terrain it renders alongside.
export const BLUEPRINT_WORLD_SPAN = 1200;

/** Converts a blueprint-image pixel coordinate to world [x, z], using the
 * same `(px - width/2) * scale` convention as every other blueprint-derived
 * placement in the 3D twin. `depth` (world Y) needs no conversion — it's
 * already a raw world unit, used as-is by the caller. */
export function pixelToWorldXZ(
  px: number,
  py: number,
  imageWidth: number,
  imageHeight: number
): [number, number] {
  const scale = BLUEPRINT_WORLD_SPAN / Math.max(imageWidth, imageHeight);
  return [(px - imageWidth / 2) * scale, (py - imageHeight / 2) * scale];
}
