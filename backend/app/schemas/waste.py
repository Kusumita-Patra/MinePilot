import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import DataSourceType
from app.schemas.blueprint import SectorId

WasteMetricDataSource = Literal["SIMULATED_SENSOR", "MANUAL_ENTRY"]


class WasteMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sector_id: str | None
    recorded_date: date
    total_waste_tonnes: float
    recycled_waste_tonnes: float
    reused_waste_tonnes: float
    disposed_waste_tonnes: float
    hazardous_waste_tonnes: float | None
    production_tonnes: float | None
    data_source: DataSourceType
    created_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    # Computed, not stored — see waste_metric_service.
    diversion_rate_pct: float | None = None
    recycling_rate_pct: float | None = None
    reuse_rate_pct: float | None = None
    waste_intensity_tonnes_per_tonne: float | None = None


class WasteMetricCreate(BaseModel):
    sector_id: SectorId | None = None
    recorded_date: date
    total_waste_tonnes: float = Field(ge=0)
    recycled_waste_tonnes: float = Field(default=0, ge=0)
    reused_waste_tonnes: float = Field(default=0, ge=0)
    disposed_waste_tonnes: float = Field(default=0, ge=0)
    hazardous_waste_tonnes: float | None = Field(default=None, ge=0)
    production_tonnes: float | None = Field(default=None, ge=0)
    data_source: WasteMetricDataSource

    @model_validator(mode="after")
    def _validate_accounting(self) -> "WasteMetricCreate":
        # Never silently produce contradictory numbers — the DB CheckConstraint
        # is the last line of defense, this is the honest first one so the
        # client gets a real validation error, not a raw 500.
        accounted = self.recycled_waste_tonnes + self.reused_waste_tonnes + self.disposed_waste_tonnes
        if accounted > self.total_waste_tonnes + 1e-6:
            raise ValueError(
                f"recycled + reused + disposed ({accounted}) cannot exceed total_waste_tonnes ({self.total_waste_tonnes})"
            )
        return self


class WasteSummaryResponse(BaseModel):
    date: date
    sector_id: str | None
    total_waste_tonnes: float
    recycled_waste_tonnes: float
    reused_waste_tonnes: float
    disposed_waste_tonnes: float
    hazardous_waste_tonnes: float | None
    diversion_rate_pct: float | None
    recycling_rate_pct: float | None
    reuse_rate_pct: float | None
    waste_intensity_tonnes_per_tonne: float | None
    data_source: DataSourceType | None
