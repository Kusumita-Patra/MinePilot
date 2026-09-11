import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import CAPABILITIES, FIELD_WORKER_FIXED_CAPABILITIES
from app.exceptions.custom_exceptions import AppException, NotFoundError
from app.models.enums import UserRole
from app.models.role_permission import RolePermission


async def get_my_permissions(db: AsyncSession, role: UserRole) -> dict[str, bool]:
    """What the current signed-in user can actually do — consumed by the
    frontend to decide what UI to show (the backend endpoints themselves are
    still the real authorization boundary; this just keeps the UI honest
    about it instead of hardcoding controls by role)."""
    if role == UserRole.administrator:
        return {capability: True for capability, _ in CAPABILITIES}
    if role == UserRole.field_worker:
        return {capability: capability in FIELD_WORKER_FIXED_CAPABILITIES for capability, _ in CAPABILITIES}

    result = await db.execute(select(RolePermission).where(RolePermission.role == role))
    rows = {r.capability: r.allowed for r in result.scalars().all()}
    return {capability: rows.get(capability, False) for capability, _ in CAPABILITIES}


async def is_allowed(db: AsyncSession, role: UserRole, capability: str) -> bool:
    """administrator is handled entirely in require_permission (core/security.py)
    and never reaches here. field_worker ("Field Inspector") access is fixed
    by product decision, not read from the table — see FIELD_WORKER_FIXED_CAPABILITIES.
    Only mine_manager is ever looked up dynamically; no row for
    (mine_manager, capability) = deny, the secure default."""
    if role == UserRole.field_worker:
        return capability in FIELD_WORKER_FIXED_CAPABILITIES

    result = await db.execute(
        select(RolePermission.allowed).where(RolePermission.role == role, RolePermission.capability == capability)
    )
    row = result.scalar_one_or_none()
    return bool(row)


async def list_matrix(db: AsyncSession) -> list[dict]:
    """mine_manager is the only dynamically-editable row here — field_worker's
    cell always reports its fixed value with `id: None`, which the frontend
    (correctly) renders as non-interactive since there's no row to PATCH."""
    result = await db.execute(select(RolePermission).where(RolePermission.role == UserRole.mine_manager))
    mgr_rows = {r.capability: r for r in result.scalars().all()}

    matrix = []
    for capability, label in CAPABILITIES:
        mgr = mgr_rows.get(capability)
        matrix.append(
            {
                "capability": capability,
                "label": label,
                "mine_manager": {"id": mgr.id if mgr else None, "allowed": mgr.allowed if mgr else False},
                "field_worker": {"id": None, "allowed": capability in FIELD_WORKER_FIXED_CAPABILITIES},
            }
        )
    return matrix


async def update_permission(
    db: AsyncSession, permission_id: uuid.UUID, allowed: bool, updated_by: uuid.UUID
) -> RolePermission:
    permission = await db.get(RolePermission, permission_id)
    if permission is None:
        raise NotFoundError("Permission row not found")
    if permission.role != UserRole.mine_manager:
        # Defense in depth: list_matrix never hands out a field_worker/admin
        # row id to PATCH against, but reject explicitly in case one is ever
        # reached directly (e.g. a stale id from before this change).
        raise AppException("Only Mine Manager permissions can be changed", status_code=409)
    permission.allowed = allowed
    permission.updated_by = updated_by
    await db.commit()
    await db.refresh(permission)
    return permission
