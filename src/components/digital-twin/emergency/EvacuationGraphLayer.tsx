"use client";

// ============================================================================
// digital-twin/emergency/EvacuationGraphLayer.tsx
//
// Renders the Emergency module's evacuation graph (nodes + edges) inside the
// existing 3D digital twin, additively — a separate overlay layer, not a
// modification to MineTerrain's procedural network. Node/edge world
// coordinates come straight from the backend (EvacuationNode.world_x/y/z),
// authored to sit inside the same space the procedural terrain occupies (see
// the seed migration's own coordinate notes), so this renders "inside" the
// existing mine visualization without needing any transform here.
//
// Color language matches the spec: red = CRITICAL/blocked (hard-excluded
// from routing), amber = WARNING (penalized, not excluded), blue = normal.
// ============================================================================

import { memo, useMemo, useState } from "react";
import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { EvacuationEdge, EvacuationNode } from "../../../../shared/types/emergency";
import { formatSectorId } from "@/lib/format";

const NODE_COLOR: Record<EvacuationNode["node_type"], string> = {
  EXIT: "#22c55e",
  REFUGE_CHAMBER: "#38bdf8",
  WORK_AREA: "#e2e8f0",
  JUNCTION: "#2f7dff",
};

const NODE_RADIUS: Record<EvacuationNode["node_type"], number> = {
  EXIT: 3.2,
  REFUGE_CHAMBER: 2.6,
  WORK_AREA: 2.2,
  JUNCTION: 1.4,
};

function edgeColor(edge: EvacuationEdge): string {
  if (edge.manually_blocked) return "#ff3b30";
  if (edge.hazard_level === "CRITICAL") return "#ff3b30";
  if (edge.hazard_level === "WARNING") return "#ffd400";
  return "#2f7dff";
}

function NodeMarker({
  node,
  onSelect,
}: {
  node: EvacuationNode;
  onSelect?: (node: EvacuationNode) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = NODE_COLOR[node.node_type];
  const radius = NODE_RADIUS[node.node_type];

  return (
    <group position={[node.world_x, node.world_y, node.world_z]} name={`evac-node:${node.id}`}>
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
          onSelect?.(node);
        }}
      >
        {node.node_type === "EXIT" ? (
          <octahedronGeometry args={[radius, 0]} />
        ) : (
          <sphereGeometry args={[radius, 12, 12]} />
        )}
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={hovered ? 1 : 0.85} />
      </mesh>
      <mesh>
        {node.node_type === "EXIT" ? (
          <octahedronGeometry args={[radius, 0]} />
        ) : (
          <sphereGeometry args={[radius, 12, 12]} />
        )}
        <meshBasicMaterial color={color} wireframe toneMapped={false} />
      </mesh>

      {hovered && (
        <Html position={[0, radius + 2.5, 0]} center distanceFactor={45} occlude={false}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
              padding: "3px 8px",
              borderRadius: 6,
              border: `1px solid ${color}88`,
              background: "rgba(5,10,20,0.82)",
              color: "#e4f1ff",
              fontSize: 10,
              fontWeight: 600,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            <span>{node.label ?? node.node_type}</span>
            <span style={{ color, fontSize: 9 }}>
              {node.node_type} · {formatSectorId(node.sector_id)}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

function EdgeLine({
  edge,
  fromPos,
  toPos,
  onSelect,
}: {
  edge: EvacuationEdge;
  fromPos: [number, number, number];
  toPos: [number, number, number];
  onSelect?: (edge: EvacuationEdge) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = edgeColor(edge);
  const excluded = edge.manually_blocked || edge.hazard_level === "CRITICAL";
  const mid: [number, number, number] = [
    (fromPos[0] + toPos[0]) / 2,
    (fromPos[1] + toPos[1]) / 2 + 1.5,
    (fromPos[2] + toPos[2]) / 2,
  ];

  return (
    <group>
      <Line
        points={[fromPos, toPos]}
        color={color}
        lineWidth={excluded ? 3.5 : hovered ? 2.5 : 1.5}
        dashed={excluded}
        dashSize={excluded ? 3 : undefined}
        gapSize={excluded ? 2 : undefined}
        transparent
        opacity={excluded ? 0.95 : 0.55}
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
          onSelect?.(edge);
        }}
      />
      {hovered && (
        <Html position={mid} center distanceFactor={45} occlude={false}>
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
              fontSize: 9,
              fontWeight: 600,
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}
          >
            <span>{formatSectorId(edge.sector_id)} · {edge.distance}m</span>
            <span style={{ color }}>
              {edge.manually_blocked
                ? `BLOCKED${edge.blocked_reason ? `: ${edge.blocked_reason}` : ""}`
                : edge.hazard_level
                  ? `${edge.hazard_level} HAZARD`
                  : "Clear"}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

export const EvacuationGraphLayer = memo(function EvacuationGraphLayer({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
}: {
  nodes: EvacuationNode[];
  edges: EvacuationEdge[];
  onSelectNode?: (node: EvacuationNode) => void;
  onSelectEdge?: (edge: EvacuationEdge) => void;
}) {
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <group name="evacuation-graph-layer">
      {edges.map((edge) => {
        const from = nodeById.get(edge.from_node_id);
        const to = nodeById.get(edge.to_node_id);
        if (!from || !to) return null;
        return (
          <EdgeLine
            key={edge.id}
            edge={edge}
            fromPos={[from.world_x, from.world_y, from.world_z]}
            toPos={[to.world_x, to.world_y, to.world_z]}
            onSelect={onSelectEdge}
          />
        );
      })}
      {nodes.map((node) => (
        <NodeMarker key={node.id} node={node} onSelect={onSelectNode} />
      ))}
    </group>
  );
});
