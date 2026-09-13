"use client";

// ============================================================================
// digital-twin/workers/WorkerLocationOverlay.tsx
//
// Additive 3D overlay for continuous worker geotagging — passed as
// `children` into <MineDigitalTwin>, the same way EmergencyTwinOverlay and
// SustainabilityTwinOverlay are. Always visible (not gated by an active
// emergency), rendering one marker per field worker at their current
// evacuation-graph node's real world_x/y/z — the same graph/coordinate
// system the emergency overlay already uses, not a second one.
//
// A dumb/presentational component: the caller (WorkerLocationsPanel) owns
// the fetch/poll loop and passes `locations` down, since the panel's table
// needs the exact same data — one fetch, two views, not two separate polls.
// ============================================================================

import { memo } from "react";
import { WorkerLocationMarker } from "./WorkerLocationMarker";
import type { WorkerLocation } from "@/lib/workerLocationsApi";

export const WorkerLocationOverlay = memo(function WorkerLocationOverlay({
  locations,
  onSelectWorker,
}: {
  locations: WorkerLocation[];
  onSelectWorker?: (workerId: string) => void;
}) {
  return (
    <group name="worker-location-overlay">
      {locations
        .filter((loc) => loc.world_x !== null && loc.world_y !== null && loc.world_z !== null)
        .map((loc) => (
          <WorkerLocationMarker
            key={loc.worker_id}
            workerId={loc.worker_id}
            workerName={loc.worker_name}
            detail={`${loc.node_label ?? "Unknown location"} · ${loc.is_active ? "Active" : "Idle"}`}
            isActive={loc.is_active}
            position={[loc.world_x as number, loc.world_y as number, loc.world_z as number]}
            onSelect={onSelectWorker}
          />
        ))}
    </group>
  );
});
