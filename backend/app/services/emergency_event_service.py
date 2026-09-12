import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import AppException, ForbiddenError, InvalidTransitionError, NotFoundError
from app.models.emergency_event import EmergencyEvent, EmergencyRule
from app.models.enums import EmergencyEventStatus, HazardType, RiskLevel, UserRole
from app.models.user import User
from app.schemas.emergency import EmergencyEventUpdate
from app.services import emergency_broadcast_service, permission_service

# Mirrors incident_service.py's exact shape. DETECTED/ACTIVE are system-only
# (detect_and_create transitions DETECTED->ACTIVE itself before returning) —
# update_status (the human-facing PATCH path) rejects them as a target even
# though they appear in this graph, so the graph itself stays fully testable.
VALID_TRANSITIONS: dict[EmergencyEventStatus, set[EmergencyEventStatus]] = {
    EmergencyEventStatus.DETECTED: {EmergencyEventStatus.ACTIVE, EmergencyEventStatus.CANCELLED},
    EmergencyEventStatus.ACTIVE: {
        EmergencyEventStatus.ACKNOWLEDGED,
        EmergencyEventStatus.ESCALATED,
        EmergencyEventStatus.CANCELLED,
    },
    EmergencyEventStatus.ACKNOWLEDGED: {
        EmergencyEventStatus.EVACUATION_ACTIVE,
        EmergencyEventStatus.ESCALATED,
        EmergencyEventStatus.CANCELLED,
    },
    EmergencyEventStatus.ESCALATED: {
        EmergencyEventStatus.ACKNOWLEDGED,
        EmergencyEventStatus.EVACUATION_ACTIVE,
        EmergencyEventStatus.CANCELLED,
    },
    EmergencyEventStatus.EVACUATION_ACTIVE: {EmergencyEventStatus.RESOLVED},
    EmergencyEventStatus.RESOLVED: set(),
    EmergencyEventStatus.CANCELLED: set(),
}

_SYSTEM_ONLY_TARGETS = {EmergencyEventStatus.DETECTED, EmergencyEventStatus.ACTIVE}
_NON_TERMINAL_STATUSES = {
    EmergencyEventStatus.DETECTED,
    EmergencyEventStatus.ACTIVE,
    EmergencyEventStatus.ACKNOWLEDGED,
    EmergencyEventStatus.ESCALATED,
    EmergencyEventStatus.EVACUATION_ACTIVE,
}


def _capability_for_target(target_status: EmergencyEventStatus) -> str:
    if target_status in (EmergencyEventStatus.RESOLVED, EmergencyEventStatus.CANCELLED):
        return "emergency.resolve"
    if target_status == EmergencyEventStatus.ACKNOWLEDGED:
        return "emergency.acknowledge"
    return "emergency.escalate"  # ESCALATED, EVACUATION_ACTIVE


async def _check_role_permission(db: AsyncSession, current_user: User, target_status: EmergencyEventStatus) -> None:
    if current_user.role == UserRole.administrator:
        return
    capability = _capability_for_target(target_status)
    if not await permission_service.is_allowed(db, current_user.role, capability):
        raise ForbiddenError(f"Your role cannot transition an emergency event to {target_status.value}")


async def list_events(
    db: AsyncSession, status: EmergencyEventStatus | None = None, hazard_type: HazardType | None = None
) -> list[EmergencyEvent]:
    query = select(EmergencyEvent)
    if status is not None:
        query = query.where(EmergencyEvent.status == status)
    if hazard_type is not None:
        query = query.where(EmergencyEvent.hazard_type == hazard_type)
    query = query.order_by(EmergencyEvent.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_event(db: AsyncSession, event_id: uuid.UUID) -> EmergencyEvent:
    event = await db.get(EmergencyEvent, event_id)
    if event is None:
        raise NotFoundError("Emergency event not found")
    return event


async def any_evacuation_active(db: AsyncSession) -> bool:
    result = await db.execute(
        select(EmergencyEvent.id).where(EmergencyEvent.status == EmergencyEventStatus.EVACUATION_ACTIVE).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def detect_and_create(
    db: AsyncSession,
    hazard_type: HazardType,
    sector_id: str,
    sensor_id: str | None,
    trigger_value: float,
    rule: EmergencyRule,
) -> EmergencyEvent:
    """System actor — no permission check, no audit log, mirroring
    incident_service.trigger_incident exactly (which also has neither).
    Dedups against an existing non-terminal event for (hazard_type,
    sector_id) rather than creating a second one, mirroring
    trigger_incident's own reuse-open-ticket behavior."""
    result = await db.execute(
        select(EmergencyEvent)
        .where(
            EmergencyEvent.hazard_type == hazard_type,
            EmergencyEvent.trigger_sector_id == sector_id,
            EmergencyEvent.status.in_(list(_NON_TERMINAL_STATUSES)),
        )
        .order_by(EmergencyEvent.created_at.desc())
    )
    existing = result.scalars().first()
    now = datetime.now(timezone.utc)

    if existing is not None:
        if trigger_value > (existing.trigger_value or 0):
            existing.trigger_value = trigger_value
            existing.trigger_sensor_id = sensor_id or existing.trigger_sensor_id
            await db.commit()
            await db.refresh(existing)
        return existing

    event = EmergencyEvent(
        hazard_type=hazard_type,
        severity=RiskLevel.CRITICAL,
        status=EmergencyEventStatus.ACTIVE,
        trigger_sector_id=sector_id,
        trigger_sensor_id=sensor_id,
        trigger_value=trigger_value,
        escalation_timeout_seconds=rule.escalation_timeout_seconds,
        activated_at=now,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    await emergency_broadcast_service.publish("EMERGENCY_CREATED", _serialize(event))

    # A second hazard while an evacuation is already underway must reroute
    # immediately — imported here (not at module top) to avoid a circular
    # import (evacuation_route_service imports this module too).
    from app.services import evacuation_route_service

    if await any_evacuation_active(db):
        await evacuation_route_service.invalidate_and_reroute_all(db)

    return event


async def list_escalation_due(db: AsyncSession) -> list[EmergencyEvent]:
    """Computed at read/tick time from activated_at + escalation_timeout_seconds
    — nothing stored beyond those two fields. Acknowledging an event does NOT
    stop the clock (ACKNOWLEDGED is still eligible) — matches the spec's
    literal escalation-timer intent."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(EmergencyEvent).where(
            EmergencyEvent.status.in_([EmergencyEventStatus.ACTIVE, EmergencyEventStatus.ACKNOWLEDGED]),
            EmergencyEvent.escalated_at.is_(None),
        )
    )
    return [event for event in result.scalars().all() if is_escalation_due(event, now)]


def is_escalation_due(event: EmergencyEvent, now: datetime) -> bool:
    """Pure — unit-tested directly (tests/test_emergency_escalation.py). The
    SQL WHERE clause above already narrows to status in
    (ACTIVE, ACKNOWLEDGED) and escalated_at is None; this only computes the
    activated_at + escalation_timeout_seconds deadline arithmetic."""
    deadline = event.activated_at.replace(tzinfo=timezone.utc) if event.activated_at.tzinfo is None else event.activated_at
    return (now - deadline).total_seconds() >= event.escalation_timeout_seconds


async def auto_escalate(db: AsyncSession, event: EmergencyEvent) -> EmergencyEvent:
    """System actor, no audit log — mirrors trigger_incident's own
    no-audit-for-automated-actions precedent."""
    event.status = EmergencyEventStatus.ESCALATED
    event.escalated_at = datetime.now(timezone.utc)
    event.escalated_reason = "auto: escalation timeout exceeded"
    await db.commit()
    await db.refresh(event)
    await emergency_broadcast_service.publish("EMERGENCY_ESCALATED", _serialize(event))
    return event


async def update_status(
    db: AsyncSession, event_id: uuid.UUID, payload: EmergencyEventUpdate, current_user: User
) -> EmergencyEvent:
    if payload.status in _SYSTEM_ONLY_TARGETS:
        raise AppException(f"{payload.status.value} cannot be set via this endpoint", status_code=409)

    event = await get_event(db, event_id)
    if payload.status == event.status:
        return event

    allowed_targets = VALID_TRANSITIONS.get(event.status, set())
    if payload.status not in allowed_targets:
        raise InvalidTransitionError(f"Cannot transition emergency event from {event.status.value} to {payload.status.value}")

    await _check_role_permission(db, current_user, payload.status)

    now = datetime.now(timezone.utc)
    event.status = payload.status
    if payload.status == EmergencyEventStatus.ACKNOWLEDGED:
        event.acknowledged_at = now
        event.acknowledged_by = current_user.id
    elif payload.status == EmergencyEventStatus.ESCALATED:
        event.escalated_at = now
        event.escalated_reason = f"manual: escalated by {current_user.full_name}"
    elif payload.status == EmergencyEventStatus.EVACUATION_ACTIVE:
        event.evacuation_started_at = now
    elif payload.status == EmergencyEventStatus.RESOLVED:
        event.resolved_at = now
        event.resolved_by = current_user.id
        event.resolution_notes = payload.resolution_notes
    elif payload.status == EmergencyEventStatus.CANCELLED:
        event.cancelled_at = now
        event.cancelled_by = current_user.id
        event.cancel_reason = payload.cancel_reason

    await db.commit()
    await db.refresh(event)

    if payload.status == EmergencyEventStatus.EVACUATION_ACTIVE:
        from app.services import evacuation_route_service

        await evacuation_route_service.assign_routes_for_active_evacuation(db, event)
    elif payload.status in (EmergencyEventStatus.RESOLVED, EmergencyEventStatus.CANCELLED):
        from app.services import evacuation_route_service

        await evacuation_route_service.clear_positions_for_event(db, event)

    event_type = (
        "ALL_CLEAR"
        if payload.status in (EmergencyEventStatus.RESOLVED, EmergencyEventStatus.CANCELLED)
        else "EMERGENCY_UPDATED"
    )
    await emergency_broadcast_service.publish(event_type, _serialize(event))
    return event


def _serialize(event: EmergencyEvent) -> dict:
    return {
        "id": str(event.id),
        "hazard_type": event.hazard_type.value,
        "severity": event.severity.value,
        "status": event.status.value,
        "trigger_sector_id": event.trigger_sector_id,
        "escalation_timeout_seconds": event.escalation_timeout_seconds,
        "activated_at": event.activated_at.isoformat(),
    }
