import uuid
from datetime import date

from app.models.enums import DataSourceType
from app.models.water_metric import WaterMetric
from app.services.water_metric_service import efficiency_m3_per_tonne, reuse_pct


def make_metric(
    consumed: float, reused: float, production_tonnes: float | None = None
) -> WaterMetric:
    return WaterMetric(
        id=uuid.uuid4(),
        sector_id=None,
        recorded_date=date.today(),
        water_consumed_m3=consumed,
        water_extracted_m3=consumed,
        water_reused_m3=reused,
        water_discharged_m3=0.0,
        production_tonnes=production_tonnes,
        data_source=DataSourceType.MANUAL_ENTRY,
        created_by=uuid.uuid4(),
    )


def test_reuse_pct_normal_case():
    metric = make_metric(consumed=1000.0, reused=250.0)
    assert reuse_pct(metric) == 25.0


def test_reuse_pct_zero_consumed_returns_none_not_zero_division_error():
    metric = make_metric(consumed=0.0, reused=0.0)
    assert reuse_pct(metric) is None


def test_efficiency_normal_case():
    metric = make_metric(consumed=2400.0, reused=0.0, production_tonnes=1000.0)
    assert efficiency_m3_per_tonne(metric) == 2.4


def test_efficiency_no_production_tonnes_returns_none():
    metric = make_metric(consumed=2400.0, reused=0.0, production_tonnes=None)
    assert efficiency_m3_per_tonne(metric) is None


def test_efficiency_zero_production_tonnes_returns_none_not_zero_division_error():
    metric = make_metric(consumed=2400.0, reused=0.0, production_tonnes=0.0)
    assert efficiency_m3_per_tonne(metric) is None
