import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import RequirementAppliesTo, requirement_applies_to_enum


class ComplianceRequirement(Base):
    """An administrator-managed document/certification requirement (e.g.
    "Medical Examination" for workers, "CLRA Licence" for contractors) with
    its expiry warning thresholds. Governance master data — not yet consumed
    by the Documents/Contractors frontend, which still runs on its own mock
    data per CLAUDE.md."""

    __tablename__ = "compliance_requirements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    applies_to: Mapped[RequirementAppliesTo] = mapped_column(requirement_applies_to_enum, nullable=False)
    document_type: Mapped[str] = mapped_column(String, nullable=False)
    warning_threshold_days: Mapped[int] = mapped_column(Integer, nullable=False)
    critical_threshold_days: Mapped[int] = mapped_column(Integer, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
