import uuid
from datetime import date

import pytest

from app.models.enums import DataSourceType
from app.models.land_metric import LandMetric
from app.services.land_metric_service import _validate_areas, reclamation_rate_pct, revegetation_rate_pct


def make_metric(disturbed: float, reclaimed: float = 0.0, revegetated: float | None = None) -> LandMetric:
    return LandMetric(
        id=uuid.uuid4(),
        sector_id=None,
        recorded_date=date.today(),
        total_disturbed_area_ha=disturbed,
        reclaimed_area_ha=reclaimed,
        revegetated_area_ha=revegetated,
        data_source=DataSourceType.MANUAL_ENTRY,
        created_by=uuid.uuid4(),
    )


def test_reclamation_rate_normal_case():
    metric = make_metric(disturbed=120.0, reclaimed=78.0)
    assert reclamation_rate_pct(metric) == 65.0


def test_reclamation_rate_zero_disturbed_returns_none_not_zero_division_error():
    metric = make_metric(disturbed=0.0)
    assert reclamation_rate_pct(metric) is None


def test_revegetation_rate_normal_case():
    metric = make_metric(disturbed=120.0, reclaimed=80.0, revegetated=40.0)
    assert revegetation_rate_pct(metric) == 50.0


def test_revegetation_rate_missing_revegetated_returns_none():
    metric = make_metric(disturbed=120.0, reclaimed=80.0, revegetated=None)
    assert revegetation_rate_pct(metric) is None


def test_revegetation_rate_zero_reclaimed_returns_none_not_zero_division_error():
    metric = make_metric(disturbed=120.0, reclaimed=0.0, revegetated=0.0)
    assert revegetation_rate_pct(metric) is None


def test_validate_areas_accepts_valid_case():
    _validate_areas(disturbed=120.0, reclaimed=78.0, active=20.0, revegetated=40.0)  # should not raise


def test_validate_areas_rejects_reclaimed_greater_than_disturbed():
    with pytest.raises(ValueError):
        _validate_areas(disturbed=100.0, reclaimed=110.0, active=None, revegetated=None)


def test_validate_areas_rejects_revegetated_greater_than_reclaimed():
    with pytest.raises(ValueError):
        _validate_areas(disturbed=100.0, reclaimed=50.0, active=None, revegetated=60.0)


def test_validate_areas_rejects_active_greater_than_disturbed():
    with pytest.raises(ValueError):
        _validate_areas(disturbed=100.0, reclaimed=50.0, active=110.0, revegetated=None)
