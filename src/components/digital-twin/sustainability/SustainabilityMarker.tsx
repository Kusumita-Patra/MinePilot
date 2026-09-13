"use client";

// ============================================================================
// digital-twin/sustainability/SustainabilityMarker.tsx
//
// One sustainability data point (an Energy/Waste/Land sector aggregate, or
// an environmental sensor) rendered as a small floating orb in the 3D twin.
// Deliberately styled like emergency/WorkerMarker.tsx (same group+sphere+Html
// tooltip shape) so the 3D view has one consistent "floating marker" visual
// language across modules, not a second competing style.
// ============================================================================

import { memo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";

export const SustainabilityMarker = memo(function SustainabilityMarker({
  id,
  position,
  color,
  label,
  detail,
  radius = 1.4,
}: {
  id: string;
  position: [number, number, number];
  color: string;
  label: string;
  detail: string;
  radius?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={position} name={`sustainability:${id}`}>
      <mesh
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(false);
        }}
      >
        <sphereGeometry args={[radius, 14, 14]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <mesh>
        <sphereGeometry args={[radius * 1.6, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.15} depthWrite={false} />
      </mesh>

      {hovered && (
        <Html position={[0, radius * 2.2, 0]} center distanceFactor={45} occlude={false}>
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
            <span style={{ color }}>{label}</span>
            <span style={{ fontSize: 9, fontWeight: 500, color: "#c7d5e6" }}>{detail}</span>
          </div>
        </Html>
      )}
    </group>
  );
});
