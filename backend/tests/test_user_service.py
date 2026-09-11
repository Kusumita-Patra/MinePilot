import uuid

import pytest

from app.exceptions.custom_exceptions import AppException, ForbiddenError
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import AdminUserCreate
from app.services.user_service import create_user, update_role, update_status


def make_user(role: UserRole) -> User:
    return User(id=uuid.uuid4(), email="x@example.com", password_hash="h", full_name="X", role=role)


class _NoopWriteSession:
    """Lets update_role/update_status run their full happy path (past the
    guard checks, which is what these tests actually exercise) without a
    real database — commit()/refresh() are no-ops, matching this repo's
    existing fake-session convention for guard-only unit tests."""

    async def commit(self):
        pass

    async def refresh(self, _obj):
        pass


@pytest.mark.asyncio
async def test_administrator_cannot_change_own_role():
    admin = make_user(UserRole.administrator)
    # The self-id guard raises before any DB access, so `db=None` is safe here.
    with pytest.raises(AppException) as exc_info:
        await update_role(None, admin, UserRole.mine_manager, admin)
    assert exc_info.value.status_code == 409


@pytest.mark.asyncio
async def test_administrator_cannot_deactivate_own_account():
    admin = make_user(UserRole.administrator)
    with pytest.raises(AppException) as exc_info:
        await update_status(None, admin, False, admin)
    assert exc_info.value.status_code == 409


# Regression coverage for a real privilege-escalation bug: a mine_manager
# delegated the `users.manage` capability (see core/permissions.py) must
# never be able to create, promote to, or otherwise touch an administrator
# account — that would make "users.manage" an unbounded escalation path to
# full admin. This must hold even though require_permission("users.manage")
# alone lets the request through to the service layer.


@pytest.mark.asyncio
async def test_manager_cannot_create_an_administrator_account():
    manager = make_user(UserRole.mine_manager)
    payload = AdminUserCreate(
        email="new-admin@example.com", password="password123", full_name="New Admin", role=UserRole.administrator
    )
    # The role-escalation guard raises before any DB access (even the
    # duplicate-email lookup), so db=None is safe here.
    with pytest.raises(ForbiddenError):
        await create_user(None, payload, manager)


@pytest.mark.asyncio
async def test_administrator_can_create_an_administrator_account():
    admin = make_user(UserRole.administrator)
    payload = AdminUserCreate(
        email="new-admin@example.com", password="password123", full_name="New Admin", role=UserRole.administrator
    )
    with pytest.raises(AttributeError):
        # Passes the escalation guard, then reaches the real duplicate-email
        # `db.execute(...)` call, which db=None can't satisfy — proving the
        # guard did NOT fire for an actual administrator actor.
        await create_user(None, payload, admin)


@pytest.mark.asyncio
async def test_manager_cannot_promote_anyone_to_administrator():
    manager = make_user(UserRole.mine_manager)
    worker = make_user(UserRole.field_worker)
    with pytest.raises(ForbiddenError):
        await update_role(None, worker, UserRole.administrator, manager)


@pytest.mark.asyncio
async def test_manager_cannot_change_an_existing_administrators_role():
    manager = make_user(UserRole.mine_manager)
    other_admin = make_user(UserRole.administrator)
    with pytest.raises(ForbiddenError):
        await update_role(None, other_admin, UserRole.mine_manager, manager)


@pytest.mark.asyncio
async def test_manager_cannot_deactivate_an_administrator_account():
    manager = make_user(UserRole.mine_manager)
    other_admin = make_user(UserRole.administrator)
    with pytest.raises(ForbiddenError):
        await update_status(None, other_admin, False, manager)


@pytest.mark.asyncio
async def test_administrator_can_manage_another_administrators_role_and_status():
    admin = make_user(UserRole.administrator)
    other_admin = make_user(UserRole.administrator)
    updated_role = await update_role(_NoopWriteSession(), other_admin, UserRole.mine_manager, admin)
    assert updated_role.role == UserRole.mine_manager
    updated_status = await update_status(_NoopWriteSession(), other_admin, False, admin)
    assert updated_status.is_active is False


@pytest.mark.asyncio
async def test_manager_can_still_manage_ordinary_users():
    manager = make_user(UserRole.mine_manager)
    worker = make_user(UserRole.field_worker)
    updated = await update_role(_NoopWriteSession(), worker, UserRole.mine_manager, manager)
    assert updated.role == UserRole.mine_manager
    deactivated = await update_status(_NoopWriteSession(), worker, False, manager)
    assert deactivated.is_active is False
