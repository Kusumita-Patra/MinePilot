from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import ComplianceCategory, compliance_category_enum


class ComplianceScore(Base):
    __tablename__ = "compliance_scores"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    category: Mapped[ComplianceCategory] = mapped_column(compliance_category_enum, nullable=False)
    sector_id: Mapped[str | None] = mapped_column(String, nullable=True)
    score_pct: Mapped[float] = mapped_column(Float, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
