import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.emergency_event import EmergencyRule
from app.models.enums import HazardType


async def list_rules(db: AsyncSession) -> list[EmergencyRule]:
    result = await db.execute(select(EmergencyRule).order_by(EmergencyRule.display_name))
    return list(result.scalars().all())


async def get_active_rule(db: AsyncSession, hazard_type: HazardType) -> EmergencyRule | None:
    """Used by the detection hook in telemetry_service.py — returns None
    (never raises) so a missing/inactive rule simply means "no detection for
    this hazard type yet" rather than an error."""
    result = await db.execute(
        select(EmergencyRule).where(EmergencyRule.hazard_type == hazard_type, EmergencyRule.is_active.is_(True))
    )
    return result.scalar_one_or_none()


async def update_rule(db: AsyncSession, rule_id: uuid.UUID, payload, updated_by: uuid.UUID) -> EmergencyRule:
    rule = await db.get(EmergencyRule, rule_id)
    if rule is None:
        raise NotFoundError("Emergency rule not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    rule.updated_by = updated_by

    await db.commit()
    await db.refresh(rule)
    return rule
