import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import AppException, ForbiddenError, InvalidTransitionError, NotFoundError
from app.models.corrective_action import CorrectiveAction
from app.models.enums import CorrectiveActionPriority, CorrectiveActionSourceType, CorrectiveActionStatus, UserRole
from app.models.user import User
from app.schemas.corrective_action import CorrectiveActionCreate, CorrectiveActionUpdate, CorrectiveActionVerify
from app.services import permission_service

# Mirrors incident_service.py's state-machine shape. VERIFIED is only ever
# reached via verify_action (not a direct transition target) — see
# transition_status's explicit rejection below.
VALID_TRANSITIONS: dict[CorrectiveActionStatus, set[CorrectiveActionStatus]] = {
    CorrectiveActionStatus.OPEN: {CorrectiveActionStatus.IN_PROGRESS, CorrectiveActionStatus.CANCELLED},
    CorrectiveActionStatus.IN_PROGRESS: {CorrectiveActionStatus.COMPLETED, CorrectiveActionStatus.CANCELLED},
    CorrectiveActionStatus.COMPLETED: set(),
    CorrectiveActionStatus.VERIFIED: set(),
    CorrectiveActionStatus.CANCELLED: set(),
}

_TERMINAL_STATUSES = {CorrectiveActionStatus.COMPLETED, CorrectiveActionStatus.VERIFIED, CorrectiveActionStatus.CANCELLED}


def _is_overdue(action: CorrectiveAction) -> bool:
    """Computed at read time, never stored — this codebase has no cron to
    flip a stored OVERDUE status when due_date passes. See plan Deviation #1."""
    if action.due_date is None or action.status in _TERMINAL_STATUSES:
        return False
    return action.due_date < date.today()


def to_response_dict(action: CorrectiveAction) -> dict:
    return {
        **{col.name: getattr(action, col.name) for col in action.__table__.columns},
        "is_overdue": _is_overdue(action),
    }


async def _check_capability(db: AsyncSession, current_user: User, capability: str) -> None:
    if current_user.role == UserRole.administrator:
        return
    if not await permission_service.is_allowed(db, current_user.role, capability):
        raise ForbiddenError("You do not have permission to perform this action")


async def list_actions(
    db: AsyncSession,
    *,
    status: CorrectiveActionStatus | None = None,
    source_type: CorrectiveActionSourceType | None = None,
    assigned_to: uuid.UUID | None = None,
    priority: str | None = None,
) -> list[CorrectiveAction]:
    query = select(CorrectiveAction)
    if status is not None:
        query = query.where(CorrectiveAction.status == status)
    if source_type is not None:
        query = query.where(CorrectiveAction.source_type == source_type)
    if assigned_to is not None:
        query = query.where(CorrectiveAction.assigned_to == assigned_to)
    if priority is not None:
        query = query.where(CorrectiveAction.priority == priority)
    query = query.order_by(CorrectiveAction.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_action(db: AsyncSession, action_id: uuid.UUID) -> CorrectiveAction:
    action = await db.get(CorrectiveAction, action_id)
    if action is None:
        raise NotFoundError("Corrective action not found")
    return action


async def create_action(db: AsyncSession, payload: CorrectiveActionCreate, created_by: uuid.UUID) -> CorrectiveAction:
    action = CorrectiveAction(
        source_type=payload.source_type,
        source_id=payload.source_id,
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        assigned_to=payload.assigned_to,
        due_date=payload.due_date,
        verification_required=payload.verification_required,
        created_by=created_by,
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


async def update_action(db: AsyncSession, action_id: uuid.UUID, payload: CorrectiveActionUpdate) -> CorrectiveAction:
    action = await get_action(db, action_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(action, field, value)

    await db.commit()
    await db.refresh(action)
    return action


async def transition_status(
    db: AsyncSession, action_id: uuid.UUID, new_status: CorrectiveActionStatus, current_user: User
) -> CorrectiveAction:
    action = await get_action(db, action_id)

    if new_status == CorrectiveActionStatus.VERIFIED:
        raise AppException("Verification must go through POST .../verify, not this endpoint", status_code=409)

    allowed_targets = VALID_TRANSITIONS.get(action.status, set())
    if new_status not in allowed_targets:
        raise InvalidTransitionError(
            f"Cannot transition corrective action from {action.status.value} to {new_status.value}"
        )

    # The assignee may move their own action through the day-to-day
    # OPEN -> IN_PROGRESS -> COMPLETED workflow without holding
    # corrective_actions.manage — otherwise a field worker assigned an action
    # could never mark their own progress. Create/reassign/re-prioritize
    # still require the capability (enforced at the router level). See plan
    # Deviation #7.
    is_self_service = action.assigned_to is not None and action.assigned_to == current_user.id
    if not is_self_service:
        await _check_capability(db, current_user, "corrective_actions.manage")

    action.status = new_status
    if new_status == CorrectiveActionStatus.COMPLETED:
        action.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(action)
    return action


async def verify_action(
    db: AsyncSession, action_id: uuid.UUID, payload: CorrectiveActionVerify, current_user: User
) -> CorrectiveAction:
    action = await get_action(db, action_id)

    if action.status != CorrectiveActionStatus.COMPLETED:
        raise InvalidTransitionError(f"Cannot verify a corrective action in status {action.status.value}")
    if not action.verification_required:
        raise AppException("This corrective action does not require verification", status_code=409)

    await _check_capability(db, current_user, "corrective_actions.verify")

    action.status = CorrectiveActionStatus.VERIFIED
    action.verified_by = current_user.id
    action.verification_date = datetime.now(timezone.utc)
    if payload.remarks is not None:
        action.remarks = payload.remarks
    if payload.evidence_url is not None:
        action.evidence_url = payload.evidence_url

    await db.commit()
    await db.refresh(action)
    return action


async def create_system_action(
    db: AsyncSession,
    *,
    source_type: CorrectiveActionSourceType,
    source_id: str,
    title: str,
    priority: CorrectiveActionPriority,
) -> CorrectiveAction | None:
    """System-actor creation (no `User`, `created_by=None`) — used by the
    sustainability simulator when a target is repeatedly breached. Dedupes
    against an existing OPEN/IN_PROGRESS action with the same
    (source_type, source_id) so a periodic tick never creates duplicates;
    returns None (no-op) when one already exists, mirroring the emergency
    module's detect_and_create's dedup-and-reuse precedent."""
    existing = await db.execute(
        select(CorrectiveAction).where(
            CorrectiveAction.source_type == source_type,
            CorrectiveAction.source_id == source_id,
            CorrectiveAction.status.notin_(list(_TERMINAL_STATUSES)),
        )
    )
    if existing.scalar_one_or_none() is not None:
        return None

    action = CorrectiveAction(
        source_type=source_type,
        source_id=source_id,
        title=title,
        priority=priority,
        created_by=None,
    )
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


async def list_open(db: AsyncSession) -> list[CorrectiveAction]:
    """Every non-terminal corrective action, regardless of source — used by
    sustainability_score_service's overdue-ratio calculation."""
    query = (
        select(CorrectiveAction)
        .where(CorrectiveAction.status.notin_(list(_TERMINAL_STATUSES)))
        .order_by(CorrectiveAction.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def list_open_environmental(db: AsyncSession) -> list[CorrectiveAction]:
    """Open (non-terminal) corrective actions sourced from an environmental
    requirement breach OR a sustainability target breach (P3: Energy/Waste/
    Land) — feeds the sustainability dashboard's "open actions" list."""
    query = (
        select(CorrectiveAction)
        .where(
            CorrectiveAction.source_type.in_(
                [CorrectiveActionSourceType.ENVIRONMENTAL_REQUIREMENT, CorrectiveActionSourceType.SUSTAINABILITY_TARGET]
            ),
            CorrectiveAction.status.notin_(list(_TERMINAL_STATUSES)),
        )
        .order_by(CorrectiveAction.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())
