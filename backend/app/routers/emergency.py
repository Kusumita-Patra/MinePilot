import uuid

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status as ws_status

from app.core.security import get_current_user, get_current_user_ws, require_permission
from app.db.database import AsyncSessionLocal, get_db
from app.exceptions.custom_exceptions import AppException
from app.models.enums import EmergencyEventStatus, HazardType
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.emergency import (
    AlarmConfigResponse,
    AlarmConfigUpdate,
    DeriveFromBlueprintRequest,
    EdgeBlockRequest,
    EmergencyEventResponse,
    EmergencyEventUpdate,
    EmergencyRuleResponse,
    EmergencyRuleUpdate,
    EmergencySimulateRequest,
    EvacuationEdgeResponse,
    EvacuationExitCreate,
    EvacuationExitResponse,
    EvacuationExitUpdate,
    EvacuationNodeResponse,
    EvacuationRouteResponse,
    GraphSnapshotResponse,
    WorkerPositionResponse,
    WorkerStallRequest,
)
from app.services import (
    alarm_config_service,
    audit_service,
    emergency_event_service,
    emergency_rule_service,
    evacuation_graph_service,
    evacuation_route_service,
    worker_position_service,
)
from app.services.emergency_broadcast_service import broadcast_manager

# No prefix here, deliberately — mirrors telemetry.py exactly, since this
# router (like that one) needs both /api/emergency/* REST paths AND a
# root-level /ws/emergency WebSocket path. A router-level prefix would have
# put the websocket at /api/emergency/ws/emergency instead.
router = APIRouter(tags=["emergency"])


@router.get("/api/emergency/events")
async def list_events(
    status_filter: EmergencyEventStatus | None = Query(default=None, alias="status"),
    hazard_type: HazardType | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    events = await emergency_event_service.list_events(db, status=status_filter, hazard_type=hazard_type)
    data = [EmergencyEventResponse.model_validate(e).model_dump(mode="json") for e in events]
    return success_body(data)


@router.get("/api/emergency/events/{event_id}")
async def get_event(
    event_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    event = await emergency_event_service.get_event(db, event_id)
    return success_body(EmergencyEventResponse.model_validate(event).model_dump(mode="json"))


@router.patch("/api/emergency/events/{event_id}")
async def update_event(
    event_id: uuid.UUID,
    payload: EmergencyEventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Open to any authenticated user — the capability check is inside
    # update_status and depends on the requested TARGET status, mirroring
    # incidents.py's PATCH endpoint exactly.
    event = await emergency_event_service.update_status(db, event_id, payload, current_user)
    await audit_service.record(
        db,
        actor=current_user,
        action="emergency_event.transition",
        resource_type="emergency_event",
        resource_id=str(event.id),
        description=f"Transitioned emergency event to {event.status.value}",
    )
    return success_body(
        EmergencyEventResponse.model_validate(event).model_dump(mode="json"),
        message="Emergency event updated successfully",
    )


@router.post("/api/emergency/events/simulate", status_code=status.HTTP_201_CREATED)
async def simulate_event(
    payload: EmergencySimulateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.simulate")),
) -> dict:
    rule = await emergency_rule_service.get_active_rule(db, payload.hazard_type)
    if rule is None:
        raise AppException(f"No active emergency rule configured for {payload.hazard_type.value}", status_code=409)

    event = await emergency_event_service.detect_and_create(
        db, payload.hazard_type, payload.sector_id, payload.sensor_id, payload.value, rule
    )
    await audit_service.record(
        db,
        actor=current_user,
        action="emergency_event.simulate",
        resource_type="emergency_event",
        resource_id=str(event.id),
        description=f"Simulated {payload.hazard_type.value} emergency in {payload.sector_id} (DEMO / SIMULATED EVENT)",
        metadata={"value": payload.value},
    )
    return success_body(
        EmergencyEventResponse.model_validate(event).model_dump(mode="json"),
        message="Simulated emergency event created",
    )


@router.get("/api/emergency/rules")
async def list_rules(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("emergency.configure"))
) -> dict:
    rules = await emergency_rule_service.list_rules(db)
    data = [EmergencyRuleResponse.model_validate(r).model_dump(mode="json") for r in rules]
    return success_body(data)


@router.patch("/api/emergency/rules/{rule_id}")
async def update_rule(
    rule_id: uuid.UUID,
    payload: EmergencyRuleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.configure")),
) -> dict:
    rule = await emergency_rule_service.update_rule(db, rule_id, payload, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="emergency_rule.update",
        resource_type="emergency_rule",
        resource_id=str(rule.id),
        description=f"Updated emergency rule '{rule.display_name}'",
    )
    return success_body(
        EmergencyRuleResponse.model_validate(rule).model_dump(mode="json"), message="Emergency rule updated successfully"
    )


@router.get("/api/emergency/graph")
async def get_graph(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    snapshot = await evacuation_graph_service.get_graph_snapshot(db)
    return success_body(
        GraphSnapshotResponse(
            nodes=[EvacuationNodeResponse.model_validate(n) for n in snapshot["nodes"]],
            edges=[EvacuationEdgeResponse(**e) for e in snapshot["edges"]],
            exits=[EvacuationExitResponse.model_validate(x) for x in snapshot["exits"]],
        ).model_dump(mode="json")
    )


@router.post("/api/emergency/graph/derive-from-blueprint")
async def derive_from_blueprint(
    payload: DeriveFromBlueprintRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.configure")),
) -> dict:
    result = await evacuation_graph_service.derive_from_blueprint(db, payload.blueprint_id, current_user)
    return success_body(result, message="Evacuation graph derived from blueprint")


@router.post("/api/emergency/exits", status_code=status.HTTP_201_CREATED)
async def create_exit(
    payload: EvacuationExitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.configure")),
) -> dict:
    exit_ = await evacuation_graph_service.create_exit(db, payload, current_user)
    return success_body(
        EvacuationExitResponse.model_validate(exit_).model_dump(mode="json"), message="Evacuation exit created successfully"
    )


@router.patch("/api/emergency/exits/{exit_id}")
async def update_exit(
    exit_id: uuid.UUID,
    payload: EvacuationExitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.configure")),
) -> dict:
    exit_ = await evacuation_graph_service.update_exit(db, exit_id, payload, current_user)
    return success_body(
        EvacuationExitResponse.model_validate(exit_).model_dump(mode="json"), message="Evacuation exit updated successfully"
    )


@router.delete("/api/emergency/exits/{exit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exit(
    exit_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.configure")),
) -> None:
    await evacuation_graph_service.delete_exit(db, exit_id, current_user)


@router.patch("/api/emergency/edges/{edge_id}/block")
async def block_edge(
    edge_id: uuid.UUID,
    payload: EdgeBlockRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.escalate")),
) -> dict:
    edge = await evacuation_graph_service.set_edge_block(db, edge_id, payload.blocked, payload.reason, current_user)
    return success_body(
        EvacuationEdgeResponse.model_validate(edge).model_dump(mode="json"), message="Evacuation edge updated successfully"
    )


@router.get("/api/emergency/routes")
async def list_routes(
    emergency_event_id: uuid.UUID | None = None,
    worker_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    routes = await evacuation_route_service.list_routes(db, emergency_event_id=emergency_event_id, worker_id=worker_id)
    data = [EvacuationRouteResponse.model_validate(r).model_dump(mode="json") for r in routes]
    return success_body(data)


@router.get("/api/emergency/routes/mine")
async def get_my_route(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    route = await evacuation_route_service.get_active_route_for_worker(db, current_user.id)
    if route is None:
        return success_body(None)
    return success_body(EvacuationRouteResponse.model_validate(route).model_dump(mode="json"))


@router.get("/api/emergency/workers/positions")
async def list_worker_positions(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    positions = await worker_position_service.list_positions(db)
    data = [WorkerPositionResponse.model_validate(p).model_dump(mode="json") for p in positions]
    return success_body(data)


@router.get("/api/emergency/workers/positions/me")
async def get_my_position(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    position = await worker_position_service.get_position(db, current_user.id)
    if position is None:
        return success_body(None)
    return success_body(WorkerPositionResponse.model_validate(position).model_dump(mode="json"))


@router.post("/api/emergency/workers/positions/simulate/advance")
async def advance_simulated_positions(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(require_permission("emergency.simulate"))
) -> dict:
    advanced = await worker_position_service.advance_all_simulated(db)
    data = [WorkerPositionResponse.model_validate(p).model_dump(mode="json") for p in advanced]
    return success_body(data, message=f"Advanced {len(advanced)} simulated worker position(s)")


@router.get("/api/emergency/alarms")
async def list_alarm_configs(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    # Open to any authenticated user — the field worker view needs to know
    # current light/sound patterns to render its alarm banner, same
    # openness rationale as GET /api/emergency/graph.
    configs = await alarm_config_service.list_configs(db)
    data = [AlarmConfigResponse.model_validate(c).model_dump(mode="json") for c in configs]
    return success_body(data)


@router.patch("/api/emergency/alarms/{config_id}")
async def update_alarm_config(
    config_id: uuid.UUID,
    payload: AlarmConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.configure")),
) -> dict:
    config = await alarm_config_service.update_config(db, config_id, payload, current_user)
    return success_body(
        AlarmConfigResponse.model_validate(config).model_dump(mode="json"), message="Alarm configuration updated"
    )


@router.patch("/api/emergency/workers/positions/{worker_id}/simulate/stall")
async def set_worker_stall(
    worker_id: uuid.UUID,
    payload: WorkerStallRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("emergency.simulate")),
) -> dict:
    position = await worker_position_service.set_worker_stalled(db, worker_id, payload.stalled)
    await audit_service.record(
        db,
        actor=current_user,
        action="worker_position.simulate_stall",
        resource_type="worker_position",
        resource_id=str(worker_id),
        description=f"{'Stalled' if payload.stalled else 'Resumed'} worker {worker_id} (DEMO / SIMULATED — 'Worker Not Moving' scenario)",
    )
    return success_body(
        WorkerPositionResponse.model_validate(position).model_dump(mode="json"),
        message=f"Worker {'stalled' if payload.stalled else 'resumed'}",
    )


@router.websocket("/ws/emergency")
async def emergency_ws(websocket: WebSocket, token: str | None = Query(default=None)) -> None:
    async with AsyncSessionLocal() as db:
        user = await get_current_user_ws(token, db)

    if user is None:
        await websocket.close(code=ws_status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    queue = broadcast_manager.subscribe()
    try:
        while True:
            message = await queue.get()
            await websocket.send_json(message)
    except WebSocketDisconnect:
        pass
    finally:
        broadcast_manager.unsubscribe(queue)
