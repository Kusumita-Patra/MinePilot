import pytest
from pydantic import ValidationError

from app.schemas.auth import RegisterRequest


def test_register_accepts_mine_manager_and_field_worker():
    for role in ("mine_manager", "field_worker"):
        req = RegisterRequest(email="x@example.com", password="password123", full_name="X", role=role)
        assert req.role == role


def test_register_rejects_administrator():
    # Public self-registration must never be able to create an administrator
    # account — see backend/scripts/promote_to_admin.py for the real path.
    with pytest.raises(ValidationError):
        RegisterRequest(email="x@example.com", password="password123", full_name="X", role="administrator")
