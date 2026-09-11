from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import ForbiddenError, InvalidTransitionError, NotFoundError
from app.models.enums import IncidentStatus, RiskLevel, UserRole
from app.models.incident import Incident
from app.models.user import User
from app.schemas.incident import IncidentUpdate
from app.services import permission_service
from app.utils.ticket_id import next_ticket_id

VALID_TRANSITIONS: dict[IncidentStatus, set[IncidentStatus]] = {
    IncidentStatus.TRIGGERED: {IncidentStatus.ASSIGNED},
    IncidentStatus.ASSIGNED: {IncidentStatus.RESOLVED, IncidentStatus.ESCALATED},
    IncidentStatus.ESCALATED: {IncidentStatus.ASSIGNED, IncidentStatus.SIGNED_OFF},
    IncidentStatus.RESOLVED: {IncidentStatus.SIGNED_OFF},
    IncidentStatus.SIGNED_OFF: set(),
}


async def list_incidents(
    db: AsyncSession,
    status: IncidentStatus | None = None,
    sector_id: str | None = None,
    severity: RiskLevel | None = None,
) -> list[Incident]:
    query = select(Incident)
    if status is not None:
        query = query.where(Incident.status == status)
    if sector_id is not None:
        query = query.where(Incident.sector_id == sector_id)
    if severity is not None:
        query = query.where(Incident.severity == severity)
    query = query.order_by(Incident.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_incident(db: AsyncSession, ticket_id: str) -> Incident:
    result = await db.execute(select(Incident).where(Incident.ticket_id == ticket_id))
    incident = result.scalar_one_or_none()
    if incident is None:
        raise NotFoundError(f"Incident {ticket_id} not found")
    return incident


def _capability_for_target(target_status: IncidentStatus) -> str:
    """Which admin-editable capability (see core/permissions.py) governs
    transitioning an incident to this target status."""
    return "incidents.sign_off" if target_status == IncidentStatus.SIGNED_OFF else "incidents.transition"


async def _check_role_permission(db: AsyncSession, current_user: User, target_status: IncidentStatus) -> None:
    # Administrator is always a superuser (§3: administrator ⊇ manager
    # access) and never consults the permissions table.
    if current_user.role == UserRole.administrator:
        return

    capability = _capability_for_target(target_status)
    if not await permission_service.is_allowed(db, current_user.role, capability):
        raise ForbiddenError(f"Your role cannot transition an incident to {target_status.value}")


async def update_incident(
    db: AsyncSession, ticket_id: str, payload: IncidentUpdate, current_user: User
) -> Incident:
    incident = await get_incident(db, ticket_id)

    if payload.status is not None and payload.status != incident.status:
        allowed_targets = VALID_TRANSITIONS.get(incident.status, set())
        if payload.status not in allowed_targets:
            raise InvalidTransitionError(
                f"Cannot transition incident from {incident.status.value} to {payload.status.value}"
            )
        await _check_role_permission(db, current_user, payload.status)

        incident.status = payload.status
        if payload.status == IncidentStatus.RESOLVED:
            incident.resolved_at = datetime.now(timezone.utc)

    if payload.assigned_worker_id is not None:
        incident.assigned_worker_id = payload.assigned_worker_id
    if payload.field_remarks is not None:
        incident.field_remarks = payload.field_remarks
    if payload.resolution_photo_url is not None:
        incident.resolution_photo_url = payload.resolution_photo_url

    await db.commit()
    await db.refresh(incident)
    return incident


async def trigger_incident(
    db: AsyncSession, sensor_id: str, sector_id: str, risk_score: int, severity: RiskLevel
) -> Incident:
    """Mirrors T2's in-memory trigger_incident: reuse an existing open ticket for
    this sensor rather than creating a duplicate, bumping score/severity upward."""
    result = await db.execute(
        select(Incident)
        .where(Incident.sensor_id == sensor_id)
        .where(Incident.status != IncidentStatus.SIGNED_OFF)
        .order_by(Incident.created_at.desc())
    )
    open_incident = result.scalars().first()

    if open_incident is not None:
        if risk_score > open_incident.risk_score:
            open_incident.risk_score = risk_score
            open_incident.severity = severity
            await db.commit()
            await db.refresh(open_incident)
        return open_incident

    incident = Incident(
        ticket_id=await next_ticket_id(db),
        sensor_id=sensor_id,
        sector_id=sector_id,
        risk_score=risk_score,
        severity=severity,
        status=IncidentStatus.TRIGGERED,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident
