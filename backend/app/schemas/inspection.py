import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import InspectionStatus


class InspectionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sector_id: str
    status: InspectionStatus
    scheduled_date: date
    completed_at: datetime | None = None
    inspector_id: uuid.UUID | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime


class InspectionCreate(BaseModel):
    sector_id: str
    scheduled_date: date
    notes: str | None = None


class InspectionUpdate(BaseModel):
    status: InspectionStatus | None = None
    notes: str | None = None
    completed_at: datetime | None = None
