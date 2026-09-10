"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import { RiskHalo, SelectionIndicator, ShockwaveRings } from "./RiskEffects";
import { SensorTooltip } from "./SensorTooltip";
import { getRiskMaterials } from "./riskMaterials";
import { RISK_EFFECTS, getRiskColor, resolveRiskLevel } from "./sensorUtils";
import {
  BASE_RING_GEOMETRY,
  CORE_GEOMETRY,
  HIT_GEOMETRY,
  HIT_MATERIAL,
  NO_RAYCAST,
  PIN_HEIGHT,
  STEM_GEOMETRY,
  popPointerCursor,
  pushPointerCursor,
} from "./sharedGeometries";
import type { SensorData } from "./types";

export interface SensorPinProps {
  sensor: SensorData;
  isSelected: boolean;
  onSelect: (sensor: SensorData) => void;
  onHoverChange?: (sensor: SensorData | null) => void;
  scale?: number;
  showTooltip?: boolean;
  emitLight?: boolean;
}

const HOVER_SCALE = 1.28;
const SELECTED_SCALE = 1.12;

/**
 * One marker:
 *
 *        ●     emissive sphere head + shader halo + shockwave rings
 *        │
 *        │     beacon stem
 *        ▼
 *       ───    anchor ring, at the sensor's exact coordinate
 *
 * The group sits at the raw payload coordinate; everything else is built
 * upward from there so the anchor lands on the mine surface.
 */
function SensorPinImpl({
  sensor,
  isSelected,
  onSelect,
  onHoverChange,
  scale = 1,
  showTooltip = true,
  emitLight = false,
}: SensorPinProps) {
  const [hovered, setHovered] = useState(false);
  const headRef = useRef<THREE.Group>(null);

  // Keep the latest sensor/callback reachable from effects without making them
  // effect dependencies — telemetry updates must not re-fire hover side effects.
  const sensorRef = useRef(sensor);
  sensorRef.current = sensor;
  const hoverCallbackRef = useRef(onHoverChange);
  hoverCallbackRef.current = onHoverChange;

  const riskLevel = resolveRiskLevel(sensor);
  const effects = RISK_EFFECTS[riskLevel];
  const materials = getRiskMaterials();

  const handlePointerOver = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
  }, []);

  const handlePointerOut = useCallback((event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
  }, []);

  // Rule 5: the callback receives the whole SensorData object, never just an id.
  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      onSelect(sensorRef.current);
    },
    [onSelect],
  );

  // Cursor and parent notification are driven from the hover flag so that a
  // marker unmounting mid-hover still cleans up after itself.
  useEffect(() => {
    if (!hovered) return;

    pushPointerCursor();
    hoverCallbackRef.current?.(sensorRef.current);

    return () => {
      popPointerCursor();
      hoverCallbackRef.current?.(null);
    };
  }, [hovered]);

  /**
   * The only per-marker frame work: easing the head toward its hover/selection
   * size. It bails out in one comparison once the size has settled, so idle
   * markers cost a single function call per frame and nothing else.
   *
   * Risk animation is not handled here — it runs on shared materials driven by
   * <RiskEffectClock />.
   */
  useFrame((_, delta) => {
    const head = headRef.current;
    if (!head) return;

    const target = (hovered ? HOVER_SCALE : 1) * (isSelected ? SELECTED_SCALE : 1);
    const current = head.scale.x;

    if (Math.abs(current - target) < 0.001) {
      if (current !== target) head.scale.setScalar(target);
      return;
    }

    head.scale.setScalar(THREE.MathUtils.damp(current, target, 10, delta));
  });

  return (
    <group
      position={[sensor.coordinates.x, sensor.coordinates.y, sensor.coordinates.z]}
      name={`sensor:${sensor.sensor_id}`}
      userData={{ sensorId: sensor.sensor_id, sectorId: sensor.sector_id }}
    >
      <group scale={scale}>
        {/* Anchor ring, flat on the mine surface */}
        <mesh
          geometry={BASE_RING_GEOMETRY}
          material={materials.base[riskLevel]}
          raycast={NO_RAYCAST}
          dispose={null}
        />

        {/* Vertical beacon stem */}
        <mesh
          geometry={STEM_GEOMETRY}
          material={materials.stem[riskLevel]}
          position={[0, PIN_HEIGHT / 2, 0]}
          scale={[1, PIN_HEIGHT, 1]}
          raycast={NO_RAYCAST}
          dispose={null}
        />

        {isSelected && <SelectionIndicator height={PIN_HEIGHT} />}

        <group ref={headRef} position={[0, PIN_HEIGHT, 0]}>
          <mesh
            geometry={CORE_GEOMETRY}
            material={materials.core[riskLevel]}
            raycast={NO_RAYCAST}
            dispose={null}
          />

          <RiskHalo riskLevel={riskLevel} />

          {effects.shockwaveCount > 0 && <ShockwaveRings riskLevel={riskLevel} />}

          {emitLight && effects.lightIntensity > 0 && (
            <pointLight
              color={getRiskColor(riskLevel)}
              intensity={effects.lightIntensity}
              distance={7 * scale}
              decay={2}
            />
          )}

          {/* The one raycastable mesh in the marker: invisible, generous target */}
          <mesh
            geometry={HIT_GEOMETRY}
            material={HIT_MATERIAL}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
            onClick={handleClick}
            dispose={null}
          />

          {showTooltip && hovered && <SensorTooltip sensor={sensor} />}
        </group>
      </group>
    </group>
  );
}

/**
 * Memoized so a telemetry burst only re-renders the markers whose payload
 * actually changed. This depends on the data layer preserving object identity
 * for untouched sensors — see useTelemetrySocket.
 */
export const SensorPin = memo(SensorPinImpl);
