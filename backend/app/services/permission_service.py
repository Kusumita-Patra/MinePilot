import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import CAPABILITIES
from app.exceptions.custom_exceptions import NotFoundError
from app.models.enums import UserRole
from app.models.role_permission import RolePermission


async def get_my_permissions(db: AsyncSession, role: UserRole) -> dict[str, bool]:
    """What the current signed-in user can actually do — consumed by the
    frontend to decide what UI to show (the backend endpoints themselves are
    still the real authorization boundary; this just keeps the UI honest
    about it instead of hardcoding controls by role)."""
    if role == UserRole.administrator:
        return {capability: True for capability, _ in CAPABILITIES}

    result = await db.execute(select(RolePermission).where(RolePermission.role == role))
    rows = {r.capability: r.allowed for r in result.scalars().all()}
    return {capability: rows.get(capability, False) for capability, _ in CAPABILITIES}


async def is_allowed(db: AsyncSession, role: UserRole, capability: str) -> bool:
    """administrator is handled entirely in require_permission (core/security.py)
    and never reaches here. No row for (role, capability) = deny — the secure
    default, and the reason every capability must be seeded for both
    mine_manager and field_worker in its introducing migration."""
    result = await db.execute(
        select(RolePermission.allowed).where(RolePermission.role == role, RolePermission.capability == capability)
    )
    row = result.scalar_one_or_none()
    return bool(row)


async def list_matrix(db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(RolePermission).where(
            RolePermission.role.in_([UserRole.mine_manager, UserRole.field_worker])
        )
    )
    rows = {(r.role, r.capability): r for r in result.scalars().all()}

    matrix = []
    for capability, label in CAPABILITIES:
        mgr = rows.get((UserRole.mine_manager, capability))
        wkr = rows.get((UserRole.field_worker, capability))
        matrix.append(
            {
                "capability": capability,
                "label": label,
                "mine_manager": {"id": mgr.id if mgr else None, "allowed": mgr.allowed if mgr else False},
                "field_worker": {"id": wkr.id if wkr else None, "allowed": wkr.allowed if wkr else False},
            }
        )
    return matrix


async def update_permission(
    db: AsyncSession, permission_id: uuid.UUID, allowed: bool, updated_by: uuid.UUID
) -> RolePermission:
    permission = await db.get(RolePermission, permission_id)
    if permission is None:
        raise NotFoundError("Permission row not found")
    permission.allowed = allowed
    permission.updated_by = updated_by
    await db.commit()
    await db.refresh(permission)
    return permission
