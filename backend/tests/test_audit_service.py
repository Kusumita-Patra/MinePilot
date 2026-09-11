import inspect

from app.models.audit_log import AdminAuditLog
from app.services import audit_service

BANNED_SUBSTRINGS = ("password", "token", "jwt", "secret", "hash")


def test_record_signature_has_no_raw_passthrough():
    # audit_service.record() must only ever accept the specific named fields
    # below — never a raw request body / headers dict — so a password or JWT
    # can't end up in an audit row just because a caller passed one in.
    params = inspect.signature(audit_service.record).parameters
    assert set(params) == {"db", "actor", "action", "resource_type", "description", "resource_id", "metadata"}
    assert not any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params.values())


def test_admin_audit_log_model_has_no_secret_shaped_columns():
    column_names = {c.name for c in AdminAuditLog.__table__.columns}
    for name in column_names:
        assert not any(banned in name.lower() for banned in BANNED_SUBSTRINGS), (
            f"admin_audit_logs column {name!r} looks secret-shaped"
        )
