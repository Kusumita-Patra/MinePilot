import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.compliance_requirement import ComplianceRequirement
from app.schemas.admin import ComplianceRequirementCreate, ComplianceRequirementUpdate


async def list_requirements(db: AsyncSession) -> list[ComplianceRequirement]:
    result = await db.execute(
        select(ComplianceRequirement).order_by(ComplianceRequirement.applies_to, ComplianceRequirement.document_type)
    )
    return list(result.scalars().all())


async def create_requirement(db: AsyncSession, payload: ComplianceRequirementCreate) -> ComplianceRequirement:
    requirement = ComplianceRequirement(
        applies_to=payload.applies_to,
        document_type=payload.document_type,
        warning_threshold_days=payload.warning_threshold_days,
        critical_threshold_days=payload.critical_threshold_days,
    )
    db.add(requirement)
    await db.commit()
    await db.refresh(requirement)
    return requirement


async def update_requirement(
    db: AsyncSession, requirement_id: uuid.UUID, payload: ComplianceRequirementUpdate
) -> ComplianceRequirement:
    requirement = await db.get(ComplianceRequirement, requirement_id)
    if requirement is None:
        raise NotFoundError("Compliance requirement not found")

    if payload.document_type is not None:
        requirement.document_type = payload.document_type
    if payload.warning_threshold_days is not None:
        requirement.warning_threshold_days = payload.warning_threshold_days
    if payload.critical_threshold_days is not None:
        requirement.critical_threshold_days = payload.critical_threshold_days
    if payload.is_active is not None:
        requirement.is_active = payload.is_active

    await db.commit()
    await db.refresh(requirement)
    return requirement
