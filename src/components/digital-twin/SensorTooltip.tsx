"use client";

import { Html } from "@react-three/drei";

import { getRiskColor, resolveRiskLevel } from "./sensorUtils";
import type { SensorData } from "./types";

export interface SensorTooltipProps {
  sensor: SensorData;
  /** Local offset from the marker head. */
  offset?: [number, number, number];
  /** Higher values shrink the tooltip faster as the camera pulls back. */
  distanceFactor?: number;
}

/**
 * Hover summary only — ID, score, level. Full telemetry belongs in the
 * dashboard panel that opens on selection, not in a label floating over the
 * mine.
 *
 * Mounted only while a marker is hovered, so no DOM cost when idle.
 */
export function SensorTooltip({
  sensor,
  offset = [0, 0.85, 0],
  distanceFactor = 9,
}: SensorTooltipProps) {
  const riskLevel = resolveRiskLevel(sensor);
  const color = getRiskColor(riskLevel);

  return (
    <Html
      position={offset}
      center
      distanceFactor={distanceFactor}
      zIndexRange={[60, 0]}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        style={{
          minWidth: 190,
          padding: "10px 12px",
          borderRadius: 6,
          border: `1px solid ${color}`,
          borderLeft: `4px solid ${color}`,
          background: "rgba(10, 13, 18, 0.94)",
          color: "#E6EAF0",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          fontSize: 13,
          lineHeight: 1.45,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45)",
        }}
      >
        <div style={{ fontWeight: 600, letterSpacing: 0.2 }}>{sensor.sensor_id}</div>
        <div style={{ opacity: 0.75 }}>Risk score {Math.round(sensor.risk_score)}</div>
        <div>
          <span style={{ opacity: 0.75 }}>Status </span>
          <span style={{ color, fontWeight: 600 }}>{riskLevel}</span>
        </div>
      </div>
    </Html>
  );
}
