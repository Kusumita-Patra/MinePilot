import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.environmental_requirement import EnvironmentalRequirement
from app.models.enums import EnvironmentalCategory
from app.schemas.environment import EnvironmentalRequirementCreate, EnvironmentalRequirementUpdate


async def list_requirements(
    db: AsyncSession, *, category: EnvironmentalCategory | None = None, is_active: bool | None = None
) -> list[EnvironmentalRequirement]:
    query = select(EnvironmentalRequirement)
    if category is not None:
        query = query.where(EnvironmentalRequirement.category == category)
    if is_active is not None:
        query = query.where(EnvironmentalRequirement.is_active == is_active)
    query = query.order_by(EnvironmentalRequirement.category, EnvironmentalRequirement.name)

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_requirement(db: AsyncSession, requirement_id: uuid.UUID) -> EnvironmentalRequirement:
    requirement = await db.get(EnvironmentalRequirement, requirement_id)
    if requirement is None:
        raise NotFoundError("Environmental requirement not found")
    return requirement


async def create_requirement(
    db: AsyncSession, payload: EnvironmentalRequirementCreate, created_by: uuid.UUID
) -> EnvironmentalRequirement:
    requirement = EnvironmentalRequirement(
        category=payload.category,
        name=payload.name,
        description=payload.description,
        parameter=payload.parameter,
        unit=payload.unit,
        warning_threshold=payload.warning_threshold,
        critical_threshold=payload.critical_threshold,
        regulatory_reference=payload.regulatory_reference,
        authority=payload.authority,
        frequency=payload.frequency,
        created_by=created_by,
    )
    db.add(requirement)
    await db.commit()
    await db.refresh(requirement)
    return requirement


async def update_requirement(
    db: AsyncSession, requirement_id: uuid.UUID, payload: EnvironmentalRequirementUpdate, updated_by: uuid.UUID
) -> EnvironmentalRequirement:
    requirement = await get_requirement(db, requirement_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(requirement, field, value)
    requirement.updated_by = updated_by

    await db.commit()
    await db.refresh(requirement)
    return requirement
