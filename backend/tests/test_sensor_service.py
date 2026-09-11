import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.exceptions.custom_exceptions import DuplicateError
from app.models.enums import SensorType
from app.schemas.sensor import SensorConfigCreate
from app.services.sensor_config_service import (
    CALIBRATION_DUE_SOON_DAYS,
    _calibration_status,
    _is_reporting,
    create_sensor,
)


def test_calibration_status_none_when_never_calibrated():
    assert _calibration_status(None) is None


def test_calibration_status_overdue():
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date()
    assert _calibration_status(yesterday) == "OVERDUE"


def test_calibration_status_due_soon():
    soon = (datetime.now(timezone.utc) + timedelta(days=CALIBRATION_DUE_SOON_DAYS - 1)).date()
    assert _calibration_status(soon) == "DUE_SOON"


def test_calibration_status_valid():
    far = (datetime.now(timezone.utc) + timedelta(days=CALIBRATION_DUE_SOON_DAYS + 30)).date()
    assert _calibration_status(far) == "VALID"


def test_is_reporting_none_last_seen():
    assert _is_reporting(None) is False


def test_is_reporting_fresh():
    assert _is_reporting(datetime.now(timezone.utc)) is True


def test_is_reporting_stale():
    stale = datetime.now(timezone.utc) - timedelta(hours=1)
    assert _is_reporting(stale) is False


class _FakeScalarResult:
    def __init__(self, value):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeExistingSensorSession:
    """create_sensor's duplicate check is `db.execute(select(...)).scalar_one_or_none()`
    — a canned truthy result is enough to exercise the DuplicateError branch
    without a real database, matching this repo's existing fake-session
    convention (see test_incident_transitions.py)."""

    async def execute(self, _query):
        return _FakeScalarResult(object())  # any non-None value means "found"


@pytest.mark.asyncio
async def test_create_sensor_rejects_duplicate_sensor_id():
    payload = SensorConfigCreate(
        sensor_id="SNS-SEC1-CH4-01",
        display_name="Test Sensor",
        sensor_type=SensorType.METHANE,
        blueprint_id=uuid.uuid4(),
        sector_id="sector_north_wall",
        level_label="Level -1",
        depth=-15.0,
        pixel_x=100.0,
        pixel_y=200.0,
        installation_date=date(2026, 1, 1),
    )
    with pytest.raises(DuplicateError):
        await create_sensor(_FakeExistingSensorSession(), payload, uuid.uuid4())
