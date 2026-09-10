// ============================================================================
// digital-twin/riskColors.ts
//
// Single source of truth for the 3-color risk language used everywhere in
// the 3D view — tunnel/shaft/conveyor tinting (MineTerrain.tsx) AND sensor
// markers (SensorPlaceholder.tsx) share these exact values, so "red" in one
// place always means the same "red" in the other.
// ============================================================================

import type { SensorFrame } from "./types";

export type RiskLevel = SensorFrame["risk_level"];

export const RISK_COLOR: Record<RiskLevel, string> = {
  NORMAL: "#2f7dff", // blue
  WARNING: "#ffd400", // yellow
  CRITICAL: "#ff3b30", // red
};
