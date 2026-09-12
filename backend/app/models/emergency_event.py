import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import EmergencyEventStatus, HazardType, RiskLevel, emergency_event_status_enum, hazard_type_enum, risk_level_enum


class EmergencyEvent(Base):
    """An ongoing hazardous event, distinct from the compliance-workflow
    Incident ticket the same reading already opens (trigger_incident_ticket_id
    is a soft, non-functional cross-link for traceability only — this model
    never reads Incident fields to make decisions). Drives the escalation
    timer and, once EVACUATION_ACTIVE, the evacuation-routing engine.

    Detection is keyed on the raw telemetry field for a given hazard type
    (e.g. ch4_pct for METHANE) against an admin-configurable
    EmergencyRule.critical_threshold — never on risk_level/risk_score, which
    are blended signals that don't identify a specific hazard. This module
    never reads or mutates T2's risk engine output."""

    __tablename__ = "emergency_events"
    __table_args__ = (
        Index("ix_emergency_events_hazard_sector_status", "hazard_type", "trigger_sector_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hazard_type: Mapped[HazardType] = mapped_column(hazard_type_enum, nullable=False)
    # Always CRITICAL in this pass — only a critical reading creates/bumps an
    # event (see emergency_event_service.detect_and_create); reuses the
    # existing RiskLevel vocabulary rather than a new EmergencySeverity enum.
    severity: Mapped[RiskLevel] = mapped_column(risk_level_enum, nullable=False)
    status: Mapped[EmergencyEventStatus] = mapped_column(
        emergency_event_status_enum, nullable=False, server_default=EmergencyEventStatus.DETECTED.value, index=True
    )
    trigger_sector_id: Mapped[str] = mapped_column(String, nullable=False)
    # Deliberately NOT an FK to sensors.sensor_id (unlike Incident.sensor_id):
    # the demo /events/simulate endpoint must accept an arbitrary/synthetic
    # sensor identifier that was never ingested through the real telemetry
    # pipeline. A real detection-hook-created event's sensor_id will always
    # happen to exist in `sensors` (it just triggered a frame), but that's
    # incidental, not enforced.
    trigger_sensor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    trigger_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    trigger_incident_ticket_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("incidents.ticket_id"), nullable=True
    )

    # Snapshotted from EmergencyRule at creation so a later rule edit never
    # retroactively changes an in-flight countdown.
    escalation_timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    escalated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    escalated_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    evacuation_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    resolution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class EmergencyRule(Base):
    """Administrator-configured, one row per HazardType — the AlertRule
    precedent. critical_threshold is what actually gates EmergencyEvent
    creation; warning_threshold is display-only in this pass (a single-
    severity workflow — see emergency_event_service)."""

    __tablename__ = "emergency_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hazard_type: Mapped[HazardType] = mapped_column(hazard_type_enum, unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    warning_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    critical_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String, nullable=True)
    escalation_timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, server_default="120")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
