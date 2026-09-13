import uuid

from app.models.enums import EvacuationNodeType, UserRole
from app.models.evacuation_graph import EvacuationEdge, EvacuationNode
from app.models.user import User
from app.services.worker_geotracking_service import _assign_start_nodes, _build_adjacency


def make_node(node_type: EvacuationNodeType = EvacuationNodeType.JUNCTION, sector_id: str = "sector_north_wall") -> EvacuationNode:
    return EvacuationNode(
        id=uuid.uuid4(), node_type=node_type, sector_id=sector_id, world_x=0.0, world_y=0.0, world_z=0.0
    )


def make_edge(a: EvacuationNode, b: EvacuationNode) -> EvacuationEdge:
    return EvacuationEdge(id=uuid.uuid4(), from_node_id=a.id, to_node_id=b.id, sector_id=a.sector_id, distance=1.0)


def make_worker() -> User:
    return User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        password_hash="x",
        full_name="Test Worker",
        role=UserRole.field_worker,
        is_active=True,
    )


def test_build_adjacency_is_undirected():
    a, b, c = make_node(), make_node(), make_node()
    edges = [make_edge(a, b), make_edge(b, c)]
    adjacency = _build_adjacency(edges)
    assert b.id in adjacency[a.id]
    assert a.id in adjacency[b.id]
    assert c.id in adjacency[b.id]
    assert b.id in adjacency[c.id]
    assert a.id not in adjacency.get(c.id, [])


def test_build_adjacency_empty_edges():
    assert _build_adjacency([]) == {}


def test_assign_start_nodes_prefers_work_areas():
    work_area = make_node(EvacuationNodeType.WORK_AREA)
    junction = make_node(EvacuationNodeType.JUNCTION)
    workers = [make_worker() for _ in range(5)]
    assignment = _assign_start_nodes([work_area, junction], workers)
    assert all(node.node_type == EvacuationNodeType.WORK_AREA for node in assignment.values())


def test_assign_start_nodes_round_robins_across_all_work_areas():
    work_areas = [make_node(EvacuationNodeType.WORK_AREA) for _ in range(3)]
    workers = [make_worker() for _ in range(9)]
    assignment = _assign_start_nodes(work_areas, workers)
    assigned_node_ids = {node.id for node in assignment.values()}
    assert assigned_node_ids == {n.id for n in work_areas}, "every work area should receive at least one worker"


def test_assign_start_nodes_falls_back_to_any_node_when_no_work_area():
    junction = make_node(EvacuationNodeType.JUNCTION)
    workers = [make_worker()]
    assignment = _assign_start_nodes([junction], workers)
    assert assignment[workers[0].id].id == junction.id


def test_assign_start_nodes_empty_graph_returns_empty():
    assert _assign_start_nodes([], [make_worker()]) == {}


def test_assign_start_nodes_is_deterministic_for_same_roster():
    work_areas = [make_node(EvacuationNodeType.WORK_AREA) for _ in range(2)]
    workers = [make_worker() for _ in range(4)]
    first = _assign_start_nodes(work_areas, workers)
    second = _assign_start_nodes(work_areas, workers)
    assert {w: n.id for w, n in first.items()} == {w: n.id for w, n in second.items()}
