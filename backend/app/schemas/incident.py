import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import IncidentStatus, RiskLevel


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ticket_id: str
    sensor_id: str
    sector_id: str
    risk_score: int
    severity: RiskLevel
    status: IncidentStatus
    assigned_worker_id: uuid.UUID | None = None
    field_remarks: str | None = None
    resolution_photo_url: str | None = None
    created_at: datetime
    resolved_at: datetime | None = None


class IncidentUpdate(BaseModel):
    status: IncidentStatus | None = None
    assigned_worker_id: uuid.UUID | None = None
    field_remarks: str | None = None
    resolution_photo_url: str | None = None
