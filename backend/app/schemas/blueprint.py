import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Mirrors MineSectorId in src/components/digital-twin/types.ts — kept as a
# plain Literal (not a Postgres enum) for the same reason Inspection.sector_id
# is a plain string column: this is a display/aggregation grouping, not a
# state machine.
SectorId = Literal[
    "sector_north_wall",
    "sector_deep_shaft_b",
    "sector_surface_conveyor",
    "sector_main_pit",
]

PathPoint = tuple[float, float]


class BlueprintSectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    blueprint_id: uuid.UUID
    sector_id: str
    name: str
    level_label: str
    depth: float
    path: list[PathPoint]
    created_at: datetime
    updated_at: datetime


class BlueprintSectionCreate(BaseModel):
    sector_id: SectorId
    name: str = Field(min_length=1, max_length=200)
    level_label: str = Field(min_length=1, max_length=50)
    depth: float
    path: list[PathPoint] = Field(min_length=2)


class BlueprintSectionUpdate(BaseModel):
    sector_id: SectorId | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    level_label: str | None = Field(default=None, min_length=1, max_length=50)
    depth: float | None = None
    path: list[PathPoint] | None = Field(default=None, min_length=2)


class BlueprintResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    original_filename: str
    content_type: str
    image_width: int
    image_height: int
    uploaded_by: uuid.UUID
    created_at: datetime
    sections: list[BlueprintSectionResponse] = []
