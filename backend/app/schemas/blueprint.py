import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import SectionStatus, ZoneType

# Mirrors MineSectorId in src/components/digital-twin/types.ts — kept as a
# plain Literal (not a Postgres enum) for the same reason Inspection.sector_id
# is a plain string column: this is a display/aggregation grouping, not a
# state machine.
#
# Values must equal T2's real telemetry sector_id (data_generator.py
# SECTORS) — this previously used the 3D twin's own separate taxonomy for 3
# of its 4 sectors, the same pre-existing mismatch
# b5c6d7e8f9a0_align_evacuation_graph_sectors_with_telemetry.py fixed for
# the evacuation graph. No migration needed here: blueprint_sections has no
# seeded rows (schema-only), so there's no existing data to backfill —
# but any sections already created via the UI under the old ids would
# need a one-off UPDATE to match.
SectorId = Literal[
    "sector_north_wall",
    "sector_shaft_b",
    "sector_conveyor_3",
    "sector_south_face",
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
    zone_type: ZoneType
    status: SectionStatus
    created_at: datetime
    updated_at: datetime


class BlueprintSectionCreate(BaseModel):
    sector_id: SectorId
    name: str = Field(min_length=1, max_length=200)
    level_label: str = Field(min_length=1, max_length=50)
    depth: float
    path: list[PathPoint] = Field(min_length=2)
    zone_type: ZoneType = ZoneType.NORMAL
    status: SectionStatus = SectionStatus.ACTIVE


class BlueprintSectionUpdate(BaseModel):
    sector_id: SectorId | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    level_label: str | None = Field(default=None, min_length=1, max_length=50)
    depth: float | None = None
    path: list[PathPoint] | None = Field(default=None, min_length=2)
    zone_type: ZoneType | None = None
    status: SectionStatus | None = None


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


class BlueprintHistoryItem(BaseModel):
    id: uuid.UUID
    name: str
    version: int
    is_active: bool
    uploaded_by: uuid.UUID
    uploaded_by_name: str
    section_count: int
    created_at: datetime
