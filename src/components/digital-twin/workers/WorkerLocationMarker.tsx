"use client";

// ============================================================================
// digital-twin/workers/WorkerLocationMarker.tsx
//
// One worker's continuous (always-on, non-emergency) geotagged position —
// styled like emergency/WorkerMarker.tsx (same group+sphere+Html tooltip
// shape) so the 3D view keeps one consistent "floating marker" visual
// language across modules. Deliberately a separate component from
// WorkerMarker: that one is colored by WorkerEvacuationStatus and only
// exists during an active evacuation — this one is colored by
// Active/Idle and always visible.
// ============================================================================

import { memo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";

const ACTIVE_COLOR = "#38bdf8";
const IDLE_COLOR = "#7c8aa0";

export const WorkerLocationMarker = memo(function WorkerLocationMarker({
  workerId,
  workerName,
  detail,
  isActive,
  position,
  onSelect,
}: {
  workerId: string;
  workerName: string;
  detail: string;
  isActive: boolean;
  position: [number, number, number];
  onSelect?: (workerId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = isActive ? ACTIVE_COLOR : IDLE_COLOR;

  return (
    // No vertical offset: the evacuation graph's tunnel cross-section
    // radius is only 4.5 (SHAFT.lowerRadius is as tight as 3 — see
    // mineLayout.ts), and this marker's own halo sphere already reaches
    // out to radius 2.4. A +5 lift (the original value here, mirrored
    // from WorkerMarker.tsx's +4 without checking against the tunnel
    // radius) placed the marker's center entirely above/outside the tube
    // — visually "floating outside the tunnel" rather than inside it.
    // Sitting exactly at the node's own coordinate keeps the whole marker
    // safely within the smallest tunnel cross-section anywhere in the
    // graph.
    <group position={position} name={`worker-location:${workerId}`}>
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(false);
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onSelect?.(workerId);
        }}
      >
        <sphereGeometry args={[1.5, 14, 14]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.4, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} toneMapped={false} depthWrite={false} />
      </mesh>

      {hovered && (
        <Html position={[0, 3.2, 0]} center distanceFactor={45} occlude={false}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              padding: "4px 9px",
              borderRadius: 6,
              border: `1px solid ${color}88`,
              background: "rgba(5,10,20,0.9)",
              color: "#e4f1ff",
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            <span>{workerName}</span>
            <span style={{ color, fontSize: 9, fontWeight: 500 }}>{detail}</span>
          </div>
        </Html>
      )}
    </group>
  );
});
