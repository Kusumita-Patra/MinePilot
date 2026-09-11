import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_permission
from app.db.database import get_db
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.user import AdminUserCreate, UserResponse, UserRoleUpdate, UserStatusUpdate
from app.services import audit_service, user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.view")),
) -> dict:
    users = await user_service.list_users(db)
    data = [UserResponse.model_validate(u).model_dump(mode="json") for u in users]
    return success_body(data)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
) -> dict:
    user = await user_service.create_user(db, payload, current_user)
    await audit_service.record(
        db,
        actor=current_user,
        action="user.create",
        resource_type="user",
        resource_id=str(user.id),
        description=f"Created user {user.email} with role {user.role.value}",
    )
    return success_body(
        UserResponse.model_validate(user).model_dump(mode="json"),
        message="User created successfully",
    )


@router.patch("/{user_id}/role")
async def update_user_role(
    user_id: uuid.UUID,
    payload: UserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
) -> dict:
    target_user = await user_service.get_user(db, user_id)
    previous_role = target_user.role.value
    user = await user_service.update_role(db, target_user, payload.role, current_user)
    await audit_service.record(
        db,
        actor=current_user,
        action="user.role_change",
        resource_type="user",
        resource_id=str(user.id),
        description=f"Changed {user.email}'s role from {previous_role} to {user.role.value}",
    )
    return success_body(
        UserResponse.model_validate(user).model_dump(mode="json"),
        message="User role updated successfully",
    )


@router.patch("/{user_id}/status")
async def update_user_status(
    user_id: uuid.UUID,
    payload: UserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("users.manage")),
) -> dict:
    target_user = await user_service.get_user(db, user_id)
    user = await user_service.update_status(db, target_user, payload.is_active, current_user)
    await audit_service.record(
        db,
        actor=current_user,
        action="user.status_change",
        resource_type="user",
        resource_id=str(user.id),
        description=f"{'Activated' if user.is_active else 'Deactivated'} user {user.email}",
    )
    return success_body(
        UserResponse.model_validate(user).model_dump(mode="json"),
        message="User status updated successfully",
    )
