import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.alert_rule import AlertRule
from app.schemas.admin import AlertRuleUpdate


async def list_rules(db: AsyncSession) -> list[AlertRule]:
    result = await db.execute(select(AlertRule).order_by(AlertRule.display_name))
    return list(result.scalars().all())


async def update_rule(db: AsyncSession, rule_id: uuid.UUID, payload: AlertRuleUpdate, updated_by: uuid.UUID) -> AlertRule:
    rule = await db.get(AlertRule, rule_id)
    if rule is None:
        raise NotFoundError("Alert rule not found")

    if payload.warning_threshold is not None:
        rule.warning_threshold = payload.warning_threshold
    if payload.critical_threshold is not None:
        rule.critical_threshold = payload.critical_threshold
    if payload.is_active is not None:
        rule.is_active = payload.is_active
    rule.updated_by = updated_by

    await db.commit()
    await db.refresh(rule)
    return rule
