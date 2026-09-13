import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DataSourceType
from app.schemas.blueprint import SectorId

EnergyMetricDataSource = Literal["SIMULATED_SENSOR", "MANUAL_ENTRY"]


class EnergyMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sector_id: str | None
    recorded_date: date
    electricity_kwh: float
    fuel_litres: float | None
    renewable_energy_kwh: float | None
    peak_demand_kw: float | None
    production_tonnes: float | None
    data_source: DataSourceType
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    # Computed, not stored — see energy_metric_service.
    energy_intensity_kwh_per_tonne: float | None = None
    renewable_percentage: float | None = None


class EnergyMetricCreate(BaseModel):
    sector_id: SectorId | None = None
    recorded_date: date
    electricity_kwh: float = Field(ge=0)
    fuel_litres: float | None = Field(default=None, ge=0)
    renewable_energy_kwh: float | None = Field(default=None, ge=0)
    peak_demand_kw: float | None = Field(default=None, ge=0)
    production_tonnes: float | None = Field(default=None, ge=0)
    data_source: EnergyMetricDataSource


class EnergySummaryResponse(BaseModel):
    date: date
    sector_id: str | None
    electricity_kwh: float
    fuel_litres: float | None
    renewable_energy_kwh: float | None
    peak_demand_kw: float | None
    production_tonnes: float | None
    energy_intensity_kwh_per_tonne: float | None
    renewable_percentage: float | None
    data_source: DataSourceType | None
