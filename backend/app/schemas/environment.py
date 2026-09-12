import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import DataSourceType, EnvironmentalCategory

# A POST body can never claim REAL_SENSOR — there is no hardware ingestion
# path yet, so every reading created through this API is manual or
# simulated. See DataSourceType's docstring in models/enums.py.
ReadingDataSource = Literal["SIMULATED_SENSOR", "MANUAL_ENTRY"]


class EnvironmentalRequirementResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    category: EnvironmentalCategory
    name: str
    description: str | None
    parameter: str
    unit: str
    warning_threshold: float | None
    critical_threshold: float | None
    regulatory_reference: str | None
    authority: str | None
    frequency: str | None
    is_active: bool
    created_by: uuid.UUID
    updated_by: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class EnvironmentalRequirementCreate(BaseModel):
    category: EnvironmentalCategory
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    parameter: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=50)
    warning_threshold: float | None = None
    critical_threshold: float | None = None
    regulatory_reference: str | None = Field(default=None, max_length=300)
    authority: str | None = Field(default=None, max_length=200)
    frequency: str | None = Field(default=None, max_length=100)


class EnvironmentalRequirementUpdate(BaseModel):
    category: EnvironmentalCategory | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    parameter: str | None = Field(default=None, min_length=1, max_length=100)
    unit: str | None = Field(default=None, min_length=1, max_length=50)
    warning_threshold: float | None = None
    critical_threshold: float | None = None
    regulatory_reference: str | None = Field(default=None, max_length=300)
    authority: str | None = Field(default=None, max_length=200)
    frequency: str | None = Field(default=None, max_length=100)
    is_active: bool | None = None


class EnvironmentalReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sensor_config_id: uuid.UUID
    parameter: str
    value: float
    unit: str
    data_source: DataSourceType
    recorded_at: datetime
    created_at: datetime

    # Enrichment field — not a column, populated by the service layer.
    sensor_display_name: str | None = None


class EnvironmentalReadingCreate(BaseModel):
    sensor_config_id: uuid.UUID
    parameter: str = Field(min_length=1, max_length=100)
    value: float
    unit: str = Field(min_length=1, max_length=50)
    data_source: ReadingDataSource
    recorded_at: datetime | None = None
