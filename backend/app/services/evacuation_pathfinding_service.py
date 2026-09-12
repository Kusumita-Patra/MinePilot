"""Pure, DB-write-free pathfinding core — deliberately isolated from any
AsyncSession so it's trivially unit-testable (see
tests/test_evacuation_pathfinding.py). Nothing here ever touches T2's
risk_scoring.py; it only consumes EmergencyEvent rows this module itself
creates.

Hard safety rule: a CRITICAL-severity sector's edges, and any
manually_blocked edge, are EXCLUDED from the adjacency list before search —
never merely penalized. This is what makes "a route through a critical
hazard can never be selected just because it's shorter" a structural
guarantee, not a tuning parameter (spec §3, §35).
"""
import heapq
import uuid
from dataclasses import dataclass

from app.exceptions.custom_exceptions import AppException
from app.models.emergency_event import EmergencyEvent
from app.models.enums import RiskLevel
from app.models.evacuation_graph import EvacuationEdge, EvacuationExit, EvacuationNode

# None = excluded entirely from the adjacency list, never merely penalized.
PENALTY_TABLE: dict[RiskLevel | None, float | None] = {
    None: 1.0,
    RiskLevel.NORMAL: 1.0,
    RiskLevel.WARNING: 2.5,
    RiskLevel.CRITICAL: None,
}

_SEVERITY_RANK = {RiskLevel.NORMAL: 0, RiskLevel.WARNING: 1, RiskLevel.CRITICAL: 2}

Adjacency = dict[uuid.UUID, list[tuple[uuid.UUID, float, EvacuationEdge]]]


class NoSafeRouteError(AppException):
    def __init__(self, message: str = "No safe evacuation route available"):
        super().__init__(message, status_code=409)


def worst_active_severity_by_sector(active_events: list[EmergencyEvent]) -> dict[str, RiskLevel]:
    result: dict[str, RiskLevel] = {}
    for event in active_events:
        current = result.get(event.trigger_sector_id)
        if current is None or _SEVERITY_RANK[event.severity] > _SEVERITY_RANK[current]:
            result[event.trigger_sector_id] = event.severity
    return result


def build_adjacency(
    nodes: list[EvacuationNode],
    edges: list[EvacuationEdge],
    hazard_by_sector: dict[str, RiskLevel],
    *,
    ignore_hazards: bool = False,
) -> Adjacency:
    adjacency: Adjacency = {node.id: [] for node in nodes}
    for edge in edges:
        # A manual physical closure is excluded regardless of ignore_hazards —
        # it's real topology, not transient hazard state.
        if edge.manually_blocked:
            continue
        if ignore_hazards:
            multiplier = 1.0
        else:
            severity = hazard_by_sector.get(edge.sector_id)
            multiplier = PENALTY_TABLE.get(severity, 1.0)
            if multiplier is None:
                continue
        weight = edge.distance * multiplier
        adjacency.setdefault(edge.from_node_id, []).append((edge.to_node_id, weight, edge))
        adjacency.setdefault(edge.to_node_id, []).append((edge.from_node_id, weight, edge))
    return adjacency


def dijkstra(adjacency: Adjacency, source_node_id: uuid.UUID) -> tuple[dict[uuid.UUID, float], dict[uuid.UUID, uuid.UUID | None]]:
    dist: dict[uuid.UUID, float] = {source_node_id: 0.0}
    prev: dict[uuid.UUID, uuid.UUID | None] = {source_node_id: None}
    visited: set[uuid.UUID] = set()
    heap: list[tuple[float, uuid.UUID]] = [(0.0, source_node_id)]
    while heap:
        d, node_id = heapq.heappop(heap)
        if node_id in visited:
            continue
        visited.add(node_id)
        for neighbor_id, weight, _edge in adjacency.get(node_id, []):
            nd = d + weight
            if neighbor_id not in dist or nd < dist[neighbor_id]:
                dist[neighbor_id] = nd
                prev[neighbor_id] = node_id
                heapq.heappush(heap, (nd, neighbor_id))
    return dist, prev


def find_best_exit(distances: dict[uuid.UUID, float], exits: list[EvacuationExit]) -> EvacuationExit | None:
    best: EvacuationExit | None = None
    best_dist: float | None = None
    for exit_ in exits:
        if not exit_.is_active:
            continue
        d = distances.get(exit_.node_id)
        if d is None:
            continue
        if best_dist is None or d < best_dist:
            best_dist = d
            best = exit_
    return best


def _reconstruct_path(prev: dict[uuid.UUID, uuid.UUID | None], target_node_id: uuid.UUID) -> list[uuid.UUID]:
    path = [target_node_id]
    while prev.get(path[-1]) is not None:
        path.append(prev[path[-1]])
    path.reverse()
    return path


def _path_sectors(path: list[uuid.UUID], edges: list[EvacuationEdge]) -> list[str]:
    edge_by_pair: dict[tuple[uuid.UUID, uuid.UUID], str] = {}
    for edge in edges:
        edge_by_pair[(edge.from_node_id, edge.to_node_id)] = edge.sector_id
        edge_by_pair[(edge.to_node_id, edge.from_node_id)] = edge.sector_id
    return [edge_by_pair[pair] for pair in zip(path, path[1:]) if pair in edge_by_pair]


@dataclass
class RouteComputation:
    exit: EvacuationExit
    node_path: list[uuid.UUID]
    total_distance: float
    hazards_avoided: list[dict]
    reason: str
    safety_score: float


def compute_route(
    nodes: list[EvacuationNode],
    edges: list[EvacuationEdge],
    exits: list[EvacuationExit],
    active_events: list[EmergencyEvent],
    origin_node_id: uuid.UUID,
    *,
    sector_display_names: dict[str, str] | None = None,
) -> RouteComputation:
    sector_display_names = sector_display_names or {}
    hazard_by_sector = worst_active_severity_by_sector(active_events)

    safe_adjacency = build_adjacency(nodes, edges, hazard_by_sector)
    safe_dist, safe_prev = dijkstra(safe_adjacency, origin_node_id)
    safe_exit = find_best_exit(safe_dist, exits)
    if safe_exit is None:
        raise NoSafeRouteError()
    safe_path = _reconstruct_path(safe_prev, safe_exit.node_id)

    naive_adjacency = build_adjacency(nodes, edges, hazard_by_sector, ignore_hazards=True)
    naive_dist, naive_prev = dijkstra(naive_adjacency, origin_node_id)
    naive_exit = find_best_exit(naive_dist, exits)
    naive_path = _reconstruct_path(naive_prev, naive_exit.node_id) if naive_exit is not None else None

    hazards_avoided = [
        {"sector_id": event.trigger_sector_id, "hazard_type": event.hazard_type.value, "severity": event.severity.value}
        for event in active_events
    ]

    penalized_edge_count = sum(1 for s in _path_sectors(safe_path, edges) if hazard_by_sector.get(s) == RiskLevel.WARNING)

    if naive_path == safe_path:
        reason = f"Shortest safe route to {safe_exit.name} — no active hazards along the way."
    else:
        naive_sectors = _path_sectors(naive_path, edges) if naive_path else []
        hazard_sector = next((s for s in naive_sectors if s in hazard_by_sector), None)
        if hazard_sector is not None:
            severity = hazard_by_sector[hazard_sector]
            hazard_type = next(
                (e.hazard_type.value for e in active_events if e.trigger_sector_id == hazard_sector), "hazard"
            )
            sector_label = sector_display_names.get(hazard_sector, hazard_sector)
            delta = safe_dist[safe_exit.node_id] - naive_dist.get(naive_exit.node_id, 0.0)
            reason = (
                f"Route selected because the shortest path passes through a {severity.value} {hazard_type} "
                f"zone in {sector_label}. This route is {delta:.0f}m longer but is currently the safest "
                f"feasible route to {safe_exit.name}."
            )
        else:
            reason = f"Shortest safe route to {safe_exit.name} — no active hazards along the way."

    safety_score = max(40.0, 100.0 - 20.0 * penalized_edge_count)

    return RouteComputation(
        exit=safe_exit,
        node_path=safe_path,
        total_distance=safe_dist[safe_exit.node_id],
        hazards_avoided=hazards_avoided,
        reason=reason,
        safety_score=safety_score,
    )
