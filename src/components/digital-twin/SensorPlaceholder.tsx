"use client";

// ============================================================================
// digital-twin/SensorPlaceholder.tsx
//
// PLACEHOLDER ONLY. This file exists purely so `sensors`/`selectedSensor`/
// `onSelectSensor` have somewhere to plug in and the integration contract is
// demonstrably wired end-to-end. It deliberately does NOT implement:
//   - risk-based pulsing/strobe shaders
//   - hover tooltips
//   - raycasting/selection highlighting
//   - sector tinting
// That is the sensor-visualization developer's half of the module — this
// whole file is designed to be deleted and replaced by their component
// without touching anything else in digital-twin/.
//
// It's kept deliberately simple: a plain instancedMesh of small spheres,
// colored by risk_level, clickable. Positions come straight from
// `sensor.coordinates` with no transform — proving the environment's
// coordinate system is sensor-ready.
// ============================================================================

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D } from "three";
import type { SensorFrame } from "./types";
import { RISK_COLOR } from "./riskColors";

interface SensorPlaceholderProps {
  sensors: SensorFrame[];
  onSelectSensor?: (sensor: SensorFrame) => void;
}

export default function SensorPlaceholder({ sensors, onSelectSensor }: SensorPlaceholderProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    sensors.forEach((sensor, i) => {
      dummy.position.set(sensor.coordinates.x, sensor.coordinates.y, sensor.coordinates.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, new Color(RISK_COLOR[sensor.risk_level] ?? RISK_COLOR.NORMAL));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [sensors, dummy]);

  if (sensors.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, sensors.length]}
      onClick={(e) => {
        e.stopPropagation();
        const sensor = sensors[e.instanceId ?? -1];
        if (sensor) onSelectSensor?.(sensor);
      }}
    >
      <sphereGeometry args={[0.4, 12, 12]} />
      <meshStandardMaterial toneMapped={false} />
    </instancedMesh>
  );
}
