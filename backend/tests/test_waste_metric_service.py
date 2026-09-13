import uuid
from datetime import date

import pytest

from app.models.enums import DataSourceType
from app.models.waste_metric import WasteMetric
from app.services.waste_metric_service import (
    _validate_accounting,
    diversion_rate_pct,
    recycling_rate_pct,
    reuse_rate_pct,
    waste_intensity_tonnes_per_tonne,
)


def make_metric(
    total: float, recycled: float = 0.0, reused: float = 0.0, production_tonnes: float | None = None
) -> WasteMetric:
    return WasteMetric(
        id=uuid.uuid4(),
        sector_id=None,
        recorded_date=date.today(),
        total_waste_tonnes=total,
        recycled_waste_tonnes=recycled,
        reused_waste_tonnes=reused,
        disposed_waste_tonnes=max(0.0, total - recycled - reused),
        production_tonnes=production_tonnes,
        data_source=DataSourceType.MANUAL_ENTRY,
        created_by=uuid.uuid4(),
    )


def test_diversion_rate_normal_case():
    metric = make_metric(total=100.0, recycled=40.0, reused=20.0)
    assert diversion_rate_pct(metric) == 60.0


def test_diversion_rate_zero_total_returns_none_not_zero_division_error():
    metric = make_metric(total=0.0)
    assert diversion_rate_pct(metric) is None


def test_recycling_rate_normal_case():
    metric = make_metric(total=100.0, recycled=25.0)
    assert recycling_rate_pct(metric) == 25.0


def test_reuse_rate_normal_case():
    metric = make_metric(total=100.0, reused=15.0)
    assert reuse_rate_pct(metric) == 15.0


def test_waste_intensity_normal_case():
    metric = make_metric(total=500.0, production_tonnes=5000.0)
    assert waste_intensity_tonnes_per_tonne(metric) == 0.1


def test_waste_intensity_no_production_returns_none():
    metric = make_metric(total=500.0, production_tonnes=None)
    assert waste_intensity_tonnes_per_tonne(metric) is None


def test_validate_accounting_accepts_exact_total():
    _validate_accounting(total=100.0, recycled=40.0, reused=20.0, disposed=40.0)  # should not raise


def test_validate_accounting_accepts_under_total():
    _validate_accounting(total=100.0, recycled=30.0, reused=10.0, disposed=40.0)  # should not raise


def test_validate_accounting_rejects_over_total():
    with pytest.raises(ValueError):
        _validate_accounting(total=100.0, recycled=50.0, reused=30.0, disposed=30.0)  # sums to 110
