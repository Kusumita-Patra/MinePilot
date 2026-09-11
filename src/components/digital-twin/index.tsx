// ============================================================================
// digital-twin/index.tsx — public module surface
// ============================================================================

"use client";

import dynamic from "next/dynamic";

/**
 * SSR-safe default export. `next/dynamic(..., { ssr: false })` guarantees
 * the Canvas/WebGL tree is only ever mounted client-side, which avoids any
 * hydration mismatch from canvas sizing and sidesteps WebGL-in-SSR
 * edge cases entirely — the safest default for a component this heavy.
 *
 * If you need the `ref` (for `flyToPreset`/`flyToPoint`), import
 * `MineDigitalTwinInner` directly instead — `next/dynamic` output can't
 * forward refs.
 */
const MineDigitalTwin = dynamic(() => import("./MineDigitalTwin"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] flex items-center justify-center text-neutral-500 text-sm">
      Loading 3D environment…
    </div>
  ),
});

export default MineDigitalTwin;
export { default as MineDigitalTwinInner } from "./MineDigitalTwin";

export * from "./types";
export { mineSectors, mineSectorList, cameraPresets, cameraPresetList } from "./sectors";
export { useSectorRegistry, SectorRegistryProvider } from "./SectorRegistry";

export { SensorMarkers, useSectorStates } from "./SensorMarkers";
export { SensorLocationMarkers } from "./SensorLocationMarkers";
export { SensorPin } from "./SensorPin";
export type { SensorPinProps } from "./SensorPin";
export { SensorTooltip } from "./SensorTooltip";
export type { SensorTooltipProps } from "./SensorTooltip";

export { RiskEffectClock, RiskHalo, SelectionIndicator, ShockwaveRings } from "./RiskEffects";

export { SectorHighlight, SectorTint, defaultResolveSectorId } from "./SectorHighlight";
export type {
  SectorHighlightMode,
  SectorHighlightProps,
  SectorTintProps,
} from "./SectorHighlight";

export {
  RISK_COLORS,
  RISK_EFFECTS,
  RISK_LEVELS,
  RISK_PRIORITY,
  RISK_THRESHOLDS,
  classifyRiskLevel,
  computeSectorStates,
  getRiskColor,
  getRiskColorObject,
  hasSensorChanged,
  isRiskLevel,
  maxRiskLevel,
  resolveRiskLevel,
  sensorPosition,
} from "./sensorUtils";
export type { RiskEffectConfig } from "./sensorUtils";

export { getRiskMaterials, updateRiskMaterials, disposeRiskMaterials } from "./riskMaterials";

export { useTelemetrySocket, normalizeSensorPayload } from "./useTelemetrySocket";
export type {
  TelemetrySocketOptions,
  TelemetrySocketResult,
  TelemetryStatus,
} from "./useTelemetrySocket";

export { useMockTelemetry } from "./useMockTelemetry";
export type { MockTelemetryOptions } from "./useMockTelemetry";

export { mockSensors } from "./mockSensors";
