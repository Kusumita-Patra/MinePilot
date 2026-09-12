"""list_escalation_due does a SQL query that's already narrowed to
status in (ACTIVE, ACKNOWLEDGED) and escalated_at is None (matching this
codebase's fake-session convention of not mocking the query builder itself)
— these tests exercise the pure deadline-arithmetic helper it delegates to,
is_escalation_due(), directly."""
import uuid
from datetime import datetime, timedelta, timezone

from app.models.emergency_event import EmergencyEvent
from app.models.enums import EmergencyEventStatus, HazardType, RiskLevel
from app.services.emergency_event_service import is_escalation_due


def make_event(activated_seconds_ago: int, timeout: int = 120) -> EmergencyEvent:
    now = datetime.now(timezone.utc)
    return EmergencyEvent(
        id=uuid.uuid4(),
        hazard_type=HazardType.METHANE,
        severity=RiskLevel.CRITICAL,
        status=EmergencyEventStatus.ACTIVE,
        trigger_sector_id="sector_north_wall",
        escalation_timeout_seconds=timeout,
        activated_at=now - timedelta(seconds=activated_seconds_ago),
    )


def test_past_deadline_is_due():
    event = make_event(activated_seconds_ago=200, timeout=120)
    assert is_escalation_due(event, datetime.now(timezone.utc)) is True


def test_before_deadline_is_not_due():
    event = make_event(activated_seconds_ago=10, timeout=120)
    assert is_escalation_due(event, datetime.now(timezone.utc)) is False


def test_exactly_at_deadline_is_due():
    event = make_event(activated_seconds_ago=120, timeout=120)
    assert is_escalation_due(event, datetime.now(timezone.utc)) is True


def test_naive_activated_at_is_treated_as_utc():
    # activated_at is always stored tz-aware in practice (DateTime(timezone=True)
    # + datetime.now(timezone.utc)), but the helper defends against a naive
    # value anyway rather than raising on tz-aware/naive subtraction.
    event = make_event(activated_seconds_ago=200, timeout=120)
    event.activated_at = event.activated_at.replace(tzinfo=None)
    assert is_escalation_due(event, datetime.now(timezone.utc)) is True
