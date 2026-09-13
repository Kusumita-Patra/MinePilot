import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import DataSourceType, data_source_type_enum


class WasteMetric(Base):
    """A periodic (daily) waste-accounting aggregate row — mirrors
    WaterMetric's shape. `hazardous_waste_tonnes` is an informational
    classification (a subset callout, e.g. "of which N tonnes hazardous"),
    not an additional additive category — it is NOT summed into the
    recycled+reused+disposed<=total accounting check below."""

    __tablename__ = "waste_metrics"
    __table_args__ = (
        UniqueConstraint("sector_id", "recorded_date", name="uq_waste_metrics_sector_date"),
        Index("ix_waste_metrics_recorded_date", "recorded_date"),
        CheckConstraint("total_waste_tonnes >= 0", name="ck_waste_metrics_total_nonneg"),
        CheckConstraint("recycled_waste_tonnes >= 0", name="ck_waste_metrics_recycled_nonneg"),
        CheckConstraint("reused_waste_tonnes >= 0", name="ck_waste_metrics_reused_nonneg"),
        CheckConstraint("disposed_waste_tonnes >= 0", name="ck_waste_metrics_disposed_nonneg"),
        CheckConstraint(
            "hazardous_waste_tonnes IS NULL OR hazardous_waste_tonnes >= 0",
            name="ck_waste_metrics_hazardous_nonneg",
        ),
        CheckConstraint(
            "production_tonnes IS NULL OR production_tonnes >= 0", name="ck_waste_metrics_production_nonneg"
        ),
        CheckConstraint(
            "recycled_waste_tonnes + reused_waste_tonnes + disposed_waste_tonnes <= total_waste_tonnes",
            name="ck_waste_metrics_accounting",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sector_id: Mapped[str | None] = mapped_column(String, nullable=True)
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_waste_tonnes: Mapped[float] = mapped_column(Float, nullable=False)
    recycled_waste_tonnes: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    reused_waste_tonnes: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    disposed_waste_tonnes: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    hazardous_waste_tonnes: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Optional — needed only to compute waste intensity (tonnes/tonne).
    production_tonnes: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_source: Mapped[DataSourceType] = mapped_column(data_source_type_enum, nullable=False)
    # Nullable — a simulator-generated row has no human actor.
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
