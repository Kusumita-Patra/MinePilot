import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.emergency_event import EmergencyEvent
from app.models.enums import EmergencyEventStatus, EvacuationNodeType, EvacuationRouteStatus, UserRole, WorkerEvacuationStatus
from app.models.evacuation_graph import EvacuationNode
from app.models.evacuation_route import EvacuationRoute
from app.models.user import User
from app.models.worker_position import WorkerPosition
from app.services import emergency_broadcast_service, evacuation_graph_service, evacuation_pathfinding_service
from app.services.evacuation_pathfinding_service import NoSafeRouteError

# Plain walking-speed constant for ETA — not a claim of real biomechanical
# modeling, just a reasonable demo figure.
_WALKING_SPEED_M_PER_S = 1.2

_SECTOR_DISPLAY_NAMES = {
    "sector_north_wall": "the North Wall",
    "sector_south_face": "the South Face",
    "sector_shaft_b": "Shaft B",
    "sector_conveyor_3": "Conveyor 3",
}


async def _list_field_workers(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).where(User.role == UserRole.field_worker, User.is_active.is_(True)))
    return list(result.scalars().all())


async def _active_events(db: AsyncSession) -> list[EmergencyEvent]:
    result = await db.execute(
        select(EmergencyEvent).where(
            EmergencyEvent.status.in_(
                [
                    EmergencyEventStatus.ACTIVE,
                    EmergencyEventStatus.ACKNOWLEDGED,
                    EmergencyEventStatus.ESCALATED,
                    EmergencyEventStatus.EVACUATION_ACTIVE,
                ]
            )
        )
    )
    return list(result.scalars().all())


def _assign_default_origins(nodes: list[EvacuationNode], workers: list[User]) -> dict[uuid.UUID, EvacuationNode]:
    """Distributes workers with no WorkerPosition yet round-robin across
    every WORK_AREA node, rather than stacking them all on a single node —
    otherwise a demo hazard that happens to fall in the one sector that
    single node sits in would strand every simulated worker at once (a real
    bug found during live verification: the seed graph's WORK_AREA nodes are
    one per sector, so picking only the first one made the whole workforce's
    fate hostage to which sector was hazarded). Falls back to any node if no
    WORK_AREA exists. Assignment order is stable (sorted by worker id) so
    re-running this function for the same roster is deterministic."""
    work_areas = [n for n in nodes if n.node_type == EvacuationNodeType.WORK_AREA]
    pool = work_areas or nodes
    if not pool:
        return {}
    ordered_workers = sorted(workers, key=lambda w: str(w.id))
    return {worker.id: pool[i % len(pool)] for i, worker in enumerate(ordered_workers)}


def _serialize_route(route: EvacuationRoute) -> dict:
    return {
        "id": str(route.id),
        "emergency_event_id": str(route.emergency_event_id),
        "worker_id": str(route.worker_id),
        "node_path": route.node_path,
        "total_distance": route.total_distance,
        "eta_seconds": route.eta_seconds,
        "safety_score": route.safety_score,
        "reason": route.reason,
        "route_version": route.route_version,
        "status": route.status.value,
    }


async def _get_or_create_position(db: AsyncSession, worker_id: uuid.UUID, default_node: EvacuationNode | None) -> WorkerPosition:
    position = await db.get(WorkerPosition, worker_id)
    if position is None:
        position = WorkerPosition(
            worker_id=worker_id,
            current_node_id=default_node.id if default_node else None,
            sector_id=default_node.sector_id if default_node else None,
            last_moved_at=datetime.now(timezone.utc),
        )
        db.add(position)
        await db.flush()
    elif position.current_node_id is None and default_node is not None:
        position.current_node_id = default_node.id
        position.sector_id = default_node.sector_id
    return position


async def assign_routes_for_active_evacuation(db: AsyncSession, event: EmergencyEvent) -> list[EvacuationRoute]:
    nodes, edges, exits = await evacuation_graph_service._all_graph(db)
    if not nodes or not exits:
        return []
    node_by_id = {node.id: node for node in nodes}
    active_events = await _active_events(db)
    workers = await _list_field_workers(db)
    default_origin_by_worker = _assign_default_origins(nodes, workers)

    routes: list[EvacuationRoute] = []
    for worker in workers:
        default_node = default_origin_by_worker.get(worker.id)
        position = await _get_or_create_position(db, worker.id, default_node)
        origin_node = node_by_id.get(position.current_node_id) if position.current_node_id else default_node
        if origin_node is None:
            continue

        try:
            computation = evacuation_pathfinding_service.compute_route(
                nodes, edges, exits, active_events, origin_node.id, sector_display_names=_SECTOR_DISPLAY_NAMES
            )
        except NoSafeRouteError:
            position.status = WorkerEvacuationStatus.UNACCOUNTED
            continue

        already_at_exit = len(computation.node_path) <= 1
        route = EvacuationRoute(
            emergency_event_id=event.id,
            worker_id=worker.id,
            origin_node_id=origin_node.id,
            destination_exit_id=computation.exit.id,
            node_path=[str(n) for n in computation.node_path],
            total_distance=computation.total_distance,
            eta_seconds=int(computation.total_distance / _WALKING_SPEED_M_PER_S),
            safety_score=computation.safety_score,
            hazards_avoided=computation.hazards_avoided,
            reason=computation.reason,
            status=EvacuationRouteStatus.COMPLETED if already_at_exit else EvacuationRouteStatus.ACTIVE,
        )
        db.add(route)
        await db.flush()

        # A worker whose origin already IS the exit node gets a trivial
        # 0-distance/1-node route — without this branch they'd sit at
        # EVACUATION_ASSIGNED forever (advance_one_hop has nothing to
        # advance for a 1-node path, so last_moved_at never updates), and
        # detect_delayed_workers would eventually flag them DELAYED despite
        # already being safe. Found live: every worker showed DELAYED with
        # a 0m/0s route after resolving several prior evacuations left them
        # standing at exits.
        position.status = WorkerEvacuationStatus.SAFE_AT_EXIT if already_at_exit else WorkerEvacuationStatus.EVACUATION_ASSIGNED
        position.active_route_id = route.id
        position.manual_stall = False
        position.last_moved_at = datetime.now(timezone.utc)
        routes.append(route)

    await db.commit()
    for route in routes:
        await db.refresh(route)
        await emergency_broadcast_service.publish("ROUTE_CREATED", _serialize_route(route))
    return routes


async def invalidate_and_reroute_all(db: AsyncSession) -> None:
    """Recomputes every ACTIVE route unconditionally on any new/escalated
    hazard during a live evacuation — simple and cheap at demo scale (a
    handful of simulated workers), rather than precisely targeting only
    routes that cross the newly-hazardous sector. Revisit at real workforce
    scale (see plan deviation 5)."""
    result = await db.execute(select(EvacuationRoute).where(EvacuationRoute.status == EvacuationRouteStatus.ACTIVE))
    active_routes = list(result.scalars().all())
    if not active_routes:
        return

    nodes, edges, exits = await evacuation_graph_service._all_graph(db)
    node_by_id = {node.id: node for node in nodes}
    active_events = await _active_events(db)
    now = datetime.now(timezone.utc)

    # Batch every change into ONE commit at the end rather than one per
    # route — under this project's required NullPool config, every
    # db.commit() tears down and reopens the physical Supabase connection
    # (see database.py / audit_service.py's docstring, and the identical bug
    # already found and fixed in sustainability_score_service.py this
    # session). A commit-per-route loop here would have the same
    # reconnect-storm problem during a multi-worker reroute.
    new_routes: list[EvacuationRoute] = []
    for old_route in active_routes:
        origin_node = node_by_id.get(old_route.origin_node_id)
        position = await db.get(WorkerPosition, old_route.worker_id)
        current_node = node_by_id.get(position.current_node_id) if position and position.current_node_id else origin_node
        if current_node is None:
            continue

        try:
            computation = evacuation_pathfinding_service.compute_route(
                nodes, edges, exits, active_events, current_node.id, sector_display_names=_SECTOR_DISPLAY_NAMES
            )
        except NoSafeRouteError:
            if position is not None:
                position.status = WorkerEvacuationStatus.UNACCOUNTED
            continue

        new_path = [str(n) for n in computation.node_path]
        if new_path == old_route.node_path:
            continue  # unchanged — leave this route alone

        old_route.status = EvacuationRouteStatus.INVALIDATED
        old_route.invalidated_at = now

        already_at_exit = len(new_path) <= 1
        new_route = EvacuationRoute(
            emergency_event_id=old_route.emergency_event_id,
            worker_id=old_route.worker_id,
            origin_node_id=current_node.id,
            destination_exit_id=computation.exit.id,
            node_path=new_path,
            total_distance=computation.total_distance,
            eta_seconds=int(computation.total_distance / _WALKING_SPEED_M_PER_S),
            safety_score=computation.safety_score,
            hazards_avoided=computation.hazards_avoided,
            reason=computation.reason,
            route_version=old_route.route_version + 1,
            status=EvacuationRouteStatus.COMPLETED if already_at_exit else EvacuationRouteStatus.ACTIVE,
        )
        db.add(new_route)
        await db.flush()
        old_route.superseded_by_route_id = new_route.id

        # Same "already at the exit" fix as assign_routes_for_active_evacuation
        # — a rerouted worker whose current node already IS the exit must be
        # marked SAFE_AT_EXIT immediately, not ROUTE_CHANGED, or they'd never
        # advance again and would eventually be flagged DELAYED instead.
        if position is not None:
            position.status = WorkerEvacuationStatus.SAFE_AT_EXIT if already_at_exit else WorkerEvacuationStatus.ROUTE_CHANGED
            position.active_route_id = new_route.id

        new_routes.append(new_route)

    if not new_routes:
        await db.commit()
        return

    await db.commit()
    for new_route in new_routes:
        await db.refresh(new_route)
        await emergency_broadcast_service.publish("ROUTE_CHANGED", _serialize_route(new_route))


async def clear_positions_for_event(db: AsyncSession, event: EmergencyEvent) -> None:
    """Called when an event resolves/cancels — without this, a worker's
    WorkerPosition.status stays stuck at SAFE_AT_EXIT/EVACUATION_ASSIGNED/etc.
    forever (found via live testing: the manager dashboard's worker
    accountability table never clears after an emergency is resolved,
    permanently showing stale evacuated workers as if still affected).
    Skips a worker if they have an ACTIVE route on some OTHER still-open
    event (a second, unrelated evacuation in progress) — only this event's
    own affected workers are reset. Also sweeps up UNACCOUNTED/
    TRACKING_LOST workers who never got a route at all (the honest
    "no safe route" case has no EvacuationRoute row to key off), but only
    once no evacuation is active anywhere — found live: an UNACCOUNTED
    worker with no route stayed stuck forever after their event resolved,
    since the routes-based lookup below never touches them. One commit for
    the whole batch."""
    result = await db.execute(
        select(EvacuationRoute).where(EvacuationRoute.emergency_event_id == event.id)
    )
    routes_for_event = list(result.scalars().all())
    worker_ids = {r.worker_id for r in routes_for_event}
    reset_positions = []

    if worker_ids:
        other_active_result = await db.execute(
            select(EvacuationRoute.worker_id).where(
                EvacuationRoute.emergency_event_id != event.id,
                EvacuationRoute.status == EvacuationRouteStatus.ACTIVE,
                EvacuationRoute.worker_id.in_(worker_ids),
            )
        )
        workers_still_evacuating_elsewhere = {row[0] for row in other_active_result.all()}

        for route in routes_for_event:
            if route.status == EvacuationRouteStatus.ACTIVE:
                route.status = EvacuationRouteStatus.COMPLETED

        positions_result = await db.execute(select(WorkerPosition).where(WorkerPosition.worker_id.in_(worker_ids)))
        for position in positions_result.scalars().all():
            if position.worker_id in workers_still_evacuating_elsewhere:
                continue
            position.status = WorkerEvacuationStatus.NOT_AFFECTED
            position.active_route_id = None
            reset_positions.append(position)

    from app.services import emergency_event_service

    if not await emergency_event_service.any_evacuation_active(db):
        stranded_result = await db.execute(
            select(WorkerPosition).where(
                WorkerPosition.status.in_([WorkerEvacuationStatus.UNACCOUNTED, WorkerEvacuationStatus.TRACKING_LOST]),
                WorkerPosition.active_route_id.is_(None),
            )
        )
        for position in stranded_result.scalars().all():
            position.status = WorkerEvacuationStatus.NOT_AFFECTED
            reset_positions.append(position)

    await db.commit()
    for position in reset_positions:
        await emergency_broadcast_service.publish(
            "WORKER_POSITION_UPDATED",
            {
                "worker_id": str(position.worker_id),
                "current_node_id": str(position.current_node_id) if position.current_node_id else None,
                "sector_id": position.sector_id,
                "status": position.status.value,
                "active_route_id": None,
            },
        )


async def get_route(db: AsyncSession, route_id: uuid.UUID) -> EvacuationRoute:
    route = await db.get(EvacuationRoute, route_id)
    if route is None:
        raise NotFoundError("Evacuation route not found")
    return route


async def get_active_route_for_worker(db: AsyncSession, worker_id: uuid.UUID) -> EvacuationRoute | None:
    result = await db.execute(
        select(EvacuationRoute)
        .where(EvacuationRoute.worker_id == worker_id, EvacuationRoute.status == EvacuationRouteStatus.ACTIVE)
        .order_by(EvacuationRoute.route_version.desc())
    )
    return result.scalars().first()


async def list_routes(
    db: AsyncSession, emergency_event_id: uuid.UUID | None = None, worker_id: uuid.UUID | None = None
) -> list[EvacuationRoute]:
    query = select(EvacuationRoute)
    if emergency_event_id is not None:
        query = query.where(EvacuationRoute.emergency_event_id == emergency_event_id)
    if worker_id is not None:
        query = query.where(EvacuationRoute.worker_id == worker_id)
    query = query.order_by(EvacuationRoute.generated_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())
