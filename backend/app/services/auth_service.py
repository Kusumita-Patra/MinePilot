from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.exceptions.custom_exceptions import DuplicateError, ForbiddenError, UnauthorizedError
from app.models.user import User
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UpdateEmailRequest,
    UpdateFullNameRequest,
)
from app.schemas.user import UserResponse


async def register(db: AsyncSession, payload: RegisterRequest) -> UserResponse:
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise DuplicateError("A user with this email already exists")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


async def login(db: AsyncSession, payload: LoginRequest) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError("Invalid email or password")

    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserResponse.model_validate(user))


async def change_password(db: AsyncSession, user: User, payload: ChangePasswordRequest) -> None:
    if not verify_password(payload.current_password, user.password_hash):
        # 403, not 401: the JWT/session is still valid (this is an authenticated
        # request) - only the re-entered confirmation password was wrong. Using
        # 401 here would make the frontend's global "401 = session invalid, log
        # out" handler fire on a simple typo instead of showing an inline error.
        raise ForbiddenError("Current password is incorrect")

    user.password_hash = hash_password(payload.new_password)
    await db.commit()


async def update_full_name(db: AsyncSession, user: User, payload: UpdateFullNameRequest) -> UserResponse:
    user.full_name = payload.full_name
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


async def update_email(db: AsyncSession, user: User, payload: UpdateEmailRequest) -> UserResponse:
    if not verify_password(payload.current_password, user.password_hash):
        # 403, not 401: the JWT/session is still valid (this is an authenticated
        # request) - only the re-entered confirmation password was wrong. Using
        # 401 here would make the frontend's global "401 = session invalid, log
        # out" handler fire on a simple typo instead of showing an inline error.
        raise ForbiddenError("Current password is incorrect")

    if payload.new_email != user.email:
        existing = await db.execute(select(User).where(User.email == payload.new_email))
        if existing.scalar_one_or_none() is not None:
            raise DuplicateError("A user with this email already exists")
        user.email = payload.new_email
        await db.commit()
        await db.refresh(user)

    return UserResponse.model_validate(user)
