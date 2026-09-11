import uuid

import pytest

from app.exceptions.custom_exceptions import ForbiddenError
from app.models.enums import IncidentStatus, UserRole
from app.models.user import User
from app.services.incident_service import VALID_TRANSITIONS, _capability_for_target, _check_role_permission


def make_user(role: UserRole) -> User:
    return User(id=uuid.uuid4(), email="x@example.com", password_hash="h", full_name="X", role=role)


class _FakeScalarResult:
    def __init__(self, value: bool):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    """Stands in for AsyncSession in these unit tests — permission_service.is_allowed()
    only ever calls `db.execute(...).scalar_one_or_none()`, so a canned
    return value is enough to test _check_role_permission's branching without
    a real database (matches this repo's existing pure-unit-test convention)."""

    def __init__(self, allowed: bool):
        self._allowed = allowed

    async def execute(self, _query):
        return _FakeScalarResult(self._allowed)


def test_valid_transition_graph_matches_incidents_py():
    # Mirrors the reference in-memory VALID_TRANSITIONS from T2's incidents.py
    assert VALID_TRANSITIONS[IncidentStatus.TRIGGERED] == {IncidentStatus.ASSIGNED}
    assert VALID_TRANSITIONS[IncidentStatus.ASSIGNED] == {
        IncidentStatus.RESOLVED,
        IncidentStatus.ESCALATED,
    }
    assert VALID_TRANSITIONS[IncidentStatus.ESCALATED] == {
        IncidentStatus.ASSIGNED,
        IncidentStatus.SIGNED_OFF,
    }
    assert VALID_TRANSITIONS[IncidentStatus.RESOLVED] == {IncidentStatus.SIGNED_OFF}
    assert VALID_TRANSITIONS[IncidentStatus.SIGNED_OFF] == set()


def test_capability_for_target():
    assert _capability_for_target(IncidentStatus.SIGNED_OFF) == "incidents.sign_off"
    for target in (IncidentStatus.ASSIGNED, IncidentStatus.RESOLVED, IncidentStatus.ESCALATED):
        assert _capability_for_target(target) == "incidents.transition"


@pytest.mark.asyncio
async def test_administrator_bypasses_permission_table_entirely():
    # §3: administrator must have everything mine_manager/field_worker have
    # here. Passing db=None proves the admin branch never touches the DB.
    admin = make_user(UserRole.administrator)
    for target in (
        IncidentStatus.ASSIGNED,
        IncidentStatus.RESOLVED,
        IncidentStatus.ESCALATED,
        IncidentStatus.SIGNED_OFF,
    ):
        await _check_role_permission(None, admin, target)  # should not raise


@pytest.mark.asyncio
async def test_mine_manager_allowed_when_permission_row_is_true():
    manager = make_user(UserRole.mine_manager)
    await _check_role_permission(_FakeSession(True), manager, IncidentStatus.SIGNED_OFF)  # should not raise


@pytest.mark.asyncio
async def test_mine_manager_denied_when_permission_row_is_false():
    manager = make_user(UserRole.mine_manager)
    with pytest.raises(ForbiddenError):
        await _check_role_permission(_FakeSession(False), manager, IncidentStatus.SIGNED_OFF)


@pytest.mark.asyncio
async def test_field_inspector_access_is_fixed_not_db_driven():
    # field_worker ("Field Inspector") never reads role_permissions — access
    # is hardcoded to incidents.transition only, regardless of what a stale
    # or malicious db session would return.
    worker = make_user(UserRole.field_worker)
    await _check_role_permission(_FakeSession(False), worker, IncidentStatus.ASSIGNED)  # transition: fixed-allowed
    with pytest.raises(ForbiddenError):
        await _check_role_permission(_FakeSession(True), worker, IncidentStatus.SIGNED_OFF)  # sign_off: fixed-denied
