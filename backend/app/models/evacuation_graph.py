import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import EvacuationNodeType, evacuation_node_type_enum


class EvacuationNode(Base):
    """A junction/exit/refuge/work-area in the evacuation graph — this
    codebase's own authoritative mine-graph representation, deliberately
    NOT scraped from the frontend's client-only, seeded-random procedural
    tunnel network (mineLayout.ts's VeinNet has no server-side form at all).
    world_x/world_y/world_z follow the same raw-world-coordinate convention
    SensorConfig already uses, so a node can exist independent of any
    uploaded blueprint (blueprint_section_id is optional provenance only,
    populated when derived via evacuation_graph_service.derive_from_blueprint)."""

    __tablename__ = "evacuation_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_type: Mapped[EvacuationNodeType] = mapped_column(evacuation_node_type_enum, nullable=False)
    sector_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    blueprint_section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprint_sections.id"), nullable=True
    )
    world_x: Mapped[float] = mapped_column(Float, nullable=False)
    world_y: Mapped[float] = mapped_column(Float, nullable=False)
    world_z: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class EvacuationEdge(Base):
    """One traversable tunnel segment between two nodes — undirected (both
    directions are valid at pathfinding time). Permanent topology only:
    whether this edge is CURRENTLY hazardous is never stored here — it's
    derived at pathfinding time from any active EmergencyEvent in this
    edge's sector (see evacuation_pathfinding_service). manually_blocked is
    the one exception: a genuine physical closure (§38's "emergency
    override"), distinct from transient hazard state, so it IS persisted."""

    __tablename__ = "evacuation_edges"
    __table_args__ = (Index("ix_evacuation_edges_from_to", "from_node_id", "to_node_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("evacuation_nodes.id"), nullable=False)
    to_node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("evacuation_nodes.id"), nullable=False)
    # Denormalized so the hazard-lookup join at pathfinding time never has to
    # touch the nodes table.
    sector_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    distance: Mapped[float] = mapped_column(Float, nullable=False)
    blueprint_section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprint_sections.id"), nullable=True
    )
    manually_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    blocked_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    blocked_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class EvacuationExit(Base):
    """Administrator-configured safe exit. capacity_note is informational
    text only — no capacity-aware/throughput routing in this pass."""

    __tablename__ = "evacuation_exits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("evacuation_nodes.id"), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    sector_id: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    capacity_note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
