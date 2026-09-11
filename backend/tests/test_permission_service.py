import uuid

import pytest

from app.core.permissions import CAPABILITIES, FIELD_WORKER_FIXED_CAPABILITIES
from app.exceptions.custom_exceptions import AppException
from app.models.enums import UserRole
from app.models.role_permission import RolePermission
from app.services import permission_service


def test_field_worker_fixed_capabilities_is_exactly_incidents_transition():
    # Locks in the product decision: Field Inspector can only ever transition
    # incidents (assign/resolve/escalate) — nothing admin-editable.
    assert FIELD_WORKER_FIXED_CAPABILITIES == {"incidents.transition"}


@pytest.mark.asyncio
async def test_field_worker_is_allowed_never_touches_db():
    for capability, _ in CAPABILITIES:
        expected = capability in FIELD_WORKER_FIXED_CAPABILITIES
        # db=None proves this branch never queries the database.
        assert await permission_service.is_allowed(None, UserRole.field_worker, capability) is expected


@pytest.mark.asyncio
async def test_get_my_permissions_for_field_worker_matches_fixed_set():
    permissions = await permission_service.get_my_permissions(None, UserRole.field_worker)
    assert permissions == {capability: (capability in FIELD_WORKER_FIXED_CAPABILITIES) for capability, _ in CAPABILITIES}


@pytest.mark.asyncio
async def test_get_my_permissions_for_administrator_is_all_true():
    permissions = await permission_service.get_my_permissions(None, UserRole.administrator)
    assert all(permissions.values())
    assert set(permissions) == {capability for capability, _ in CAPABILITIES}


@pytest.mark.asyncio
async def test_update_permission_rejects_non_mine_manager_role():
    # Regression guard for the fixed-role invariant: even a real row id for
    # field_worker/administrator must be rejected, not just the UI hiding it.
    class _RejectingSession:
        async def get(self, model, permission_id):
            return RolePermission(id=permission_id, role=UserRole.field_worker, capability="incidents.transition", allowed=True)

    with pytest.raises(AppException) as exc_info:
        await permission_service.update_permission(_RejectingSession(), uuid.uuid4(), True, uuid.uuid4())
    assert exc_info.value.status_code == 409
