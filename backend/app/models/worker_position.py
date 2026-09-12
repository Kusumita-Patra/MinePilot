import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import (
    WorkerEvacuationStatus,
    WorkerPositionSourceType,
    worker_evacuation_status_enum,
    worker_position_source_type_enum,
)


class WorkerPosition(Base):
    """Live position cache, one row per worker — upserted, mirroring the
    Sensor table's pattern (a live cache auto-upserted with no history),
    NOT TelemetryReading's append-only-history pattern. There is no real
    underground personnel-tracking hardware in this project: source_type
    is SIMULATED for every row any endpoint can currently produce.
    REAL_TRACKER/MANUAL exist in the enum only so a future integration
    doesn't need another migration — see WorkerPositionSourceType."""

    __tablename__ = "worker_positions"

    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    current_node_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evacuation_nodes.id"), nullable=True
    )
    sector_id: Mapped[str | None] = mapped_column(String, nullable=True)
    source_type: Mapped[WorkerPositionSourceType] = mapped_column(
        worker_position_source_type_enum, nullable=False, server_default=WorkerPositionSourceType.SIMULATED.value
    )
    status: Mapped[WorkerEvacuationStatus] = mapped_column(
        worker_evacuation_status_enum, nullable=False, server_default=WorkerEvacuationStatus.NOT_AFFECTED.value
    )
    active_route_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evacuation_routes.id"), nullable=True
    )
    # Set whenever a hop actually succeeds (worker_position_service.
    # advance_one_hop) — compared against now() to detect a worker who
    # should be moving but hasn't (WorkerEvacuationStatus.DELAYED).
    last_moved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Demo-only manual override ("Worker Not Moving" scenario) — the
    # simulator otherwise always advances a worker exactly one hop per tick,
    # so there is no organic way to reach DELAYED without this.
    manual_stall: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
