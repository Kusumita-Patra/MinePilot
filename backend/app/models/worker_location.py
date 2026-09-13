import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import WorkerPositionSourceType, worker_position_source_type_enum


class WorkerLocation(Base):
    """Continuous, always-on geotagging cache — one row per field worker,
    upserted every tick by worker_geotracking_service, independent of any
    emergency/evacuation. Deliberately a SEPARATE table from WorkerPosition
    (which is evacuation-lifecycle-scoped: reset to NOT_AFFECTED when an
    emergency resolves, driven by evacuation routes/pathfinding) — this
    table exists during normal operation and is never touched by the
    emergency system, matching this codebase's established pattern of
    additive, non-overlapping tables (e.g. SensorConfig vs Sensor,
    EnergyMetric vs WaterMetric) rather than overloading one table's
    lifecycle with two different meanings.

    Reuses the same evacuation-graph node network (EvacuationNode,
    world_x/y/z) as the 3D twin's evacuation overlay already does — there is
    no real underground personnel-tracking hardware in this project, so
    source_type is SIMULATED for every row any endpoint can currently
    produce, same honesty caveat as WorkerPosition.
    """

    __tablename__ = "worker_locations"

    worker_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    current_node_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evacuation_nodes.id"), nullable=True
    )
    sector_id: Mapped[str | None] = mapped_column(String, nullable=True)
    source_type: Mapped[WorkerPositionSourceType] = mapped_column(
        worker_position_source_type_enum, nullable=False, server_default=WorkerPositionSourceType.SIMULATED.value
    )
    last_moved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
