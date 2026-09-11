"use client";

// ============================================================================
// digital-twin/SensorLocationMarkers.tsx
//
// Optional overlay showing where sensors are physically REGISTERED
// (backend SensorConfig / /admin/mine/sensors), independent of whether they
// are currently streaming live telemetry. This is deliberately a separate,
// simpler visual from <SensorPin /> (the live-telemetry marker): a small
// static beacon color-coded by lifecycle status, not risk, with no
// click/select behavior of its own — it's a placement reference layer, not
// part of the live monitoring flow. A registered sensor that IS also
// streaming gets both markers at (approximately) the same spot; that's
// expected, not a bug — they answer different questions ("where is it
// configured" vs. "what is it reading right now").
// ============================================================================

import { memo } from "react";
import { Html } from "@react-three/drei";
import type { SensorLocationMarker } from "./types";

const STATUS_COLOR: Record<SensorLocationMarker["status"], string> = {
  ACTIVE: "#38bdf8",
  INACTIVE: "#94a3b8",
  MAINTENANCE: "#ffd400",
  RETIRED: "#64748b",
};

function Marker({ marker }: { marker: SensorLocationMarker }) {
  const color = STATUS_COLOR[marker.status];

  return (
    <group position={marker.position} name={`sensor-location:${marker.sensorId}`}>
      <mesh>
        <octahedronGeometry args={[1.4, 0]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[1.4, 0]} />
        <meshBasicMaterial color={color} wireframe toneMapped={false} />
      </mesh>

      <Html position={[0, 3.2, 0]} center distanceFactor={45} occlude={false}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            padding: "2px 7px",
            borderRadius: 6,
            border: `1px solid ${color}88`,
            background: "rgba(5,10,20,0.78)",
            color: "#e4f1ff",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          <span>{marker.displayName}</span>
          <span style={{ color, fontSize: 8, fontWeight: 700 }}>
            {marker.status}
            {!marker.isReporting && marker.status === "ACTIVE" ? " · NOT REPORTING" : ""}
          </span>
        </div>
      </Html>
    </group>
  );
}

export const SensorLocationMarkers = memo(function SensorLocationMarkers({
  markers,
}: {
  markers: SensorLocationMarker[];
}) {
  return (
    <group name="sensor-location-markers">
      {markers.map((marker) => (
        <Marker key={marker.id} marker={marker} />
      ))}
    </group>
  );
});
