import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.alarm_config import AlarmConfig
from app.models.enums import AlarmState, RiskLevel
from app.models.user import User
from app.schemas.emergency import AlarmConfigUpdate

# Sector-level hazard severity -> the virtual alarm state a worker in that
# sector sees. Deliberately a fixed mapping, not admin-configurable — the
# color/state a given hazard level maps to is a safety invariant, matching
# why EvacuationEdge's hard-exclusion rule (CRITICAL -> excluded) is code,
# not a stored setting. Only the light PATTERN and sound within a state are
# configurable (see AlarmConfig).
_SEVERITY_TO_ALARM_STATE: dict[RiskLevel | None, AlarmState] = {
    None: AlarmState.SAFE,
    RiskLevel.NORMAL: AlarmState.SAFE,
    RiskLevel.WARNING: AlarmState.CAUTION,
    RiskLevel.CRITICAL: AlarmState.DANGER,
}


def alarm_state_for_severity(severity: RiskLevel | None) -> AlarmState:
    """Pure — unit-tested directly."""
    return _SEVERITY_TO_ALARM_STATE[severity]


async def list_configs(db: AsyncSession) -> list[AlarmConfig]:
    result = await db.execute(select(AlarmConfig).order_by(AlarmConfig.state))
    return list(result.scalars().all())


async def update_config(
    db: AsyncSession, config_id: uuid.UUID, payload: AlarmConfigUpdate, current_user: User
) -> AlarmConfig:
    from app.services import audit_service

    config = await db.get(AlarmConfig, config_id)
    if config is None:
        raise NotFoundError("Alarm configuration not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    config.updated_by = current_user.id

    await audit_service.record(
        db,
        actor=current_user,
        action="alarm_config.update",
        resource_type="alarm_config",
        resource_id=str(config_id),
        description=f"Updated {config.state.value} alarm pattern to {config.light_pattern.value}/{config.sound_pattern.value}",
        commit=False,
    )
    await db.commit()
    await db.refresh(config)
    return config
