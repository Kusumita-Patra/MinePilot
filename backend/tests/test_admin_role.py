import uuid

import pytest

from app.core.security import require_permission, require_role
from app.exceptions.custom_exceptions import ForbiddenError
from app.models.enums import UserRole
from app.models.user import User


def make_user(role: UserRole) -> User:
    return User(id=uuid.uuid4(), email="x@example.com", password_hash="h", full_name="X", role=role)


class _FakeScalarResult:
    def __init__(self, value: bool):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    """Stands in for AsyncSession — permission_service.is_allowed() only ever
    calls db.execute(...).scalar_one_or_none(), so a canned value is enough
    to unit-test require_permission's branching without a real database."""

    def __init__(self, allowed: bool):
        self._allowed = allowed

    async def execute(self, _query):
        return _FakeScalarResult(self._allowed)


@pytest.mark.asyncio
async def test_administrator_passes_administrator_only_check():
    dependency = require_role(UserRole.administrator)
    admin = make_user(UserRole.administrator)
    result = await dependency(current_user=admin)
    assert result is admin


@pytest.mark.asyncio
async def test_mine_manager_rejected_by_administrator_only_check():
    dependency = require_role(UserRole.administrator)
    manager = make_user(UserRole.mine_manager)
    with pytest.raises(ForbiddenError):
        await dependency(current_user=manager)


@pytest.mark.asyncio
async def test_field_worker_rejected_by_administrator_only_check():
    dependency = require_role(UserRole.administrator)
    worker = make_user(UserRole.field_worker)
    with pytest.raises(ForbiddenError):
        await dependency(current_user=worker)


@pytest.mark.asyncio
async def test_mine_manager_and_administrator_both_pass_shared_check():
    dependency = require_role(UserRole.mine_manager, UserRole.administrator)
    for user in (make_user(UserRole.mine_manager), make_user(UserRole.administrator)):
        result = await dependency(current_user=user)
        assert result is user


@pytest.mark.asyncio
async def test_field_worker_rejected_by_shared_manager_admin_check():
    dependency = require_role(UserRole.mine_manager, UserRole.administrator)
    worker = make_user(UserRole.field_worker)
    with pytest.raises(ForbiddenError):
        await dependency(current_user=worker)


# require_permission — the dynamic, admin-editable RBAC layer behind
# GET /api/users, blueprint writes, inspection scheduling, incident
# transitions, and everything under /api/admin/{audit-logs,system-health,
# alert-rules,compliance-rules}. administrator always bypasses the
# permissions table entirely (see core/security.py's docstring); every
# other role's outcome is whatever role_permissions says.


@pytest.mark.asyncio
async def test_administrator_bypasses_permission_table_entirely():
    dependency = require_permission("users.manage")
    admin = make_user(UserRole.administrator)
    # db=None proves this never touches the database for an administrator.
    result = await dependency(current_user=admin, db=None)
    assert result is admin


@pytest.mark.asyncio
async def test_non_admin_passes_when_permission_row_is_true():
    dependency = require_permission("users.view")
    manager = make_user(UserRole.mine_manager)
    result = await dependency(current_user=manager, db=_FakeSession(True))
    assert result is manager


@pytest.mark.asyncio
async def test_non_admin_rejected_when_permission_row_is_false():
    dependency = require_permission("users.manage")
    manager = make_user(UserRole.mine_manager)
    with pytest.raises(ForbiddenError):
        await dependency(current_user=manager, db=_FakeSession(False))
