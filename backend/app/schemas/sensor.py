import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SensorConfigStatus, SensorType
from app.schemas.blueprint import SectorId

CalibrationStatus = Literal["VALID", "DUE_SOON", "OVERDUE"]


class CurrentReading(BaseModel):
    ch4_pct: float
    co_ppm: float
    displacement_mm: float
    temp_c: float
    dust_pm10: float
    risk_score: int
    risk_level: str
    timestamp: str


class SensorConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sensor_id: str
    display_name: str
    sensor_type: SensorType
    manufacturer: str | None
    model: str | None
    status: SensorConfigStatus
    blueprint_id: uuid.UUID
    section_id: uuid.UUID | None
    sector_id: str
    level_label: str
    depth: float
    pixel_x: float
    pixel_y: float
    warning_threshold: float | None
    critical_threshold: float | None
    installation_date: date | None
    last_calibration_at: date | None
    next_calibration_at: date | None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime

    # Enrichment fields — not columns on SensorConfig itself, populated by
    # sensor_config_service before returning. See that module's docstring for
    # why these are computed, not stored.
    is_reporting: bool = False
    current_reading: CurrentReading | None = None
    calibration_status: CalibrationStatus | None = None


class SensorConfigCreate(BaseModel):
    sensor_id: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=200)
    sensor_type: SensorType
    manufacturer: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    blueprint_id: uuid.UUID
    section_id: uuid.UUID | None = None
    sector_id: SectorId
    level_label: str = Field(min_length=1, max_length=50)
    depth: float
    pixel_x: float
    pixel_y: float
    warning_threshold: float | None = None
    critical_threshold: float | None = None
    installation_date: date | None = None
    last_calibration_at: date | None = None
    next_calibration_at: date | None = None


class SensorConfigUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    sensor_type: SensorType | None = None
    manufacturer: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    warning_threshold: float | None = None
    critical_threshold: float | None = None
    installation_date: date | None = None
    last_calibration_at: date | None = None
    next_calibration_at: date | None = None


class SensorStatusUpdate(BaseModel):
    status: SensorConfigStatus


class SensorLocationUpdate(BaseModel):
    section_id: uuid.UUID | None = None
    sector_id: SectorId
    level_label: str = Field(min_length=1, max_length=50)
    depth: float
    pixel_x: float
    pixel_y: float


class SensorStatsResponse(BaseModel):
    total: int
    by_status: dict[str, int]
    offline_count: int
