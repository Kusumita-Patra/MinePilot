"use client";

// ============================================================================
// digital-twin/emergency/RouteHighlight.tsx
//
// Highlights one worker's computed evacuation route as a bright green line
// along its node path — "green = recommended route" per the module's color
// language. A worker with no safe route never reaches this component (no
// route object exists for them), which is itself the honest visual: no
// fabricated route is ever drawn.
// ============================================================================

import { memo, useMemo } from "react";
import { Line } from "@react-three/drei";
import type { EvacuationNode } from "../../../../shared/types/emergency";

export const RouteHighlight = memo(function RouteHighlight({
  nodePath,
  nodesById,
  color = "#22c55e",
}: {
  nodePath: string[];
  nodesById: Map<string, EvacuationNode>;
  color?: string;
}) {
  const points = useMemo<[number, number, number][]>(() => {
    return nodePath
      .map((id) => nodesById.get(id))
      .filter((n): n is EvacuationNode => !!n)
      .map((n) => [n.world_x, n.world_y + 1, n.world_z] as [number, number, number]);
  }, [nodePath, nodesById]);

  if (points.length < 2) return null;

  return <Line points={points} color={color} lineWidth={4} transparent opacity={0.9} />;
});
