from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import RiskLevel, risk_level_enum


class TelemetryReading(Base):
    __tablename__ = "telemetry_readings"
    __table_args__ = (
        Index("ix_telemetry_readings_sensor_recorded", "sensor_id", "recorded_at"),
        Index("ix_telemetry_readings_sector_recorded", "sector_id", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sensor_id: Mapped[str] = mapped_column(
        String, ForeignKey("sensors.sensor_id"), nullable=False
    )
    sector_id: Mapped[str] = mapped_column(String, nullable=False)
    ch4_pct: Mapped[float] = mapped_column(Float, nullable=False)
    co_ppm: Mapped[float] = mapped_column(Float, nullable=False)
    dust_pm10: Mapped[float] = mapped_column(Float, nullable=False)
    displacement_mm: Mapped[float] = mapped_column(Float, nullable=False)
    temp_c: Mapped[float] = mapped_column(Float, nullable=False)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(risk_level_enum, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
