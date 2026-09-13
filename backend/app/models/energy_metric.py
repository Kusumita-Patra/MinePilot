import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, Index, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import DataSourceType, data_source_type_enum


class EnergyMetric(Base):
    """A periodic (daily) energy-consumption aggregate row — mirrors
    WaterMetric's shape exactly. One row per sector per day; `sector_id=None`
    means a mine-wide entry."""

    __tablename__ = "energy_metrics"
    __table_args__ = (
        UniqueConstraint("sector_id", "recorded_date", name="uq_energy_metrics_sector_date"),
        Index("ix_energy_metrics_recorded_date", "recorded_date"),
        CheckConstraint("electricity_kwh >= 0", name="ck_energy_metrics_electricity_nonneg"),
        CheckConstraint("fuel_litres IS NULL OR fuel_litres >= 0", name="ck_energy_metrics_fuel_nonneg"),
        CheckConstraint(
            "renewable_energy_kwh IS NULL OR renewable_energy_kwh >= 0",
            name="ck_energy_metrics_renewable_nonneg",
        ),
        CheckConstraint("peak_demand_kw IS NULL OR peak_demand_kw >= 0", name="ck_energy_metrics_peak_demand_nonneg"),
        CheckConstraint(
            "production_tonnes IS NULL OR production_tonnes >= 0", name="ck_energy_metrics_production_nonneg"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sector_id: Mapped[str | None] = mapped_column(String, nullable=True)
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
    electricity_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    fuel_litres: Mapped[float | None] = mapped_column(Float, nullable=True)
    renewable_energy_kwh: Mapped[float | None] = mapped_column(Float, nullable=True)
    peak_demand_kw: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Optional — needed only to compute energy intensity (kWh/tonne).
    production_tonnes: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_source: Mapped[DataSourceType] = mapped_column(data_source_type_enum, nullable=False)
    # Nullable — a simulator-generated row has no human actor.
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
