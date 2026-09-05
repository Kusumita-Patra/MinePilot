from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import RiskLevel, risk_level_enum


class Sensor(Base):
    __tablename__ = "sensors"

    sensor_id: Mapped[str] = mapped_column(String, primary_key=True)
    sector_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    last_coordinates: Mapped[dict] = mapped_column(JSONB, nullable=False)
    last_risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    last_risk_level: Mapped[RiskLevel] = mapped_column(risk_level_enum, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
