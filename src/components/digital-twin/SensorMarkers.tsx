"use client";

import { memo, useCallback, useMemo, useRef } from "react";

import { RiskEffectClock } from "./RiskEffects";
import { SensorPin } from "./SensorPin";
import { computeSectorStates } from "./sensorUtils";
import type { SectorStates, SensorData, SensorMarkersProps } from "./types";

/**
 * The sensor layer. Drop it inside the same <Canvas> as the mine scene:
 *
 *   <Canvas>
 *     <MineScene />
 *     <SensorMarkers
 *       sensors={sensorList}
 *       selectedSensor={selectedSensor}
 *       onSelectSensor={setSelectedSensor}
 *     />
 *   </Canvas>
 *
 * It knows nothing about the mine environment — no shared refs, no coupling to
 * terrain, camera or lighting.
 */
export const SensorMarkers = memo(function SensorMarkers({
  sensors,
  selectedSensor,
  onSelectSensor,
  onHoverSensor,
  markerScale = 1,
  showTooltips = true,
  emitLights = false,
}: SensorMarkersProps) {
  // Stable identities for the child callbacks, so a parent passing inline
  // arrow functions does not defeat React.memo on every marker.
  const selectRef = useRef(onSelectSensor);
  selectRef.current = onSelectSensor;

  const hoverRef = useRef(onHoverSensor);
  hoverRef.current = onHoverSensor;

  const handleSelect = useCallback((sensor: SensorData) => {
    selectRef.current?.(sensor);
  }, []);

  const handleHover = useCallback((sensor: SensorData | null) => {
    hoverRef.current?.(sensor);
  }, []);

  const selectedId = selectedSensor?.sensor_id ?? null;

  return (
    <group name="sensor-markers">
      {/* One frame callback drives every risk animation in the scene. */}
      <RiskEffectClock />

      {sensors.map((sensor) => (
        <SensorPin
          key={sensor.sensor_id}
          sensor={sensor}
          isSelected={sensor.sensor_id === selectedId}
          onSelect={handleSelect}
          onHoverChange={handleHover}
          scale={markerScale}
          showTooltip={showTooltips}
          emitLight={emitLights}
        />
      ))}
    </group>
  );
});

/**
 * Rolls the sensor list up into one risk state per sector. Pass the result to
 * <SectorHighlight />, or read it yourself for a legend or an alarm list.
 */
export function useSectorStates(sensors: SensorData[]): SectorStates {
  return useMemo(() => computeSectorStates(sensors), [sensors]);
}
