import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class MineBlueprint(Base):
    """An admin-uploaded aerial/plan image of the mine. The most recently
    uploaded row is treated as the active one (see blueprint_service.get_active)
    — no separate activation step in v1."""

    __tablename__ = "mine_blueprints"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    filename: Mapped[str] = mapped_column(String, nullable=False)  # stored disk filename (uuid-based)
    original_filename: Mapped[str] = mapped_column(String, nullable=False)
    content_type: Mapped[str] = mapped_column(String, nullable=False)
    image_width: Mapped[int] = mapped_column(Integer, nullable=False)
    image_height: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sections: Mapped[list["BlueprintSection"]] = relationship(
        back_populates="blueprint", cascade="all, delete-orphan", order_by="BlueprintSection.created_at"
    )


class BlueprintSection(Base):
    """One admin-traced tunnel path over a blueprint image — a polyline in
    the source image's pixel coordinates, plus the place name and depth the
    3D twin's click-to-inspect card shows. `sector_id` ties it to one of the
    4 fixed sectors shared with the telemetry contract (shared/types/telemetry.ts)
    for risk-color aggregation; `name` is the free-text label as it appears
    on the blueprint (e.g. "North Trunk"), which can be far more specific
    than the 4 broad sector categories."""

    __tablename__ = "blueprint_sections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blueprint_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mine_blueprints.id", ondelete="CASCADE"), nullable=False
    )
    sector_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    level_label: Mapped[str] = mapped_column(String, nullable=False)
    depth: Mapped[float] = mapped_column(Float, nullable=False)
    path: Mapped[list] = mapped_column(JSON, nullable=False)  # [[x, y], ...] pixel coords on the source image
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    blueprint: Mapped["MineBlueprint"] = relationship(back_populates="sections")
