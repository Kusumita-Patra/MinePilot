import uuid
from datetime import date, timedelta

import pytest

from app.exceptions.custom_exceptions import ForbiddenError
from app.models.corrective_action import CorrectiveAction
from app.models.enums import CorrectiveActionSourceType, CorrectiveActionStatus, UserRole
from app.models.user import User
from app.services.corrective_action_service import VALID_TRANSITIONS, _check_capability, _is_overdue


def make_user(role: UserRole, user_id: uuid.UUID | None = None) -> User:
    return User(id=user_id or uuid.uuid4(), email="x@example.com", password_hash="h", full_name="X", role=role)


def make_action(status: CorrectiveActionStatus, due_date: date | None = None) -> CorrectiveAction:
    return CorrectiveAction(
        id=uuid.uuid4(),
        source_type=CorrectiveActionSourceType.MANUAL,
        title="Test action",
        status=status,
        due_date=due_date,
        created_by=uuid.uuid4(),
    )


class _FakeScalarResult:
    def __init__(self, value: bool):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    """Mirrors test_incident_transitions.py's _FakeSession — is_allowed()
    only ever calls db.execute(...).scalar_one_or_none()."""

    def __init__(self, allowed: bool):
        self._allowed = allowed

    async def execute(self, _query):
        return _FakeScalarResult(self._allowed)


def test_valid_transition_graph():
    assert VALID_TRANSITIONS[CorrectiveActionStatus.OPEN] == {
        CorrectiveActionStatus.IN_PROGRESS,
        CorrectiveActionStatus.CANCELLED,
    }
    assert VALID_TRANSITIONS[CorrectiveActionStatus.IN_PROGRESS] == {
        CorrectiveActionStatus.COMPLETED,
        CorrectiveActionStatus.CANCELLED,
    }
    # VERIFIED is never a direct transition target — only reachable via
    # verify_action, which is a separate endpoint/service function entirely.
    assert VALID_TRANSITIONS[CorrectiveActionStatus.COMPLETED] == set()
    assert VALID_TRANSITIONS[CorrectiveActionStatus.VERIFIED] == set()
    assert VALID_TRANSITIONS[CorrectiveActionStatus.CANCELLED] == set()


def test_is_overdue_past_due_and_open_is_true():
    action = make_action(CorrectiveActionStatus.OPEN, due_date=date.today() - timedelta(days=1))
    assert _is_overdue(action) is True


def test_is_overdue_past_due_but_verified_is_false():
    action = make_action(CorrectiveActionStatus.VERIFIED, due_date=date.today() - timedelta(days=1))
    assert _is_overdue(action) is False


def test_is_overdue_no_due_date_is_false():
    action = make_action(CorrectiveActionStatus.OPEN, due_date=None)
    assert _is_overdue(action) is False


def test_is_overdue_future_due_date_is_false():
    action = make_action(CorrectiveActionStatus.OPEN, due_date=date.today() + timedelta(days=5))
    assert _is_overdue(action) is False


@pytest.mark.asyncio
async def test_administrator_bypasses_permission_table_entirely():
    admin = make_user(UserRole.administrator)
    # db=None proves the admin branch never touches the database.
    await _check_capability(None, admin, "corrective_actions.manage")
    await _check_capability(None, admin, "corrective_actions.verify")


@pytest.mark.asyncio
async def test_field_worker_verify_is_fixed_not_db_driven():
    worker = make_user(UserRole.field_worker)
    # db=None proves field_worker's branch never touches the database either.
    await _check_capability(None, worker, "corrective_actions.verify")  # should not raise
    with pytest.raises(ForbiddenError):
        await _check_capability(None, worker, "corrective_actions.manage")


@pytest.mark.asyncio
async def test_mine_manager_allowed_when_permission_row_is_true():
    manager = make_user(UserRole.mine_manager)
    await _check_capability(_FakeSession(True), manager, "corrective_actions.manage")  # should not raise


@pytest.mark.asyncio
async def test_mine_manager_denied_when_permission_row_is_false():
    manager = make_user(UserRole.mine_manager)
    with pytest.raises(ForbiddenError):
        await _check_capability(_FakeSession(False), manager, "corrective_actions.manage")
