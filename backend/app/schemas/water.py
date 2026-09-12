import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DataSourceType
from app.schemas.blueprint import SectorId

WaterMetricDataSource = Literal["SIMULATED_SENSOR", "MANUAL_ENTRY"]


class WaterMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sector_id: str | None
    recorded_date: date
    water_consumed_m3: float
    water_extracted_m3: float
    water_reused_m3: float
    water_discharged_m3: float
    rainwater_collected_m3: float | None
    production_tonnes: float | None
    data_source: DataSourceType
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    # Computed, not stored — see water_metric_service._reuse_pct/_efficiency.
    reuse_pct: float | None = None
    efficiency_m3_per_tonne: float | None = None


class WaterMetricCreate(BaseModel):
    sector_id: SectorId | None = None
    recorded_date: date
    water_consumed_m3: float = Field(ge=0)
    water_extracted_m3: float = Field(ge=0)
    water_reused_m3: float = Field(ge=0)
    water_discharged_m3: float = Field(ge=0)
    rainwater_collected_m3: float | None = Field(default=None, ge=0)
    production_tonnes: float | None = Field(default=None, ge=0)
    data_source: WaterMetricDataSource


class WaterSummaryResponse(BaseModel):
    date: date
    sector_id: str | None
    water_used_m3: float
    water_reused_m3: float
    reuse_rate_pct: float | None
    water_discharged_m3: float
    efficiency_m3_per_tonne: float | None
    data_source: DataSourceType | None
