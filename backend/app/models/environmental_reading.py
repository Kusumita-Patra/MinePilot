import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Index, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import DataSourceType, data_source_type_enum


class EnvironmentalReading(Base):
    """One measured parameter at one point in time from one registered
    environmental sensor (SensorConfig). A narrow, append-only fact table —
    NOT an EAV/generic-attribute table — following the exact shape/indexing
    convention TelemetryReading uses, just with a parameter/value/unit triple
    instead of 5 fixed columns, because environmental sensors report
    heterogeneous parameters (PM10, water pH, ...) unlike the frozen
    SensorFrame contract's fixed 5 safety fields.

    FK's `sensor_configs.id` (the registry row), not `sensors.sensor_id` —
    there is no WebSocket ingestion path for these sensors; every row here
    was written by an authenticated REST POST (manual or simulated entry)."""

    __tablename__ = "environmental_readings"
    __table_args__ = (Index("ix_environmental_readings_sensor_recorded", "sensor_config_id", "recorded_at"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    sensor_config_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sensor_configs.id"), nullable=False
    )
    parameter: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[float] = mapped_column(Float, nullable=False)
    # Denormalized at write time so historical rows stay correct even if
    # SensorConfig/EnvironmentalRequirement unit conventions change later.
    unit: Mapped[str] = mapped_column(String, nullable=False)
    data_source: Mapped[DataSourceType] = mapped_column(data_source_type_enum, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
