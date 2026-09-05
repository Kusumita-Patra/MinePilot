import uuid

import pytest

from app.exceptions.custom_exceptions import ForbiddenError
from app.models.enums import IncidentStatus, UserRole
from app.models.user import User
from app.services.incident_service import VALID_TRANSITIONS, _check_role_permission


def make_user(role: UserRole) -> User:
    return User(id=uuid.uuid4(), email="x@example.com", password_hash="h", full_name="X", role=role)


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


def test_field_worker_can_assign_resolve_escalate():
    worker = make_user(UserRole.field_worker)
    for target in (IncidentStatus.ASSIGNED, IncidentStatus.RESOLVED, IncidentStatus.ESCALATED):
        _check_role_permission(worker, target)  # should not raise


def test_field_worker_cannot_sign_off():
    worker = make_user(UserRole.field_worker)
    with pytest.raises(ForbiddenError):
        _check_role_permission(worker, IncidentStatus.SIGNED_OFF)


def test_mine_manager_can_sign_off():
    manager = make_user(UserRole.mine_manager)
    _check_role_permission(manager, IncidentStatus.SIGNED_OFF)  # should not raise
