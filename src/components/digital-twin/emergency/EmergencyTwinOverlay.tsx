"use client";

// ============================================================================
// digital-twin/emergency/EmergencyTwinOverlay.tsx
//
// The single component the Manager Dashboard passes as `children` to
// <MineDigitalTwin>, additively layering the evacuation graph, worker
// positions, and active routes onto the existing 3D twin — no changes to
// MineTerrain.tsx or the procedural network.
// ============================================================================

import { memo, useMemo } from "react";
import { EvacuationGraphLayer } from "./EvacuationGraphLayer";
import { WorkerMarker } from "./WorkerMarker";
import { RouteHighlight } from "./RouteHighlight";
import type {
  EvacuationEdge,
  EvacuationNode,
  EvacuationRoute,
  WorkerPosition,
} from "../../../../shared/types/emergency";

export interface EmergencyTwinOverlayProps {
  nodes: EvacuationNode[];
  edges: EvacuationEdge[];
  positions: WorkerPosition[];
  routes: EvacuationRoute[];
  workerNameById: Record<string, string>;
  onSelectWorker?: (workerId: string) => void;
  onSelectNode?: (node: EvacuationNode) => void;
  onSelectEdge?: (edge: EvacuationEdge) => void;
}

export const EmergencyTwinOverlay = memo(function EmergencyTwinOverlay({
  nodes,
  edges,
  positions,
  routes,
  workerNameById,
  onSelectWorker,
  onSelectNode,
  onSelectEdge,
}: EmergencyTwinOverlayProps) {
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const affectedPositions = useMemo(() => positions.filter((p) => p.status !== "NOT_AFFECTED"), [positions]);

  return (
    <group name="emergency-twin-overlay">
      <EvacuationGraphLayer nodes={nodes} edges={edges} onSelectNode={onSelectNode} onSelectEdge={onSelectEdge} />

      {routes
        .filter((r) => r.status === "ACTIVE")
        .map((route) => (
          <RouteHighlight key={route.id} nodePath={route.node_path} nodesById={nodesById} />
        ))}

      {affectedPositions.map((position) => {
        const node = position.current_node_id ? nodesById.get(position.current_node_id) : undefined;
        if (!node) return null;
        return (
          <WorkerMarker
            key={position.worker_id}
            workerId={position.worker_id}
            workerName={workerNameById[position.worker_id] ?? position.worker_id.slice(0, 8)}
            status={position.status}
            position={[node.world_x, node.world_y, node.world_z]}
            onSelect={onSelectWorker}
          />
        );
      })}
    </group>
  );
});
