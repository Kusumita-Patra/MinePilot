import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.exceptions.custom_exceptions import AppException, DuplicateError, ForbiddenError, NotFoundError
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import AdminUserCreate

# users.manage is delegatable to mine_manager via the dynamic role_permissions
# table (see core/permissions.py). Everything below the administrator role
# itself is fair game for a delegated manager to create/edit/deactivate —
# but the administrator role is NOT: creating an administrator, promoting
# anyone to administrator, or touching an existing administrator's role/status
# at all must stay a real-administrator-only action, or a delegated "users.manage"
# grant would be an unbounded privilege-escalation path (a manager could mint
# themselves or a colleague a full admin account). This is enforced here, in
# the service layer, not just hidden in the UI — require_permission("users.manage")
# alone is not enough to prevent this.


def _require_actor_is_administrator(current_user: User, message: str) -> None:
    if current_user.role != UserRole.administrator:
        raise ForbiddenError(message)


async def list_users(db: AsyncSession) -> list[User]:
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


async def get_user(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError("User not found")
    return user


async def create_user(db: AsyncSession, payload: AdminUserCreate, current_user: User) -> User:
    if payload.role == UserRole.administrator:
        _require_actor_is_administrator(current_user, "Only an administrator can create an administrator account")

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
    if new_role == UserRole.administrator:
        _require_actor_is_administrator(current_user, "Only an administrator can promote a user to administrator")
    if target_user.role == UserRole.administrator:
        _require_actor_is_administrator(current_user, "Only an administrator can change another administrator's role")

    target_user.role = new_role
    await db.commit()
    await db.refresh(target_user)
    return target_user


async def update_status(db: AsyncSession, target_user: User, is_active: bool, current_user: User) -> User:
    if target_user.id == current_user.id and not is_active:
        raise AppException("You cannot deactivate your own account", status_code=409)
    if target_user.role == UserRole.administrator:
        _require_actor_is_administrator(
            current_user, "Only an administrator can activate or deactivate another administrator's account"
        )

    target_user.is_active = is_active
    await db.commit()
    await db.refresh(target_user)
    return target_user
