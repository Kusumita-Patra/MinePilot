"use client";

// ============================================================================
// digital-twin/MineTerrain.tsx
//
// Procedural fallback environment, used whenever /models/mine.glb is not
// present (see MineModel.tsx). Builds a simplified but readable open-pit
// coal mine: stepped benches, a pit floor, a north wall, a deep shaft, a
// surface conveyor, a haul road ramp and surrounding terrain.
//
// Geometry is intentionally low-poly and built from primitives — this is a
// stand-in environment for sensor placement and camera work, not a hero
// asset. All dimensions come from mineLayout.ts so this file contains no
// "magic numbers" of its own.
// ============================================================================

import { useMemo } from "react";
import * as THREE from "three";
import SectorMesh from "./SectorMesh";
import { computeBeamTransform, pointOnCircle } from "./geometryUtils";
import {
  DEEP_SHAFT_B,
  FLOOR_RADIUS,
  FLOOR_Y,
  HAUL_ROAD,
  MINE_LAYOUT,
  NORTH_WALL,
  SURFACE_CONVEYOR,
} from "./mineLayout";

const RADIAL_SEGMENTS = 48;

export default function MineTerrain() {
  // ---- shared materials (created once, reused across meshes) ----
  const materials = useMemo(
    () => ({
      terrain: new THREE.MeshStandardMaterial({ color: "#333c2e", roughness: 1 }),
      benchWallA: new THREE.MeshStandardMaterial({
        color: "#55504a",
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
      benchWallB: new THREE.MeshStandardMaterial({
        color: "#4a4640",
        roughness: 0.95,
        side: THREE.DoubleSide,
      }),
      benchFloor: new THREE.MeshStandardMaterial({ color: "#605a52", roughness: 1 }),
      pitFloor: new THREE.MeshStandardMaterial({ color: "#3a3630", roughness: 1 }),
      northWall: new THREE.MeshStandardMaterial({ color: "#6b4a3a", roughness: 0.9 }),
      shaftWall: new THREE.MeshStandardMaterial({
        color: "#141414",
        roughness: 1,
        side: THREE.DoubleSide,
      }),
      shaftCollar: new THREE.MeshStandardMaterial({ color: "#2a2a2a", roughness: 0.8 }),
      conveyorFrame: new THREE.MeshStandardMaterial({ color: "#2f3b46", roughness: 0.6, metalness: 0.3 }),
      conveyorBelt: new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 0.8 }),
      haulRoad: new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: 1 }),
    }),
    []
  );

  // ---- stepped benches (rings) + floor ----
  const benches = useMemo(() => {
    const rows: {
      key: string;
      wallRadius: number;
      wallY: number;
      ringInner: number;
      ringOuter: number;
      ringY: number;
      material: THREE.Material;
    }[] = [];

    for (let i = 0; i < MINE_LAYOUT.benchCount; i++) {
      const wallRadius = MINE_LAYOUT.rimRadius - i * MINE_LAYOUT.benchInset;
      const topY = -i * MINE_LAYOUT.benchHeight;
      const bottomY = topY - MINE_LAYOUT.benchHeight;
      const nextRadius = MINE_LAYOUT.rimRadius - (i + 1) * MINE_LAYOUT.benchInset;

      rows.push({
        key: `bench-${i}`,
        wallRadius,
        wallY: (topY + bottomY) / 2,
        ringInner: nextRadius,
        ringOuter: wallRadius,
        ringY: bottomY,
        material: i % 2 === 0 ? materials.benchWallA : materials.benchWallB,
      });
    }
    return rows;
  }, [materials]);

  // ---- haul road ramp: rim opening -> floor edge, south-east side ----
  const haulRoadTransform = useMemo(() => {
    const top = pointOnCircle(MINE_LAYOUT.rimRadius - 1, HAUL_ROAD.angle, 0.05);
    const bottom = pointOnCircle(FLOOR_RADIUS - 1, HAUL_ROAD.angle, FLOOR_Y + 0.05);
    return computeBeamTransform(top, bottom);
  }, []);

  return (
    <group name="mine-terrain-fallback">
      {/* Surrounding surface terrain */}
      <mesh
        name="surrounding_terrain"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        material={materials.terrain}
        receiveShadow
      >
        <ringGeometry args={[MINE_LAYOUT.rimRadius, MINE_LAYOUT.terrainRadius, 64]} />
      </mesh>

      {/* Main pit: stepped benches + floor, registered as its own sector so
          the sensor layer can highlight "the pit" generally in addition to
          the more specific named sectors below. */}
      <SectorMesh sectorId="sector_main_pit">
        {benches.map((b) => (
          <group key={b.key}>
            <mesh
              position={[0, b.wallY, 0]}
              material={b.material}
              castShadow
              receiveShadow
            >
              <cylinderGeometry
                args={[b.wallRadius, b.wallRadius, MINE_LAYOUT.benchHeight, RADIAL_SEGMENTS, 1, true]}
              />
            </mesh>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, b.ringY, 0]}
              material={materials.benchFloor}
              receiveShadow
            >
              <ringGeometry args={[b.ringInner, b.ringOuter, RADIAL_SEGMENTS]} />
            </mesh>
          </group>
        ))}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, FLOOR_Y, 0]}
          material={materials.pitFloor}
          receiveShadow
        >
          <circleGeometry args={[FLOOR_RADIUS, RADIAL_SEGMENTS]} />
        </mesh>
      </SectorMesh>

      {/* North wall — distinct, prominent sector */}
      <SectorMesh sectorId="sector_north_wall" position={NORTH_WALL.position} rotation={[NORTH_WALL.tilt, 0, 0]}>
        <mesh material={materials.northWall} castShadow receiveShadow>
          <boxGeometry args={NORTH_WALL.size} />
        </mesh>
      </SectorMesh>

      {/* Deep Shaft B — bores below the pit floor */}
      <SectorMesh sectorId="sector_deep_shaft_b" position={DEEP_SHAFT_B.position}>
        <mesh material={materials.shaftWall}>
          <cylinderGeometry
            args={[DEEP_SHAFT_B.radius, DEEP_SHAFT_B.radius, DEEP_SHAFT_B.depth, 24, 1, true]}
          />
        </mesh>
        {/* dark cap so the shaft reads as bottomless rather than a hollow tube */}
        <mesh position={[0, -DEEP_SHAFT_B.depth / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[DEEP_SHAFT_B.radius, 24]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
      </SectorMesh>
      {/* Collar ring at floor level, sits outside the shaft's own local space
          so it doesn't get swept into the shaft's depth-based transforms */}
      <mesh
        position={[DEEP_SHAFT_B.center.x, FLOOR_Y + 0.05, DEEP_SHAFT_B.center.z]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials.shaftCollar}
      >
        <ringGeometry args={[DEEP_SHAFT_B.radius, DEEP_SHAFT_B.radius + 1.5, 24]} />
      </mesh>

      {/* Surface conveyor */}
      <SectorMesh sectorId="sector_surface_conveyor" position={SURFACE_CONVEYOR.position}>
        {/* support base */}
        <mesh position={[0, 1, 0]} material={materials.conveyorFrame} castShadow receiveShadow>
          <boxGeometry args={[4, 2, 4]} />
        </mesh>
        {/* inclined belt, rotated up around Z so it rises along local X */}
        <group position={[0, 2, 0]} rotation={[0, 0, SURFACE_CONVEYOR.beltIncline]}>
          <mesh position={[SURFACE_CONVEYOR.beltLength / 2, 0, 0]} material={materials.conveyorFrame} castShadow>
            <boxGeometry args={[SURFACE_CONVEYOR.beltLength, 1.4, 3]} />
          </mesh>
          <mesh position={[SURFACE_CONVEYOR.beltLength / 2, 0.75, 0]} material={materials.conveyorBelt}>
            <boxGeometry args={[SURFACE_CONVEYOR.beltLength, 0.15, 2.6]} />
          </mesh>
          {/* support legs along the incline */}
          {[0.25, 0.5, 0.75].map((t) => (
            <mesh
              key={t}
              position={[SURFACE_CONVEYOR.beltLength * t, -3, 0]}
              material={materials.conveyorFrame}
              castShadow
            >
              <boxGeometry args={[0.6, 6, 0.6]} />
            </mesh>
          ))}
        </group>
        {/* hopper at the discharge end */}
        <mesh position={[SURFACE_CONVEYOR.beltLength + 2, 6.5, 0]} material={materials.conveyorFrame} castShadow>
          <boxGeometry args={[3, 4, 4]} />
        </mesh>
      </SectorMesh>

      {/* Haul road ramp (not an independently-monitored sector, just terrain) */}
      <mesh
        name="haul_road"
        userData={{ type: "haul_road" }}
        position={haulRoadTransform.position}
        quaternion={haulRoadTransform.quaternion}
        material={materials.haulRoad}
        receiveShadow
      >
        <boxGeometry args={[HAUL_ROAD.width, HAUL_ROAD.thickness, haulRoadTransform.length]} />
      </mesh>
    </group>
  );
}
