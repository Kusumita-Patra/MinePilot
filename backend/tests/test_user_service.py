import uuid

import pytest

from app.exceptions.custom_exceptions import AppException
from app.models.enums import UserRole
from app.models.user import User
from app.services.user_service import update_role, update_status


def make_user(role: UserRole) -> User:
    return User(id=uuid.uuid4(), email="x@example.com", password_hash="h", full_name="X", role=role)


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
