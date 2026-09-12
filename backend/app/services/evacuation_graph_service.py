import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.blueprint import BlueprintSection
from app.models.emergency_event import EmergencyEvent
from app.models.enums import EmergencyEventStatus, EvacuationNodeType, RiskLevel
from app.models.evacuation_graph import EvacuationEdge, EvacuationExit, EvacuationNode
from app.models.user import User
from app.schemas.emergency import EvacuationExitCreate, EvacuationExitUpdate
from app.services import blueprint_service, evacuation_pathfinding_service

# Same pixel->world formula as src/lib/blueprintCoords.ts — kept in sync by
# hand since this is the one place the backend needs it (pathfinding/graph
# construction), not a shared package between the two runtimes.
BLUEPRINT_WORLD_SPAN = 1200.0


def _pixel_to_world_xz(px: float, py: float, image_width: int, image_height: int) -> tuple[float, float]:
    scale = BLUEPRINT_WORLD_SPAN / max(image_width, image_height)
    return (px - image_width / 2) * scale, (py - image_height / 2) * scale


async def _all_graph(db: AsyncSession) -> tuple[list[EvacuationNode], list[EvacuationEdge], list[EvacuationExit]]:
    nodes = (await db.execute(select(EvacuationNode))).scalars().all()
    edges = (await db.execute(select(EvacuationEdge))).scalars().all()
    exits = (await db.execute(select(EvacuationExit))).scalars().all()
    return list(nodes), list(edges), list(exits)


async def get_graph_snapshot(db: AsyncSession) -> dict:
    nodes, edges, exits = await _all_graph(db)

    active_events = list(
        (
            await db.execute(
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
        )
        .scalars()
        .all()
    )
    hazard_by_sector = evacuation_pathfinding_service.worst_active_severity_by_sector(active_events)

    enriched_edges = []
    for edge in edges:
        hazard_level = None if edge.manually_blocked else hazard_by_sector.get(edge.sector_id)
        is_excluded = edge.manually_blocked or hazard_level == RiskLevel.CRITICAL
        enriched_edges.append(
            {
                **{col.name: getattr(edge, col.name) for col in edge.__table__.columns},
                "hazard_level": hazard_level,
                "is_excluded": is_excluded,
            }
        )

    return {"nodes": nodes, "edges": enriched_edges, "exits": exits}


async def derive_from_blueprint(db: AsyncSession, blueprint_id: uuid.UUID, current_user: User) -> dict:
    """Adapter: each active BlueprintSection's path endpoints become/reuse
    EvacuationNodes, and the section itself becomes one EvacuationEdge.
    Idempotent by blueprint_section_id — re-running for the same blueprint
    updates rather than duplicates."""
    blueprint = await blueprint_service.get_blueprint(db, blueprint_id)
    # get_blueprint doesn't eager-load .sections — query explicitly rather
    # than touching the lazy relationship outside an awaited context (the
    # exact MissingGreenlet gotcha already documented in this codebase for
    # blueprint_service.create_blueprint).
    sections = list((await db.execute(select(BlueprintSection).where(BlueprintSection.blueprint_id == blueprint_id))).scalars().all())

    existing_nodes = {
        node.blueprint_section_id: node
        for node in (
            await db.execute(select(EvacuationNode).where(EvacuationNode.blueprint_section_id.isnot(None)))
        )
        .scalars()
        .all()
    }
    existing_edges = {
        edge.blueprint_section_id: edge
        for edge in (
            await db.execute(select(EvacuationEdge).where(EvacuationEdge.blueprint_section_id.isnot(None)))
        )
        .scalars()
        .all()
    }

    created_nodes = 0
    created_edges = 0
    for section in sections:
        if not section.path or len(section.path) < 2:
            continue
        start_px, start_py = section.path[0]
        end_px, end_py = section.path[-1]
        start_x, start_z = _pixel_to_world_xz(start_px, start_py, blueprint.image_width, blueprint.image_height)
        end_x, end_z = _pixel_to_world_xz(end_px, end_py, blueprint.image_width, blueprint.image_height)

        # Reuse the same node for a section re-derived a second time; a
        # section derived for the first time always gets two fresh nodes
        # (start/end) rather than trying to dedupe against unrelated nodes
        # at the same coordinates — simpler and safe for this adapter's scope.
        start_node = existing_nodes.get(section.id)
        if start_node is None:
            start_node = EvacuationNode(
                node_type=EvacuationNodeType.JUNCTION,
                sector_id=section.sector_id,
                blueprint_section_id=section.id,
                world_x=start_x,
                world_y=section.depth,
                world_z=start_z,
                label=f"{section.name} (start)",
            )
            db.add(start_node)
            created_nodes += 1
        else:
            start_node.world_x, start_node.world_y, start_node.world_z = start_x, section.depth, start_z

        end_node = EvacuationNode(
            node_type=EvacuationNodeType.JUNCTION,
            sector_id=section.sector_id,
            blueprint_section_id=None,  # only one node per section carries the FK, to keep the mapping 1:1
            world_x=end_x,
            world_y=section.depth,
            world_z=end_z,
            label=f"{section.name} (end)",
        )
        db.add(end_node)
        await db.flush()
        created_nodes += 1

        distance = ((end_x - start_x) ** 2 + (end_z - start_z) ** 2) ** 0.5
        edge = existing_edges.get(section.id)
        if edge is None:
            edge = EvacuationEdge(
                from_node_id=start_node.id,
                to_node_id=end_node.id,
                sector_id=section.sector_id,
                distance=distance,
                blueprint_section_id=section.id,
            )
            db.add(edge)
            created_edges += 1
        else:
            edge.to_node_id = end_node.id
            edge.distance = distance

    await db.commit()

    from app.services import audit_service

    await audit_service.record(
        db,
        actor=current_user,
        action="evacuation_graph.derive_from_blueprint",
        resource_type="evacuation_graph",
        resource_id=str(blueprint_id),
        description=f"Derived evacuation graph from blueprint '{blueprint.name}' ({created_nodes} nodes, {created_edges} edges)",
    )
    return {"nodes_created": created_nodes, "edges_created": created_edges}


async def create_exit(db: AsyncSession, payload: EvacuationExitCreate, current_user: User) -> EvacuationExit:
    from app.services import audit_service

    node = await db.get(EvacuationNode, payload.node_id)
    if node is None:
        raise NotFoundError("Evacuation node not found")

    exit_ = EvacuationExit(
        node_id=payload.node_id, name=payload.name, sector_id=payload.sector_id, capacity_note=payload.capacity_note
    )
    db.add(exit_)
    await audit_service.record(
        db,
        actor=current_user,
        action="evacuation_exit.create",
        resource_type="evacuation_exit",
        description=f"Added evacuation exit '{payload.name}'",
        commit=False,
    )
    await db.commit()
    await db.refresh(exit_)
    return exit_


async def update_exit(db: AsyncSession, exit_id: uuid.UUID, payload: EvacuationExitUpdate, current_user: User) -> EvacuationExit:
    from app.services import audit_service

    exit_ = await db.get(EvacuationExit, exit_id)
    if exit_ is None:
        raise NotFoundError("Evacuation exit not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(exit_, field, value)

    await audit_service.record(
        db,
        actor=current_user,
        action="evacuation_exit.update",
        resource_type="evacuation_exit",
        resource_id=str(exit_id),
        description=f"Updated evacuation exit '{exit_.name}'",
        commit=False,
    )
    await db.commit()
    await db.refresh(exit_)
    return exit_


async def delete_exit(db: AsyncSession, exit_id: uuid.UUID, current_user: User) -> None:
    from app.services import audit_service

    exit_ = await db.get(EvacuationExit, exit_id)
    if exit_ is None:
        raise NotFoundError("Evacuation exit not found")

    name = exit_.name
    await db.delete(exit_)
    await audit_service.record(
        db,
        actor=current_user,
        action="evacuation_exit.delete",
        resource_type="evacuation_exit",
        resource_id=str(exit_id),
        description=f"Removed evacuation exit '{name}'",
        commit=False,
    )
    await db.commit()


async def set_edge_block(db: AsyncSession, edge_id: uuid.UUID, blocked: bool, reason: str | None, current_user: User) -> EvacuationEdge:
    from app.services import audit_service, evacuation_route_service

    edge = await db.get(EvacuationEdge, edge_id)
    if edge is None:
        raise NotFoundError("Evacuation edge not found")

    edge.manually_blocked = blocked
    edge.blocked_reason = reason if blocked else None
    edge.blocked_by = current_user.id if blocked else None
    edge.blocked_at = datetime.now(timezone.utc) if blocked else None

    verb = "Blocked" if blocked else "Reopened"
    await audit_service.record(
        db,
        actor=current_user,
        action="evacuation_edge.block" if blocked else "evacuation_edge.unblock",
        resource_type="evacuation_edge",
        resource_id=str(edge_id),
        description=f"{verb} evacuation edge {edge_id}" + (f" ({reason})" if reason else ""),
        commit=False,
    )
    await db.commit()
    await db.refresh(edge)

    from app.services import emergency_event_service

    if await emergency_event_service.any_evacuation_active(db):
        await evacuation_route_service.invalidate_and_reroute_all(db)

    return edge
