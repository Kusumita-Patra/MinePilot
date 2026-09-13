"""Continuous, always-on worker geotagging. A background simulator places
every active field_worker at a node on the existing evacuation graph and
occasionally moves them to an adjacent node, independent of any emergency.
Structural template is emergency_escalation_service.py / sustainability_
simulator_service.py (stop_event + a hard per-tick timeout — the timeout
exists because a stuck tick was found live to wedge the whole app's
shutdown/reload, not just its own loop).

Deliberately reuses the same evacuation_nodes/evacuation_edges graph (real
world_x/y/z coordinates) the 3D twin's emergency overlay already renders
from — not a second coordinate system. Writes to WorkerLocation only, NEVER
to WorkerPosition/evacuation routes/pathfinding (see WorkerLocation's own
docstring for why these are kept as two separate tables).

There is no real underground personnel-tracking hardware in this project —
every row this produces is source_type=SIMULATED, same honesty caveat as
WorkerPosition and the Sustainability simulator.
"""

import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.enums import EvacuationNodeType, UserRole
from app.models.evacuation_graph import EvacuationEdge, EvacuationNode
from app.models.user import User
from app.models.worker_location import WorkerLocation
from app.services import evacuation_graph_service

logger = logging.getLogger("minepilot.backend.worker_geotracking")

# A worker who hasn't moved within this many seconds shows as "Idle" in the
# panel — not offline/broken, just stationed at one spot for a while (most
# of a shift is spent at one work area, not constantly walking). Wider than
# the tick interval so one quiet tick doesn't false-positive.
IDLE_THRESHOLD_SECONDS = 180

# Chance an already-placed worker takes one step to an adjacent node this
# tick rather than staying put — most ticks, most workers stay at their
# current work area (realistic), while still giving visible movement across
# the mine over a few minutes of ticks.
_MOVE_PROBABILITY = 0.35


def _build_adjacency(edges: list[EvacuationEdge]) -> dict[uuid.UUID, list[uuid.UUID]]:
    """Pure — unit-tested directly. Undirected: evacuation_edges themselves
    are undirected (see EvacuationEdge's own docstring), so a hop is valid
    in either direction."""
    adjacency: dict[uuid.UUID, list[uuid.UUID]] = {}
    for edge in edges:
        adjacency.setdefault(edge.from_node_id, []).append(edge.to_node_id)
        adjacency.setdefault(edge.to_node_id, []).append(edge.from_node_id)
    return adjacency


def _assign_start_nodes(nodes: list[EvacuationNode], workers: list[User]) -> dict[uuid.UUID, EvacuationNode]:
    """Pure — unit-tested directly. Round-robins newly-seen workers across
    every WORK_AREA node (falls back to any node) rather than stacking them
    all on one — same reasoning as evacuation_route_service.
    _assign_default_origins. Deterministic ordering (sorted by worker id)
    so re-running for the same roster is stable."""
    work_areas = [n for n in nodes if n.node_type == EvacuationNodeType.WORK_AREA]
    pool = work_areas or nodes
    if not pool:
        return {}
    ordered = sorted(workers, key=lambda w: str(w.id))
    return {worker.id: pool[i % len(pool)] for i, worker in enumerate(ordered)}


async def _tick_once() -> None:
    async with AsyncSessionLocal() as db:
        workers_result = await db.execute(
            select(User).where(User.role == UserRole.field_worker, User.is_active.is_(True))
        )
        workers = list(workers_result.scalars().all())
        if not workers:
            return

        nodes, edges, _exits = await evacuation_graph_service._all_graph(db)
        if not nodes:
            return
        node_by_id = {n.id: n for n in nodes}
        adjacency = _build_adjacency(edges)

        existing_result = await db.execute(
            select(WorkerLocation).where(WorkerLocation.worker_id.in_([w.id for w in workers]))
        )
        existing_by_worker = {loc.worker_id: loc for loc in existing_result.scalars().all()}

        unplaced = [w for w in workers if w.id not in existing_by_worker]
        start_node_by_worker = _assign_start_nodes(nodes, unplaced) if unplaced else {}

        now = datetime.now(timezone.utc)
        for worker in workers:
            location = existing_by_worker.get(worker.id)
            if location is None:
                start = start_node_by_worker.get(worker.id)
                if start is None:
                    continue
                db.add(
                    WorkerLocation(
                        worker_id=worker.id,
                        current_node_id=start.id,
                        sector_id=start.sector_id,
                        last_moved_at=now,
                    )
                )
                continue

            if location.current_node_id is None:
                continue
            neighbors = adjacency.get(location.current_node_id, [])
            if not neighbors or random.random() > _MOVE_PROBABILITY:
                continue
            next_node_id = random.choice(neighbors)
            next_node = node_by_id.get(next_node_id)
            if next_node is None:
                continue
            location.current_node_id = next_node_id
            location.sector_id = next_node.sector_id
            location.last_moved_at = now

        await db.commit()


async def list_locations(db: AsyncSession) -> list[dict]:
    result = await db.execute(select(WorkerLocation))
    locations = list(result.scalars().all())
    if not locations:
        return []

    worker_ids = [loc.worker_id for loc in locations]
    users_result = await db.execute(select(User).where(User.id.in_(worker_ids)))
    user_by_id = {u.id: u for u in users_result.scalars().all()}

    node_ids = [loc.current_node_id for loc in locations if loc.current_node_id]
    node_by_id: dict[uuid.UUID, EvacuationNode] = {}
    if node_ids:
        nodes_result = await db.execute(select(EvacuationNode).where(EvacuationNode.id.in_(node_ids)))
        node_by_id = {n.id: n for n in nodes_result.scalars().all()}

    now = datetime.now(timezone.utc)
    enriched = []
    for loc in locations:
        user = user_by_id.get(loc.worker_id)
        # A user who was deleted, deactivated, or moved off field_worker
        # since their last tick still has a WorkerLocation row (the tick
        # loop only ever *stops adding new writes* for such a worker — it
        # never deletes their last-known row), which would otherwise show
        # them as still tracked/idle forever at a stale position.
        if user is None or not user.is_active or user.role != UserRole.field_worker:
            continue
        node = node_by_id.get(loc.current_node_id) if loc.current_node_id else None
        last_moved = loc.last_moved_at
        if last_moved is not None and last_moved.tzinfo is None:
            last_moved = last_moved.replace(tzinfo=timezone.utc)
        is_active = last_moved is not None and (now - last_moved) <= timedelta(seconds=IDLE_THRESHOLD_SECONDS)
        enriched.append(
            {
                "worker_id": loc.worker_id,
                "worker_name": user.full_name,
                "role": user.role,
                "current_node_id": loc.current_node_id,
                "node_label": node.label if node else None,
                "node_type": node.node_type.value if node else None,
                "sector_id": loc.sector_id,
                "world_x": node.world_x if node else None,
                "world_y": node.world_y if node else None,
                "world_z": node.world_z if node else None,
                "source_type": loc.source_type,
                "last_moved_at": loc.last_moved_at,
                "is_active": is_active,
            }
        )
    enriched.sort(key=lambda d: d["worker_name"])
    return enriched


async def run_worker_geotracking_loop(stop_event: asyncio.Event) -> None:
    """Fourth background task, same stop_event/wrapped-timeout shape as
    run_sustainability_simulator_loop. Always ticks while enabled — this is
    a continuous operational feature, not a start/pause-able demo scenario,
    so there is no runtime toggle (settings.worker_geotracking_enabled
    deciding whether this task exists at all is the only on/off switch)."""
    settings = get_settings()
    tick_seconds = settings.worker_geotracking_interval_seconds

    while not stop_event.is_set():
        try:
            await asyncio.wait_for(_tick_once(), timeout=30)
        except asyncio.TimeoutError:
            logger.error("Worker geotracking tick timed out after 30s — skipping this tick")
        except Exception:
            logger.exception("Worker geotracking tick failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=tick_seconds)
        except asyncio.TimeoutError:
            pass
