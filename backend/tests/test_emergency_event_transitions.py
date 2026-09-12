import uuid

import pytest

from app.exceptions.custom_exceptions import ForbiddenError
from app.models.enums import EmergencyEventStatus, UserRole
from app.models.user import User
from app.services.emergency_event_service import VALID_TRANSITIONS, _capability_for_target, _check_role_permission


def make_user(role: UserRole) -> User:
    return User(id=uuid.uuid4(), email="x@example.com", password_hash="h", full_name="X", role=role)


class _FakeScalarResult:
    def __init__(self, value: bool):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    def __init__(self, allowed: bool):
        self._allowed = allowed

    async def execute(self, _query):
        return _FakeScalarResult(self._allowed)


def test_valid_transition_graph():
    S = EmergencyEventStatus
    assert VALID_TRANSITIONS[S.DETECTED] == {S.ACTIVE, S.CANCELLED}
    assert VALID_TRANSITIONS[S.ACTIVE] == {S.ACKNOWLEDGED, S.ESCALATED, S.CANCELLED}
    assert VALID_TRANSITIONS[S.ACKNOWLEDGED] == {S.EVACUATION_ACTIVE, S.ESCALATED, S.CANCELLED}
    assert VALID_TRANSITIONS[S.ESCALATED] == {S.ACKNOWLEDGED, S.EVACUATION_ACTIVE, S.CANCELLED}
    assert VALID_TRANSITIONS[S.EVACUATION_ACTIVE] == {S.RESOLVED}
    assert VALID_TRANSITIONS[S.RESOLVED] == set()
    assert VALID_TRANSITIONS[S.CANCELLED] == set()


def test_capability_for_target():
    S = EmergencyEventStatus
    assert _capability_for_target(S.ACKNOWLEDGED) == "emergency.acknowledge"
    assert _capability_for_target(S.ESCALATED) == "emergency.escalate"
    assert _capability_for_target(S.EVACUATION_ACTIVE) == "emergency.escalate"
    assert _capability_for_target(S.RESOLVED) == "emergency.resolve"
    assert _capability_for_target(S.CANCELLED) == "emergency.resolve"


@pytest.mark.asyncio
async def test_administrator_bypasses_permission_table_entirely():
    admin = make_user(UserRole.administrator)
    for target in (
        EmergencyEventStatus.ACKNOWLEDGED,
        EmergencyEventStatus.ESCALATED,
        EmergencyEventStatus.EVACUATION_ACTIVE,
        EmergencyEventStatus.RESOLVED,
        EmergencyEventStatus.CANCELLED,
    ):
        await _check_role_permission(None, admin, target)  # should not raise, db=None proves no DB touch


@pytest.mark.asyncio
async def test_mine_manager_allowed_when_permission_row_is_true():
    manager = make_user(UserRole.mine_manager)
    await _check_role_permission(_FakeSession(True), manager, EmergencyEventStatus.ACKNOWLEDGED)


@pytest.mark.asyncio
async def test_mine_manager_denied_when_permission_row_is_false():
    manager = make_user(UserRole.mine_manager)
    with pytest.raises(ForbiddenError):
        await _check_role_permission(_FakeSession(False), manager, EmergencyEventStatus.RESOLVED)


@pytest.mark.asyncio
async def test_field_worker_denied_for_every_target():
    # No fixed capability exists for field_worker in this module — Emergency
    # Mode is read-only for them this pass (see plan deviation 2).
    worker = make_user(UserRole.field_worker)
    for target in (
        EmergencyEventStatus.ACKNOWLEDGED,
        EmergencyEventStatus.ESCALATED,
        EmergencyEventStatus.EVACUATION_ACTIVE,
        EmergencyEventStatus.RESOLVED,
        EmergencyEventStatus.CANCELLED,
    ):
        with pytest.raises(ForbiddenError):
            await _check_role_permission(_FakeSession(False), worker, target)
