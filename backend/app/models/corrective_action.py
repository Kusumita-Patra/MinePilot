import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import (
    CorrectiveActionPriority,
    CorrectiveActionSourceType,
    CorrectiveActionStatus,
    corrective_action_priority_enum,
    corrective_action_source_type_enum,
    corrective_action_status_enum,
)


class CorrectiveAction(Base):
    """Reusable corrective-action tracker, shared across safety incidents,
    environmental requirement breaches, inspections, and ad-hoc manual
    creation. `source_type`/`source_id` are deliberately loose (no FK) —
    polymorphic sourcing (e.g. an Incident.ticket_id) without adding a hard
    dependency on incident.py or any other source table."""

    __tablename__ = "corrective_actions"
    __table_args__ = (
        Index("ix_corrective_actions_status", "status"),
        Index("ix_corrective_actions_source", "source_type", "source_id"),
        Index("ix_corrective_actions_due_date", "due_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_type: Mapped[CorrectiveActionSourceType] = mapped_column(
        corrective_action_source_type_enum, nullable=False
    )
    source_id: Mapped[str | None] = mapped_column(String, nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[CorrectiveActionPriority] = mapped_column(
        corrective_action_priority_enum, nullable=False, server_default=CorrectiveActionPriority.MEDIUM.value
    )
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[CorrectiveActionStatus] = mapped_column(
        corrective_action_status_enum, nullable=False, server_default=CorrectiveActionStatus.OPEN.value
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    verified_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    verification_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # Nullable — a system-generated action (e.g. from the sustainability
    # simulator) has no human actor. created_by=None renders as "System" in
    # the UI rather than a user's name.
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
