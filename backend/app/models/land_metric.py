import uuid
from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, Float, ForeignKey, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import DataSourceType, data_source_type_enum


class LandMetric(Base):
    """A periodic land-disturbance/reclamation snapshot row — unlike Water/
    Energy/Waste, these values are CUMULATIVE-TO-DATE totals ("120 ha
    disturbed so far"), not daily deltas — land disturbance/reclamation is a
    running state, not a per-day flow. One row per sector per day;
    `sector_id=None` means a mine-wide entry."""

    __tablename__ = "land_metrics"
    __table_args__ = (
        UniqueConstraint("sector_id", "recorded_date", name="uq_land_metrics_sector_date"),
        Index("ix_land_metrics_recorded_date", "recorded_date"),
        CheckConstraint("total_disturbed_area_ha >= 0", name="ck_land_metrics_disturbed_nonneg"),
        CheckConstraint("reclaimed_area_ha >= 0", name="ck_land_metrics_reclaimed_nonneg"),
        CheckConstraint(
            "active_reclamation_area_ha IS NULL OR active_reclamation_area_ha >= 0",
            name="ck_land_metrics_active_reclamation_nonneg",
        ),
        CheckConstraint(
            "revegetated_area_ha IS NULL OR revegetated_area_ha >= 0", name="ck_land_metrics_revegetated_nonneg"
        ),
        CheckConstraint(
            "erosion_incidents IS NULL OR erosion_incidents >= 0", name="ck_land_metrics_erosion_nonneg"
        ),
        CheckConstraint("reclaimed_area_ha <= total_disturbed_area_ha", name="ck_land_metrics_reclaimed_le_disturbed"),
        CheckConstraint(
            "active_reclamation_area_ha IS NULL OR active_reclamation_area_ha <= total_disturbed_area_ha",
            name="ck_land_metrics_active_le_disturbed",
        ),
        CheckConstraint(
            "revegetated_area_ha IS NULL OR revegetated_area_ha <= reclaimed_area_ha",
            name="ck_land_metrics_revegetated_le_reclaimed",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sector_id: Mapped[str | None] = mapped_column(String, nullable=True)
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_disturbed_area_ha: Mapped[float] = mapped_column(Float, nullable=False)
    reclaimed_area_ha: Mapped[float] = mapped_column(Float, nullable=False, server_default="0")
    active_reclamation_area_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    revegetated_area_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    erosion_incidents: Mapped[int | None] = mapped_column(Integer, nullable=True)
    data_source: Mapped[DataSourceType] = mapped_column(data_source_type_enum, nullable=False)
    # Nullable — a simulator-generated row has no human actor.
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
