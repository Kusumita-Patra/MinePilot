import uuid

import pytest

from app.models.emergency_event import EmergencyEvent
from app.models.enums import EmergencyEventStatus, EvacuationNodeType, HazardType, RiskLevel
from app.models.evacuation_graph import EvacuationEdge, EvacuationExit, EvacuationNode
from app.services.evacuation_pathfinding_service import (
    NoSafeRouteError,
    build_adjacency,
    compute_route,
    dijkstra,
    find_best_exit,
    worst_active_severity_by_sector,
)


def make_node(node_type=EvacuationNodeType.JUNCTION, sector="s1") -> EvacuationNode:
    return EvacuationNode(id=uuid.uuid4(), node_type=node_type, sector_id=sector, world_x=0, world_y=0, world_z=0)


def make_edge(a: EvacuationNode, b: EvacuationNode, distance: float, sector: str | None = None, blocked: bool = False) -> EvacuationEdge:
    return EvacuationEdge(
        id=uuid.uuid4(), from_node_id=a.id, to_node_id=b.id, sector_id=sector or a.sector_id,
        distance=distance, manually_blocked=blocked,
    )


def make_exit(node: EvacuationNode, name: str = "Exit") -> EvacuationExit:
    return EvacuationExit(id=uuid.uuid4(), node_id=node.id, name=name, sector_id=node.sector_id, is_active=True)


def make_event(sector: str, severity: RiskLevel, hazard_type=HazardType.METHANE) -> EmergencyEvent:
    return EmergencyEvent(
        id=uuid.uuid4(), hazard_type=hazard_type, severity=severity, status=EmergencyEventStatus.ACTIVE,
        trigger_sector_id=sector, escalation_timeout_seconds=120,
    )


def test_critical_edge_excluded_even_when_only_short_path():
    # A -> B (short, but B is in a CRITICAL sector) -> Exit
    # A -> C -> D -> Exit (longer, but safe)
    a, b, c, d = make_node(sector="danger"), make_node(sector="danger"), make_node(sector="safe"), make_node(sector="safe")
    exit_node = make_node(node_type=EvacuationNodeType.EXIT, sector="safe")
    edges = [
        make_edge(a, b, 10, sector="danger"),
        make_edge(b, exit_node, 10, sector="danger"),
        make_edge(a, c, 50, sector="safe"),
        make_edge(c, d, 50, sector="safe"),
        make_edge(d, exit_node, 50, sector="safe"),
    ]
    exits = [make_exit(exit_node)]
    events = [make_event("danger", RiskLevel.CRITICAL)]

    result = compute_route([a, b, c, d, exit_node], edges, exits, events, a.id)

    assert b.id not in result.node_path
    assert result.node_path == [a.id, c.id, d.id, exit_node.id]
    assert result.total_distance == 150


def test_manually_blocked_edge_excluded_regardless_of_severity():
    a, b = make_node(sector="s1"), make_node(sector="s1")
    exit_node = make_node(node_type=EvacuationNodeType.EXIT, sector="s1")
    edges = [make_edge(a, b, 5, blocked=True), make_edge(b, exit_node, 5)]
    exits = [make_exit(exit_node)]

    with pytest.raises(NoSafeRouteError):
        compute_route([a, b, exit_node], edges, exits, [], a.id)


def test_no_safe_route_raises_when_nothing_reachable():
    a = make_node()
    exit_node = make_node(node_type=EvacuationNodeType.EXIT)
    # No edge at all between them.
    with pytest.raises(NoSafeRouteError):
        compute_route([a, exit_node], [], [make_exit(exit_node)], [], a.id)


def test_two_exits_picks_the_closer_reachable_one():
    a, mid = make_node(), make_node()
    near_exit = make_node(node_type=EvacuationNodeType.EXIT)
    far_exit = make_node(node_type=EvacuationNodeType.EXIT)
    edges = [make_edge(a, mid, 10), make_edge(mid, near_exit, 5), make_edge(mid, far_exit, 100)]
    exits = [make_exit(near_exit, "Near"), make_exit(far_exit, "Far")]

    result = compute_route([a, mid, near_exit, far_exit], edges, exits, [], a.id)

    assert result.exit.name == "Near"
    assert result.total_distance == 15


def test_inactive_exit_is_never_selected():
    a = make_node()
    inactive_exit = make_node(node_type=EvacuationNodeType.EXIT)
    edges = [make_edge(a, inactive_exit, 5)]
    exit_row = make_exit(inactive_exit)
    exit_row.is_active = False

    with pytest.raises(NoSafeRouteError):
        compute_route([a, inactive_exit], edges, [exit_row], [], a.id)


def test_reason_names_the_avoided_hazard_when_paths_differ():
    a, b = make_node(sector="danger"), make_node(sector="danger")
    c, d = make_node(sector="safe"), make_node(sector="safe")
    exit_node = make_node(node_type=EvacuationNodeType.EXIT, sector="safe")
    edges = [
        make_edge(a, b, 10, sector="danger"), make_edge(b, exit_node, 10, sector="danger"),
        make_edge(a, c, 50, sector="safe"), make_edge(c, d, 50, sector="safe"), make_edge(d, exit_node, 50, sector="safe"),
    ]
    exits = [make_exit(exit_node)]
    events = [make_event("danger", RiskLevel.CRITICAL)]

    result = compute_route([a, b, c, d, exit_node], edges, exits, events, a.id, sector_display_names={"danger": "Sector B"})

    assert "CRITICAL" in result.reason
    assert "METHANE" in result.reason
    assert "Sector B" in result.reason


def test_reason_is_plain_when_no_hazard_affects_the_shortest_path():
    a, exit_node = make_node(), make_node(node_type=EvacuationNodeType.EXIT)
    edges = [make_edge(a, exit_node, 10)]
    exits = [make_exit(exit_node)]

    result = compute_route([a, exit_node], edges, exits, [], a.id)

    assert "no active hazards" in result.reason


def test_worst_active_severity_by_sector_takes_the_max():
    events = [make_event("s1", RiskLevel.WARNING), make_event("s1", RiskLevel.CRITICAL), make_event("s2", RiskLevel.WARNING)]
    result = worst_active_severity_by_sector(events)
    assert result["s1"] == RiskLevel.CRITICAL
    assert result["s2"] == RiskLevel.WARNING


def test_warning_sector_penalized_not_excluded():
    a, b = make_node(sector="warn"), make_node(sector="warn")
    exit_node = make_node(node_type=EvacuationNodeType.EXIT, sector="warn")
    edges = [make_edge(a, b, 10, sector="warn"), make_edge(b, exit_node, 10, sector="warn")]
    exits = [make_exit(exit_node)]
    events = [make_event("warn", RiskLevel.WARNING)]

    # Should still succeed (not excluded), just at a higher effective cost —
    # verified indirectly via find_best_exit/dijkstra still finding it.
    result = compute_route([a, b, exit_node], edges, exits, events, a.id)
    assert result.node_path == [a.id, b.id, exit_node.id]
