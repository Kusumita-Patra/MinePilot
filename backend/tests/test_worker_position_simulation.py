import uuid
from datetime import datetime, timedelta, timezone

from app.models.enums import WorkerEvacuationStatus
from app.models.worker_position import WorkerPosition
from app.services.worker_position_service import DELAY_THRESHOLD_SECONDS, advance_one_hop, is_delayed


def make_path(length: int) -> tuple[list[str], list[uuid.UUID]]:
    nodes = [uuid.uuid4() for _ in range(length)]
    return [str(n) for n in nodes], nodes


def test_advances_one_hop_along_the_path():
    path_strs, nodes = make_path(4)
    result = advance_one_hop(path_strs, nodes[0], exit_node_id=nodes[-1])
    assert result == (nodes[1], WorkerEvacuationStatus.MOVING)


def test_reaching_the_exit_node_sets_safe_at_exit():
    path_strs, nodes = make_path(3)
    result = advance_one_hop(path_strs, nodes[1], exit_node_id=nodes[2])
    assert result == (nodes[2], WorkerEvacuationStatus.SAFE_AT_EXIT)


def test_already_at_final_node_returns_none():
    path_strs, nodes = make_path(3)
    result = advance_one_hop(path_strs, nodes[-1], exit_node_id=nodes[-1])
    assert result is None


def test_worker_not_yet_on_path_snaps_to_the_start():
    path_strs, nodes = make_path(3)
    stray_node_id = uuid.uuid4()
    result = advance_one_hop(path_strs, stray_node_id, exit_node_id=nodes[-1])
    assert result == (nodes[0], WorkerEvacuationStatus.MOVING)


def test_worker_with_no_current_node_snaps_to_the_start():
    path_strs, nodes = make_path(3)
    result = advance_one_hop(path_strs, None, exit_node_id=nodes[-1])
    assert result == (nodes[0], WorkerEvacuationStatus.MOVING)


def make_position(status: WorkerEvacuationStatus, seconds_since_moved: float | None, has_route: bool = True) -> WorkerPosition:
    last_moved_at = (
        datetime.now(timezone.utc) - timedelta(seconds=seconds_since_moved) if seconds_since_moved is not None else None
    )
    return WorkerPosition(
        worker_id=uuid.uuid4(),
        status=status,
        active_route_id=uuid.uuid4() if has_route else None,
        last_moved_at=last_moved_at,
    )


def test_is_delayed_true_past_threshold():
    position = make_position(WorkerEvacuationStatus.MOVING, DELAY_THRESHOLD_SECONDS + 5)
    assert is_delayed(position, datetime.now(timezone.utc)) is True


def test_is_delayed_false_before_threshold():
    position = make_position(WorkerEvacuationStatus.MOVING, DELAY_THRESHOLD_SECONDS - 5)
    assert is_delayed(position, datetime.now(timezone.utc)) is False


def test_is_delayed_false_for_non_advanceable_status():
    position = make_position(WorkerEvacuationStatus.SAFE_AT_EXIT, DELAY_THRESHOLD_SECONDS + 5)
    assert is_delayed(position, datetime.now(timezone.utc)) is False


def test_is_delayed_false_without_active_route():
    position = make_position(WorkerEvacuationStatus.MOVING, DELAY_THRESHOLD_SECONDS + 5, has_route=False)
    assert is_delayed(position, datetime.now(timezone.utc)) is False


def test_is_delayed_false_without_last_moved_at():
    position = make_position(WorkerEvacuationStatus.MOVING, None)
    assert is_delayed(position, datetime.now(timezone.utc)) is False
