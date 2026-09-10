import * as THREE from "three";

import type { RiskLevel, SectorStates, SensorData } from "./types";

/* -------------------------------------------------------------------------- */
/* Risk colors                                                                */
/* -------------------------------------------------------------------------- */

export const RISK_COLORS: Record<RiskLevel, string> = {
  NORMAL: "#00E676",
  WARNING: "#FFD600",
  CRITICAL: "#D50000",
};

export const RISK_LEVELS: RiskLevel[] = ["NORMAL", "WARNING", "CRITICAL"];

/** The single source of truth for marker color. */
export function getRiskColor(riskLevel: SensorData["risk_level"]): string {
  return RISK_COLORS[riskLevel] ?? RISK_COLORS.NORMAL;
}

/**
 * Pre-built THREE.Color instances so nothing allocates a Color per frame.
 * Treat the returned instance as read-only: `.copy()` it, never mutate it.
 */
const RISK_COLOR_OBJECTS: Record<RiskLevel, THREE.Color> = {
  NORMAL: new THREE.Color(RISK_COLORS.NORMAL),
  WARNING: new THREE.Color(RISK_COLORS.WARNING),
  CRITICAL: new THREE.Color(RISK_COLORS.CRITICAL),
};

export function getRiskColorObject(riskLevel: RiskLevel): THREE.Color {
  return RISK_COLOR_OBJECTS[riskLevel] ?? RISK_COLOR_OBJECTS.NORMAL;
}

/* -------------------------------------------------------------------------- */
/* Risk classification                                                        */
/* -------------------------------------------------------------------------- */

export const RISK_THRESHOLDS = {
  WARNING: 40,
  CRITICAL: 75,
} as const;

/**
 * Backend-equivalent classification. Used only as a fallback when a payload
 * arrives without a usable `risk_level` — the backend's value always wins.
 */
export function classifyRiskLevel(riskScore: number): RiskLevel {
  if (riskScore >= RISK_THRESHOLDS.CRITICAL) return "CRITICAL";
  if (riskScore >= RISK_THRESHOLDS.WARNING) return "WARNING";
  return "NORMAL";
}

export function isRiskLevel(value: unknown): value is RiskLevel {
  return value === "NORMAL" || value === "WARNING" || value === "CRITICAL";
}

/** Prefers the supplied risk_level, falls back to the score if it is missing. */
export function resolveRiskLevel(
  sensor: Pick<SensorData, "risk_level" | "risk_score">,
): RiskLevel {
  return isRiskLevel(sensor.risk_level)
    ? sensor.risk_level
    : classifyRiskLevel(sensor.risk_score);
}

/* -------------------------------------------------------------------------- */
/* Per-level effect configuration                                             */
/* -------------------------------------------------------------------------- */

export interface RiskEffectConfig {
  /** Radians per second driving the halo breathing + emissive strobe. */
  pulseSpeed: number;
  /** Halo scale swing, as a fraction of its radius. */
  scaleAmplitude: number;
  emissiveBase: number;
  emissiveAmplitude: number;
  haloRadius: number;
  haloIntensity: number;
  /** Travelling rings inside the halo shader. 0 disables them. */
  haloRingCount: number;
  /** Ground shockwave rings. 0 disables the whole mesh. */
  shockwaveCount: number;
  shockwaveSpeed: number;
  shockwaveRadius: number;
  shockwaveOpacity: number;
  /** Only applied when `emitLights` is enabled on <SensorMarkers />. */
  lightIntensity: number;
}

/**
 * NORMAL is deliberately static: a steady glow, no animation, no shockwaves.
 * WARNING uses the sin(t * 4) breathing rate, CRITICAL the sin(t * 12) strobe.
 */
export const RISK_EFFECTS: Record<RiskLevel, RiskEffectConfig> = {
  NORMAL: {
    pulseSpeed: 0,
    scaleAmplitude: 0,
    emissiveBase: 0.9,
    emissiveAmplitude: 0,
    haloRadius: 0.6,
    haloIntensity: 0.4,
    haloRingCount: 0,
    shockwaveCount: 0,
    shockwaveSpeed: 0,
    shockwaveRadius: 0,
    shockwaveOpacity: 0,
    lightIntensity: 0,
  },
  WARNING: {
    pulseSpeed: 4,
    scaleAmplitude: 0.15,
    emissiveBase: 1.5,
    emissiveAmplitude: 0.5,
    haloRadius: 1.0,
    haloIntensity: 0.85,
    haloRingCount: 2,
    shockwaveCount: 2,
    shockwaveSpeed: 0.5,
    shockwaveRadius: 1.6,
    shockwaveOpacity: 0.5,
    lightIntensity: 2.5,
  },
  CRITICAL: {
    pulseSpeed: 12,
    scaleAmplitude: 0.22,
    emissiveBase: 2.2,
    emissiveAmplitude: 1.4,
    haloRadius: 1.4,
    haloIntensity: 1.0,
    haloRingCount: 3,
    shockwaveCount: 3,
    shockwaveSpeed: 1.1,
    shockwaveRadius: 2.4,
    shockwaveOpacity: 0.8,
    lightIntensity: 6,
  },
};

/* -------------------------------------------------------------------------- */
/* Sector aggregation                                                         */
/* -------------------------------------------------------------------------- */

export const RISK_PRIORITY: Record<RiskLevel, number> = {
  NORMAL: 0,
  WARNING: 1,
  CRITICAL: 2,
};

export function maxRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_PRIORITY[a] >= RISK_PRIORITY[b] ? a : b;
}

/**
 * Rolls a sensor list up into one state per sector.
 *
 *   any sensor CRITICAL  -> sector CRITICAL
 *   else any WARNING     -> sector WARNING
 *   else                 -> sector NORMAL
 */
export function computeSectorStates(sensors: SensorData[]): SectorStates {
  const states: SectorStates = {};

  for (const sensor of sensors) {
    const level = resolveRiskLevel(sensor);
    const existing = states[sensor.sector_id];

    if (!existing) {
      states[sensor.sector_id] = {
        sector_id: sensor.sector_id,
        risk_level: level,
        max_risk_score: sensor.risk_score,
        sensor_count: 1,
        warning_count: level === "WARNING" ? 1 : 0,
        critical_count: level === "CRITICAL" ? 1 : 0,
        worst_sensor_id: sensor.sensor_id,
      };
      continue;
    }

    const outranks =
      RISK_PRIORITY[level] > RISK_PRIORITY[existing.risk_level] ||
      (RISK_PRIORITY[level] === RISK_PRIORITY[existing.risk_level] &&
        sensor.risk_score > existing.max_risk_score);

    if (outranks) existing.worst_sensor_id = sensor.sensor_id;

    existing.sensor_count += 1;
    if (level === "WARNING") existing.warning_count += 1;
    if (level === "CRITICAL") existing.critical_count += 1;
    existing.risk_level = maxRiskLevel(existing.risk_level, level);
    existing.max_risk_score = Math.max(existing.max_risk_score, sensor.risk_score);
  }

  return states;
}

/* -------------------------------------------------------------------------- */
/* Misc                                                                       */
/* -------------------------------------------------------------------------- */

/** Never hard-code positions — always derive them from the payload. */
export function sensorPosition(sensor: SensorData): [number, number, number] {
  return [sensor.coordinates.x, sensor.coordinates.y, sensor.coordinates.z];
}

/**
 * Cheap structural comparison used by the socket hook to preserve object
 * identity for sensors that did not actually change, so React.memo can skip
 * re-rendering their pins.
 */
export function hasSensorChanged(a: SensorData, b: SensorData): boolean {
  if (
    a.risk_score !== b.risk_score ||
    a.risk_level !== b.risk_level ||
    a.timestamp !== b.timestamp ||
    a.sector_id !== b.sector_id
  ) {
    return true;
  }

  if (
    a.coordinates.x !== b.coordinates.x ||
    a.coordinates.y !== b.coordinates.y ||
    a.coordinates.z !== b.coordinates.z
  ) {
    return true;
  }

  return (
    a.telemetry.ch4_pct !== b.telemetry.ch4_pct ||
    a.telemetry.co_ppm !== b.telemetry.co_ppm ||
    a.telemetry.displacement_mm !== b.telemetry.displacement_mm ||
    a.telemetry.temp_c !== b.telemetry.temp_c ||
    a.telemetry.dust_pm10 !== b.telemetry.dust_pm10
  );
}
