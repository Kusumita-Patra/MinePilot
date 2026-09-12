import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import DuplicateError, NotFoundError
from app.models.enums import SustainabilityCategory
from app.models.sustainability_target import SustainabilityTarget
from app.schemas.sustainability import SustainabilityTargetCreate, SustainabilityTargetUpdate


async def list_targets(
    db: AsyncSession, *, category: SustainabilityCategory | None = None, is_active: bool | None = None
) -> list[SustainabilityTarget]:
    query = select(SustainabilityTarget)
    if category is not None:
        query = query.where(SustainabilityTarget.category == category)
    if is_active is not None:
        query = query.where(SustainabilityTarget.is_active == is_active)
    query = query.order_by(SustainabilityTarget.category, SustainabilityTarget.metric)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_active_target(db: AsyncSession, category: SustainabilityCategory, metric: str) -> SustainabilityTarget | None:
    result = await db.execute(
        select(SustainabilityTarget).where(
            SustainabilityTarget.category == category,
            SustainabilityTarget.metric == metric,
            SustainabilityTarget.is_active.is_(True),
        )
    )
    return result.scalar_one_or_none()


async def create_target(db: AsyncSession, payload: SustainabilityTargetCreate, created_by: uuid.UUID) -> SustainabilityTarget:
    existing = await db.execute(
        select(SustainabilityTarget).where(
            SustainabilityTarget.category == payload.category, SustainabilityTarget.metric == payload.metric
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise DuplicateError(f"A target for {payload.category.value}/{payload.metric!r} already exists")

    target = SustainabilityTarget(
        category=payload.category,
        metric=payload.metric,
        target_value=payload.target_value,
        unit=payload.unit,
        period=payload.period,
        warning_percentage=payload.warning_percentage,
        critical_percentage=payload.critical_percentage,
        created_by=created_by,
    )
    db.add(target)
    await db.commit()
    await db.refresh(target)
    return target


async def update_target(
    db: AsyncSession, target_id: uuid.UUID, payload: SustainabilityTargetUpdate, updated_by: uuid.UUID
) -> SustainabilityTarget:
    target = await db.get(SustainabilityTarget, target_id)
    if target is None:
        raise NotFoundError("Sustainability target not found")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(target, field, value)
    target.updated_by = updated_by

    await db.commit()
    await db.refresh(target)
    return target
