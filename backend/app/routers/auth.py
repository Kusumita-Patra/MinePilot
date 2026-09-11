from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    UpdateEmailRequest,
    UpdateFullNameRequest,
)
from app.schemas.common import success_body
from app.schemas.user import UserResponse
from app.services import auth_service, permission_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    user = await auth_service.register(db, payload)
    return success_body(user.model_dump(mode="json"), message="User registered successfully")


@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    token = await auth_service.login(db, payload)
    return success_body(token.model_dump(mode="json"), message="Login successful")


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)) -> dict:
    return success_body(UserResponse.model_validate(current_user).model_dump(mode="json"))


@router.get("/permissions")
async def my_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """What the signed-in user can actually do, per the dynamic role_permissions
    table (administrator = everything). The frontend uses this to decide what
    to render — the backend's require_permission(...) checks remain the real
    authorization boundary regardless of what this reports."""
    permissions = await permission_service.get_my_permissions(db, current_user.role)
    return success_body(permissions)


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    await auth_service.change_password(db, current_user, payload)
    return success_body({}, message="Password updated successfully")


@router.patch("/me")
async def update_full_name(
    payload: UpdateFullNameRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    user = await auth_service.update_full_name(db, current_user, payload)
    return success_body(user.model_dump(mode="json"), message="Full name updated successfully")


@router.post("/update-email")
async def update_email(
    payload: UpdateEmailRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    user = await auth_service.update_email(db, current_user, payload)
    return success_body(user.model_dump(mode="json"), message="Email updated successfully")
