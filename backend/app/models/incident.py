import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import (
    IncidentStatus,
    RiskLevel,
    incident_status_enum,
    risk_level_enum,
)


class Incident(Base):
    __tablename__ = "incidents"

    ticket_id: Mapped[str] = mapped_column(String, primary_key=True)
    sensor_id: Mapped[str] = mapped_column(
        String, ForeignKey("sensors.sensor_id"), nullable=False
    )
    sector_id: Mapped[str] = mapped_column(String, nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    severity: Mapped[RiskLevel] = mapped_column(risk_level_enum, nullable=False)
    status: Mapped[IncidentStatus] = mapped_column(
        incident_status_enum, nullable=False, default=IncidentStatus.TRIGGERED
    )
    assigned_worker_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    field_remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolution_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
