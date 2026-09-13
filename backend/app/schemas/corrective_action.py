import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import CorrectiveActionPriority, CorrectiveActionSourceType, CorrectiveActionStatus


class CorrectiveActionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    source_type: CorrectiveActionSourceType
    source_id: str | None
    title: str
    description: str | None
    priority: CorrectiveActionPriority
    assigned_to: uuid.UUID | None
    due_date: date | None
    status: CorrectiveActionStatus
    created_at: datetime
    completed_at: datetime | None
    verification_required: bool
    verified_by: uuid.UUID | None
    verification_date: datetime | None
    remarks: str | None
    evidence_url: str | None
    created_by: uuid.UUID | None
    updated_at: datetime

    # Computed at read time, not stored — see corrective_action_service._is_overdue.
    is_overdue: bool = False


class CorrectiveActionCreate(BaseModel):
    source_type: CorrectiveActionSourceType
    source_id: str | None = Field(default=None, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    priority: CorrectiveActionPriority = CorrectiveActionPriority.MEDIUM
    assigned_to: uuid.UUID | None = None
    due_date: date | None = None
    verification_required: bool = False


class CorrectiveActionUpdate(BaseModel):
    """Deliberately excludes `status` — status changes go through the
    dedicated PATCH .../status endpoint, and verification through
    POST .../verify."""

    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    priority: CorrectiveActionPriority | None = None
    assigned_to: uuid.UUID | None = None
    due_date: date | None = None
    verification_required: bool | None = None


class CorrectiveActionTransition(BaseModel):
    status: CorrectiveActionStatus


class CorrectiveActionVerify(BaseModel):
    remarks: str | None = None
    evidence_url: str | None = None
