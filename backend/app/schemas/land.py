import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import DataSourceType
from app.schemas.blueprint import SectorId

LandMetricDataSource = Literal["SIMULATED_SENSOR", "MANUAL_ENTRY"]


class LandMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sector_id: str | None
    recorded_date: date
    total_disturbed_area_ha: float
    reclaimed_area_ha: float
    active_reclamation_area_ha: float | None
    revegetated_area_ha: float | None
    erosion_incidents: int | None
    data_source: DataSourceType
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    # Computed, not stored — see land_metric_service.
    reclamation_rate_pct: float | None = None
    revegetation_rate_pct: float | None = None


class LandMetricCreate(BaseModel):
    sector_id: SectorId | None = None
    recorded_date: date
    total_disturbed_area_ha: float = Field(ge=0)
    reclaimed_area_ha: float = Field(default=0, ge=0)
    active_reclamation_area_ha: float | None = Field(default=None, ge=0)
    revegetated_area_ha: float | None = Field(default=None, ge=0)
    erosion_incidents: int | None = Field(default=None, ge=0)
    data_source: LandMetricDataSource

    @model_validator(mode="after")
    def _validate_areas(self) -> "LandMetricCreate":
        if self.reclaimed_area_ha > self.total_disturbed_area_ha + 1e-6:
            raise ValueError("reclaimed_area_ha cannot exceed total_disturbed_area_ha")
        if self.active_reclamation_area_ha is not None and self.active_reclamation_area_ha > self.total_disturbed_area_ha + 1e-6:
            raise ValueError("active_reclamation_area_ha cannot exceed total_disturbed_area_ha")
        if self.revegetated_area_ha is not None and self.revegetated_area_ha > self.reclaimed_area_ha + 1e-6:
            raise ValueError("revegetated_area_ha cannot exceed reclaimed_area_ha")
        return self


class LandSummaryResponse(BaseModel):
    date: date
    sector_id: str | None
    total_disturbed_area_ha: float
    reclaimed_area_ha: float
    active_reclamation_area_ha: float | None
    revegetated_area_ha: float | None
    erosion_incidents: int | None
    reclamation_rate_pct: float | None
    revegetation_rate_pct: float | None
    data_source: DataSourceType | None
