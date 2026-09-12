"use client";

// ============================================================================
// digital-twin/emergency/WorkerMarker.tsx
//
// One worker's SIMULATED position, rendered at their current evacuation-graph
// node. Clicking opens the caller's worker detail drawer (2D UI, not
// in-canvas) — this component only owns hover feedback + the click callback.
// ============================================================================

import { memo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { WorkerEvacuationStatus } from "../../../../shared/types/emergency";

const STATUS_COLOR: Record<WorkerEvacuationStatus, string> = {
  NOT_AFFECTED: "#94a3b8",
  EVACUATION_ASSIGNED: "#2f7dff",
  MOVING: "#2f7dff",
  DELAYED: "#ffd400",
  ROUTE_CHANGED: "#ffd400",
  SAFE_AT_EXIT: "#22c55e",
  UNACCOUNTED: "#ff3b30",
  TRACKING_LOST: "#ff3b30",
};

const PULSING_STATUSES = new Set<WorkerEvacuationStatus>(["MOVING", "EVACUATION_ASSIGNED", "UNACCOUNTED"]);

export const WorkerMarker = memo(function WorkerMarker({
  workerId,
  workerName,
  status,
  position,
  onSelect,
}: {
  workerId: string;
  workerName: string;
  status: WorkerEvacuationStatus;
  position: [number, number, number];
  onSelect?: (workerId: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const haloRef = useRef<THREE.Mesh>(null);
  const color = STATUS_COLOR[status];
  const pulsing = PULSING_STATUSES.has(status);

  useFrame(({ clock }) => {
    if (!haloRef.current || !pulsing) return;
    const scale = 1 + 0.35 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3));
    haloRef.current.scale.setScalar(scale);
    (haloRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 - 0.3 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3));
  });

  return (
    <group position={[position[0], position[1] + 4, position[2]]} name={`worker:${workerId}`}>
      {pulsing && (
        <mesh ref={haloRef}>
          <sphereGeometry args={[2.2, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} toneMapped={false} depthWrite={false} />
        </mesh>
      )}
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
        <sphereGeometry args={[1.6, 14, 14]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>

      {hovered && (
        <Html position={[0, 3, 0]} center distanceFactor={45} occlude={false}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              padding: "3px 8px",
              borderRadius: 6,
              border: `1px solid ${color}88`,
              background: "rgba(5,10,20,0.85)",
              color: "#e4f1ff",
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            <span>{workerName}</span>
            <span style={{ color, fontSize: 9 }}>{status.replace(/_/g, " ")}</span>
          </div>
        </Html>
      )}
    </group>
  );
});
