import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.enums import EvacuationRouteStatus, WorkerEvacuationStatus
from app.models.evacuation_graph import EvacuationEdge, EvacuationExit
from app.models.evacuation_route import EvacuationRoute
from app.models.worker_position import WorkerPosition
from app.services import emergency_broadcast_service

# How long (real seconds) a worker can go without an advancing hop before
# they're flagged DELAYED — whether from a manual demo stall or (in a real
# future integration) a tracker that stopped reporting movement. Chosen to
# be a few escalation-loop ticks (loop runs every 3s), not one, so a single
# slow tick under load doesn't false-positive.
DELAY_THRESHOLD_SECONDS = 15

_ADVANCEABLE_STATUSES = {
    WorkerEvacuationStatus.EVACUATION_ASSIGNED,
    WorkerEvacuationStatus.MOVING,
    WorkerEvacuationStatus.ROUTE_CHANGED,
    WorkerEvacuationStatus.DELAYED,
}


def _serialize_position(position: WorkerPosition) -> dict:
    return {
        "worker_id": str(position.worker_id),
        "current_node_id": str(position.current_node_id) if position.current_node_id else None,
        "sector_id": position.sector_id,
        "status": position.status.value,
        "active_route_id": str(position.active_route_id) if position.active_route_id else None,
        "manual_stall": position.manual_stall,
    }


def advance_one_hop(
    node_path: list[str], current_node_id: uuid.UUID | None, exit_node_id: uuid.UUID | None
) -> tuple[uuid.UUID, WorkerEvacuationStatus] | None:
    """Pure — unit-tested directly (tests/test_worker_position_simulation.py).
    Returns (next_node_id, new_status), or None if already at/past the final
    node in the path (nothing to advance)."""
    path = [uuid.UUID(node_id) for node_id in node_path]
    try:
        current_index = path.index(current_node_id)
    except ValueError:
        current_index = -1  # not on the path yet — snap to the start

    if current_index + 1 >= len(path):
        return None

    next_node_id = path[current_index + 1]
    status = WorkerEvacuationStatus.SAFE_AT_EXIT if next_node_id == exit_node_id else WorkerEvacuationStatus.MOVING
    return next_node_id, status


async def list_positions(db: AsyncSession) -> list[WorkerPosition]:
    result = await db.execute(select(WorkerPosition))
    return list(result.scalars().all())


async def get_position(db: AsyncSession, worker_id: uuid.UUID) -> WorkerPosition | None:
    return await db.get(WorkerPosition, worker_id)


async def advance_all_simulated(db: AsyncSession) -> list[WorkerPosition]:
    """Advances every SIMULATED worker with an active route one hop along
    its node_path. Reaching the exit node marks SAFE_AT_EXIT; otherwise
    MOVING. A worker with no active route, or already NOT_AFFECTED/
    SAFE_AT_EXIT, is left untouched. One commit for the whole batch — see
    the NullPool reconnect-cost note in evacuation_route_service.py."""
    result = await db.execute(
        select(WorkerPosition).where(
            WorkerPosition.status.in_(list(_ADVANCEABLE_STATUSES)), WorkerPosition.active_route_id.isnot(None)
        )
    )
    positions = list(result.scalars().all())
    if not positions:
        return []

    route_ids = {p.active_route_id for p in positions if p.active_route_id}
    routes_result = await db.execute(select(EvacuationRoute).where(EvacuationRoute.id.in_(route_ids)))
    routes_by_id = {r.id: r for r in routes_result.scalars().all()}

    exit_ids = {r.destination_exit_id for r in routes_by_id.values()}
    exits_result = await db.execute(select(EvacuationExit).where(EvacuationExit.id.in_(exit_ids)))
    exit_node_by_exit_id = {e.id: e.node_id for e in exits_result.scalars().all()}

    edges_result = await db.execute(select(EvacuationEdge))
    sector_by_node: dict[uuid.UUID, str] = {}
    for edge in edges_result.scalars().all():
        sector_by_node.setdefault(edge.from_node_id, edge.sector_id)
        sector_by_node.setdefault(edge.to_node_id, edge.sector_id)

    now = datetime.now(timezone.utc)
    advanced: list[WorkerPosition] = []
    for position in positions:
        if position.manual_stall:
            continue  # demo "Worker Not Moving" override — never advanced while set
        route = routes_by_id.get(position.active_route_id)
        if route is None:
            continue
        exit_node_id = exit_node_by_exit_id.get(route.destination_exit_id)
        step = advance_one_hop(route.node_path, position.current_node_id, exit_node_id)
        if step is None:
            continue  # already at (or past) the final node

        next_node_id, new_status = step
        position.current_node_id = next_node_id
        position.sector_id = sector_by_node.get(next_node_id, position.sector_id)
        position.status = new_status
        position.last_moved_at = now
        if new_status == WorkerEvacuationStatus.SAFE_AT_EXIT:
            # Without this, the route stays "ACTIVE" forever and a later
            # invalidate_and_reroute_all (triggered by an unrelated new
            # hazard) picks it back up, recomputes a trivial 0-distance
            # route from the exit node, and regresses the worker's status
            # from SAFE_AT_EXIT back to ROUTE_CHANGED — falsely undoing an
            # already-safe outcome. Found via live demo testing.
            route.status = EvacuationRouteStatus.COMPLETED
        advanced.append(position)

    await db.commit()
    for position in advanced:
        event_type = "WORKER_SAFE" if position.status == WorkerEvacuationStatus.SAFE_AT_EXIT else "WORKER_POSITION_UPDATED"
        await emergency_broadcast_service.publish(event_type, _serialize_position(position))
    return advanced


_DELAY_ELIGIBLE_STATUSES = {
    WorkerEvacuationStatus.EVACUATION_ASSIGNED,
    WorkerEvacuationStatus.MOVING,
    WorkerEvacuationStatus.ROUTE_CHANGED,
}


def is_delayed(position: WorkerPosition, now: datetime, threshold_seconds: int = DELAY_THRESHOLD_SECONDS) -> bool:
    """Pure — unit-tested directly (tests/test_worker_position_simulation.py).
    A worker who should currently be advancing but hasn't moved within
    `threshold_seconds` is delayed — whether from a manual demo stall or (in
    a real future integration) a tracker that stopped reporting movement.
    Already-DELAYED/NOT_AFFECTED/SAFE_AT_EXIT/UNACCOUNTED/TRACKING_LOST are
    never (re-)flagged here — those aren't "should be moving right now"."""
    if position.status not in _DELAY_ELIGIBLE_STATUSES:
        return False
    if position.active_route_id is None or position.last_moved_at is None:
        return False
    last_moved = (
        position.last_moved_at.replace(tzinfo=timezone.utc)
        if position.last_moved_at.tzinfo is None
        else position.last_moved_at
    )
    return (now - last_moved).total_seconds() >= threshold_seconds


async def detect_delayed_workers(db: AsyncSession) -> list[WorkerPosition]:
    """Flags DELAYED any worker who hasn't moved within DELAY_THRESHOLD_SECONDS
    — including a manually-stalled demo worker. Excludes positions already
    DELAYED from the query so a still-stalled worker isn't re-broadcast every
    tick; recovery (un-stalling) is handled by advance_all_simulated flipping
    them back to MOVING/SAFE_AT_EXIT on their next successful hop."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(WorkerPosition).where(
            WorkerPosition.status.in_(list(_DELAY_ELIGIBLE_STATUSES)),
            WorkerPosition.active_route_id.isnot(None),
        )
    )
    newly_delayed = [p for p in result.scalars().all() if is_delayed(p, now)]
    if not newly_delayed:
        return []

    for position in newly_delayed:
        position.status = WorkerEvacuationStatus.DELAYED

    await db.commit()
    for position in newly_delayed:
        await emergency_broadcast_service.publish("WORKER_POSITION_UPDATED", _serialize_position(position))
    return newly_delayed


async def set_worker_stalled(db: AsyncSession, worker_id: uuid.UUID, stalled: bool) -> WorkerPosition:
    """Demo-only "Worker Not Moving" toggle (POST
    /api/emergency/workers/positions/{id}/simulate/stall) — the simulator
    otherwise always advances a worker exactly one hop per tick, so this is
    the only way to trigger the DELAYED state on demand."""
    position = await db.get(WorkerPosition, worker_id)
    if position is None:
        raise NotFoundError("Worker position not found")

    position.manual_stall = stalled
    if not stalled:
        # Resuming — reset the clock so they aren't instantly re-flagged
        # DELAYED before the next tick has a chance to actually move them.
        position.last_moved_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(position)
    await emergency_broadcast_service.publish("WORKER_POSITION_UPDATED", _serialize_position(position))
    return position
