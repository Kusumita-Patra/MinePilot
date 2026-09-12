import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import (
    AlarmLightPattern,
    AlarmSoundPattern,
    AlarmState,
    alarm_light_pattern_enum,
    alarm_sound_pattern_enum,
    alarm_state_enum,
)


class AlarmConfig(Base):
    """Virtual/digital alarm behavior, one admin-configurable row per
    AlarmState — the AlertRule/EmergencyRule precedent. There is no real
    alarm hardware anywhere in this system: `light_pattern` and
    `sound_pattern` only ever drive on-screen visuals (a blinking tunnel
    edge, a pulsing banner) and a UI label, never an actual siren or strobe
    light. Which state currently applies to a sector is computed at read
    time from live hazard data (see evacuation_pathfinding_service /
    alarm_service) — never stored here, so a rule edit can't drift out of
    sync with reality."""

    __tablename__ = "alarm_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    state: Mapped[AlarmState] = mapped_column(alarm_state_enum, unique=True, nullable=False)
    light_pattern: Mapped[AlarmLightPattern] = mapped_column(alarm_light_pattern_enum, nullable=False)
    sound_pattern: Mapped[AlarmSoundPattern] = mapped_column(alarm_sound_pattern_enum, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
