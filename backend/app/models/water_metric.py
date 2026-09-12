import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import DataSourceType, data_source_type_enum


class WaterMetric(Base):
    """A periodic (daily) water-balance aggregate row — NOT raw sensor
    readings (those go through EnvironmentalReading when backed by a real
    water-flow/level sensor). One row per sector per day; `sector_id=None`
    means a mine-wide entry. Flagship feature of the Sustainability module —
    powers the water reuse %/efficiency dashboard card."""

    __tablename__ = "water_metrics"
    __table_args__ = (
        UniqueConstraint("sector_id", "recorded_date", name="uq_water_metrics_sector_date"),
        Index("ix_water_metrics_recorded_date", "recorded_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sector_id: Mapped[str | None] = mapped_column(String, nullable=True)
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
    water_consumed_m3: Mapped[float] = mapped_column(Float, nullable=False)
    water_extracted_m3: Mapped[float] = mapped_column(Float, nullable=False)
    water_reused_m3: Mapped[float] = mapped_column(Float, nullable=False)
    water_discharged_m3: Mapped[float] = mapped_column(Float, nullable=False)
    rainwater_collected_m3: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Optional — needed only to compute water efficiency (m3/tonne).
    production_tonnes: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_source: Mapped[DataSourceType] = mapped_column(data_source_type_enum, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
