import uuid
from datetime import date

from app.models.energy_metric import EnergyMetric
from app.models.enums import DataSourceType
from app.services.energy_metric_service import energy_intensity_kwh_per_tonne, renewable_percentage


def make_metric(electricity: float, renewable: float | None = None, production_tonnes: float | None = None) -> EnergyMetric:
    return EnergyMetric(
        id=uuid.uuid4(),
        sector_id=None,
        recorded_date=date.today(),
        electricity_kwh=electricity,
        renewable_energy_kwh=renewable,
        production_tonnes=production_tonnes,
        data_source=DataSourceType.MANUAL_ENTRY,
        created_by=uuid.uuid4(),
    )


def test_energy_intensity_normal_case():
    metric = make_metric(electricity=12000.0, production_tonnes=5000.0)
    assert energy_intensity_kwh_per_tonne(metric) == 2.4


def test_energy_intensity_no_production_returns_none():
    metric = make_metric(electricity=12000.0, production_tonnes=None)
    assert energy_intensity_kwh_per_tonne(metric) is None


def test_energy_intensity_zero_production_returns_none_not_zero_division_error():
    metric = make_metric(electricity=12000.0, production_tonnes=0.0)
    assert energy_intensity_kwh_per_tonne(metric) is None


def test_renewable_percentage_normal_case():
    metric = make_metric(electricity=10000.0, renewable=1500.0)
    assert renewable_percentage(metric) == 15.0


def test_renewable_percentage_missing_renewable_returns_none():
    metric = make_metric(electricity=10000.0, renewable=None)
    assert renewable_percentage(metric) is None


def test_renewable_percentage_zero_electricity_returns_none_not_zero_division_error():
    metric = make_metric(electricity=0.0, renewable=0.0)
    assert renewable_percentage(metric) is None
