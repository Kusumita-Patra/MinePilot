import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import SustainabilityCategory, TargetPeriod, sustainability_category_enum, target_period_enum


class SustainabilityTarget(Base):
    """An administrator-configured target for one sustainability metric (e.g.
    "water_reuse_pct" -> 50%). One active target definition per (category,
    metric) — an admin edits it rather than creating duplicates, mirroring
    AlertRule.rule_key's uniqueness."""

    __tablename__ = "sustainability_targets"
    __table_args__ = (UniqueConstraint("category", "metric", name="uq_sustainability_targets_category_metric"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    category: Mapped[SustainabilityCategory] = mapped_column(sustainability_category_enum, nullable=False)
    metric: Mapped[str] = mapped_column(String, nullable=False)
    target_value: Mapped[float] = mapped_column(Float, nullable=False)
    unit: Mapped[str] = mapped_column(String, nullable=False)
    period: Mapped[TargetPeriod] = mapped_column(target_period_enum, nullable=False)
    warning_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    critical_percentage: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
