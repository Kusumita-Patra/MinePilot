import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import EvacuationRouteStatus, evacuation_route_status_enum


class EvacuationRoute(Base):
    """One computed evacuation route for one worker during one
    EmergencyEvent. Versioned rather than mutated in place: a route that's
    invalidated by a new hazard is marked INVALIDATED and a fresh
    route_version+1 row is created (superseded_by_route_id links them) — a
    full audit trail of "the mine told this worker to go this way, then
    changed its mind because X," not just the latest state."""

    __tablename__ = "evacuation_routes"
    __table_args__ = (Index("ix_evacuation_routes_event_worker_status", "emergency_event_id", "worker_id", "status"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    emergency_event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("emergency_events.id"), nullable=False, index=True
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    origin_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("evacuation_nodes.id"), nullable=False)
    destination_exit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evacuation_exits.id"), nullable=False
    )
    # Ordered list of node-id strings from origin to the exit's node.
    node_path: Mapped[list] = mapped_column(JSON, nullable=False)
    total_distance: Mapped[float] = mapped_column(Float, nullable=False)
    eta_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    safety_score: Mapped[float] = mapped_column(Float, nullable=False)
    hazards_avoided: Mapped[list | None] = mapped_column(JSON, nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    route_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    status: Mapped[EvacuationRouteStatus] = mapped_column(
        evacuation_route_status_enum, nullable=False, server_default=EvacuationRouteStatus.ACTIVE.value
    )
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    invalidated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    superseded_by_route_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evacuation_routes.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
