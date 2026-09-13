import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole, WorkerPositionSourceType


class WorkerLocationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    worker_id: uuid.UUID
    worker_name: str
    role: UserRole
    current_node_id: uuid.UUID | None
    node_label: str | None
    node_type: str | None
    sector_id: str | None
    world_x: float | None
    world_y: float | None
    world_z: float | None
    source_type: WorkerPositionSourceType
    last_moved_at: datetime | None
    # Computed at read time from last_moved_at staleness — not stored, same
    # "computed, never stored" precedent as SensorConfig.is_reporting.
    is_active: bool
