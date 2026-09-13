import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import (
    SensorConfigStatus,
    SensorSourceType,
    SensorType,
    sensor_config_status_enum,
    sensor_source_type_enum,
    sensor_type_enum,
)


class SensorConfig(Base):
    """The administrator-owned sensor *registry* — name, type, spatial
    placement, thresholds, calibration, lifecycle. Deliberately separate from
    `models.sensor.Sensor`, which is purely a live-telemetry cache
    auto-upserted by `telemetry_service._process_frame` on every frame with no
    admin involvement and none of this metadata.

    `sensor_id` is a plain unique string, NOT a foreign key to
    `sensors.sensor_id` — an administrator can register/place a sensor before
    it has ever sent a telemetry frame (configure-then-monitor), so a hard FK
    would wrongly block that ordering.

    Coordinates reuse the exact convention `BlueprintSection` already
    established: `pixel_x`/`pixel_y` are pixel coordinates on the blueprint
    source image (frontend converts to world X/Z with the same formula used
    for blueprint tunnel paths), and `depth` is used directly as the world Y
    coordinate (verified in MineTerrain.tsx: `y={section.depth}`, no further
    scaling) — these are blueprint-relative visualization coordinates, not
    georeferenced survey coordinates.
    """

    __tablename__ = "sensor_configs"
    __table_args__ = (UniqueConstraint("sensor_id", name="uq_sensor_configs_sensor_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sensor_id: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    sensor_type: Mapped[SensorType] = mapped_column(sensor_type_enum, nullable=False)
    manufacturer: Mapped[str | None] = mapped_column(String, nullable=True)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[SensorConfigStatus] = mapped_column(
        sensor_config_status_enum, nullable=False, server_default=SensorConfigStatus.ACTIVE.value
    )
    # Data-provenance flag for the Sustainability module (environmental
    # sensors especially — there's no real hardware integration yet, so most
    # rows will be SIMULATED/MANUAL). Defaults to REAL so every pre-existing
    # safety sensor's behavior is unchanged by this column's addition.
    source_type: Mapped[SensorSourceType] = mapped_column(
        sensor_source_type_enum, nullable=False, server_default=SensorSourceType.REAL.value
    )

    # Nullable: the sustainability simulator auto-creates environmental
    # sensors (PM10/PM2.5/SO2/NOx) with no blueprint-relative placement yet
    # when none exists in a fresh demo DB — see sustainability_simulator_
    # service._ensure_environmental_sensors. source_type=SIMULATED makes
    # this visually obvious in the registry; it's a fully real row otherwise.
    blueprint_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mine_blueprints.id"), nullable=True
    )
    section_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("blueprint_sections.id"), nullable=True
    )
    sector_id: Mapped[str] = mapped_column(String, nullable=False)
    level_label: Mapped[str] = mapped_column(String, nullable=False)
    depth: Mapped[float] = mapped_column(Float, nullable=False)
    pixel_x: Mapped[float] = mapped_column(Float, nullable=False)
    pixel_y: Mapped[float] = mapped_column(Float, nullable=False)

    # Governance-only — see CLAUDE.md: not read by T2's risk_scoring.py or by
    # any incident-triggering logic in this backend, same caveat as AlertRule.
    warning_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)
    critical_threshold: Mapped[float | None] = mapped_column(Float, nullable=True)

    installation_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_calibration_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_calibration_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Nullable: the simulator's auto-created environmental sensors have no
    # human actor, matching corrective_actions.created_by's precedent.
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
