import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import SensorConfigStatus, SensorSourceType, SensorType
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
    source_type: SensorSourceType
    blueprint_id: uuid.UUID | None
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
    created_by: uuid.UUID | None
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
    source_type: SensorSourceType = SensorSourceType.REAL
    # Nullable: the sustainability simulator's auto-created environmental
    # sensors have no blueprint-relative placement yet (see
    # sustainability_simulator_service._ensure_environmental_sensors). An
    # administrator-registered sensor should still always supply this.
    blueprint_id: uuid.UUID | None = None
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

    @model_validator(mode="after")
    def _require_blueprint_unless_simulated(self) -> "SensorConfigCreate":
        # blueprint_id is nullable at the DB/model level only so the
        # sustainability simulator's auto-created environmental sensors
        # (source_type=SIMULATED, written via the service layer directly)
        # can omit a placement they don't have yet. Every other sensor —
        # in particular anything reaching this schema through the public
        # POST /api/sensors endpoint, which an administrator always drives
        # from the blueprint-placement canvas — must still supply one, or a
        # real/manual sensor could silently end up with no placement at all.
        if self.source_type != SensorSourceType.SIMULATED and self.blueprint_id is None:
            raise ValueError("blueprint_id is required unless source_type is SIMULATED")
        return self


class SensorConfigUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=200)
    sensor_type: SensorType | None = None
    manufacturer: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=200)
    source_type: SensorSourceType | None = None
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
