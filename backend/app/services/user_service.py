import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.exceptions.custom_exceptions import AppException, DuplicateError, NotFoundError
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import AdminUserCreate


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


async def create_user(db: AsyncSession, payload: AdminUserCreate) -> User:
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
    return user


async def update_role(db: AsyncSession, target_user: User, new_role: UserRole, current_user: User) -> User:
    if target_user.id == current_user.id:
        raise AppException("You cannot change your own role", status_code=409)

    target_user.role = new_role
    await db.commit()
    await db.refresh(target_user)
    return target_user


async def update_status(db: AsyncSession, target_user: User, is_active: bool, current_user: User) -> User:
    if target_user.id == current_user.id and not is_active:
        raise AppException("You cannot deactivate your own account", status_code=409)

    target_user.is_active = is_active
    await db.commit()
    await db.refresh(target_user)
    return target_user
