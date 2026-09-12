import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_permission
from app.db.database import get_db
from app.models.enums import CorrectiveActionPriority, CorrectiveActionSourceType, CorrectiveActionStatus
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.corrective_action import (
    CorrectiveActionCreate,
    CorrectiveActionResponse,
    CorrectiveActionTransition,
    CorrectiveActionUpdate,
    CorrectiveActionVerify,
)
from app.services import audit_service, corrective_action_service

router = APIRouter(prefix="/api/corrective-actions", tags=["corrective-actions"])


@router.get("")
async def list_actions(
    status_filter: CorrectiveActionStatus | None = None,
    source_type: CorrectiveActionSourceType | None = None,
    assigned_to: uuid.UUID | None = None,
    priority: CorrectiveActionPriority | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    actions = await corrective_action_service.list_actions(
        db, status=status_filter, source_type=source_type, assigned_to=assigned_to, priority=priority
    )
    data = [CorrectiveActionResponse(**corrective_action_service.to_response_dict(a)).model_dump(mode="json") for a in actions]
    return success_body(data)


@router.get("/{action_id}")
async def get_action(
    action_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    action = await corrective_action_service.get_action(db, action_id)
    return success_body(CorrectiveActionResponse(**corrective_action_service.to_response_dict(action)).model_dump(mode="json"))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_action(
    payload: CorrectiveActionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("corrective_actions.manage")),
) -> dict:
    action = await corrective_action_service.create_action(db, payload, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="corrective_action.create",
        resource_type="corrective_action",
        resource_id=str(action.id),
        description=f"Created corrective action '{action.title}' ({action.source_type.value})",
    )
    return success_body(
        CorrectiveActionResponse(**corrective_action_service.to_response_dict(action)).model_dump(mode="json"),
        message="Corrective action created successfully",
    )


@router.patch("/{action_id}")
async def update_action(
    action_id: uuid.UUID,
    payload: CorrectiveActionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("corrective_actions.manage")),
) -> dict:
    action = await corrective_action_service.update_action(db, action_id, payload)
    await audit_service.record(
        db,
        actor=current_user,
        action="corrective_action.update",
        resource_type="corrective_action",
        resource_id=str(action.id),
        description=f"Updated corrective action '{action.title}'",
        metadata={"changed_fields": list(payload.model_dump(exclude_unset=True).keys())},
    )
    return success_body(
        CorrectiveActionResponse(**corrective_action_service.to_response_dict(action)).model_dump(mode="json"),
        message="Corrective action updated successfully",
    )


@router.patch("/{action_id}/status")
async def transition_status(
    action_id: uuid.UUID,
    payload: CorrectiveActionTransition,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Open to any authenticated user — the service decides whether this is
    # allowed (either the assignee moving their own action, or a
    # corrective_actions.manage holder). See corrective_action_service's
    # self-service note.
    action = await corrective_action_service.transition_status(db, action_id, payload.status, current_user)
    await audit_service.record(
        db,
        actor=current_user,
        action="corrective_action.transition",
        resource_type="corrective_action",
        resource_id=str(action.id),
        description=f"Transitioned corrective action '{action.title}' to {action.status.value}",
    )
    return success_body(
        CorrectiveActionResponse(**corrective_action_service.to_response_dict(action)).model_dump(mode="json"),
        message="Corrective action status updated successfully",
    )


@router.post("/{action_id}/verify")
async def verify_action(
    action_id: uuid.UUID,
    payload: CorrectiveActionVerify,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Open to any authenticated user — the service checks
    # corrective_actions.verify (fixed-allowed for field_worker, dynamic for
    # mine_manager, bypassed for administrator).
    action = await corrective_action_service.verify_action(db, action_id, payload, current_user)
    await audit_service.record(
        db,
        actor=current_user,
        action="corrective_action.verify",
        resource_type="corrective_action",
        resource_id=str(action.id),
        description=f"Verified corrective action '{action.title}'",
    )
    return success_body(
        CorrectiveActionResponse(**corrective_action_service.to_response_dict(action)).model_dump(mode="json"),
        message="Corrective action verified successfully",
    )
