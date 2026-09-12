from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, Index, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import DataSourceType, SustainabilityCategory, data_source_type_enum, sustainability_category_enum


class SustainabilityScore(Base):
    """A snapshot row for one sustainability sub-score category (or OVERALL),
    taken opportunistically when GET /api/sustainability/scores or /dashboard
    is hit (rate-limited in the service layer, not a stored cadence) — this
    codebase has no cron/background-job infrastructure, so persisting on read
    is how this gives itself the historical-trend capability kpi_service.py
    explicitly says it lacks elsewhere. Every row this module produces uses
    data_source=CALCULATED; methodology_notes always explains the derivation
    so no score is ever a black-box number."""

    __tablename__ = "sustainability_scores"
    __table_args__ = (Index("ix_sustainability_scores_category_computed", "category", "computed_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    category: Mapped[SustainabilityCategory] = mapped_column(sustainability_category_enum, nullable=False)
    score_pct: Mapped[float] = mapped_column(Float, nullable=False)
    methodology_notes: Mapped[str] = mapped_column(Text, nullable=False)
    data_source: Mapped[DataSourceType] = mapped_column(data_source_type_enum, nullable=False)
    time_range_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    time_range_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
