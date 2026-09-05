from datetime import date

from sqlalchemy import extract, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import NotFoundError
from app.models.enums import InspectionStatus
from app.models.inspection import Inspection
from app.schemas.inspection import InspectionCreate, InspectionUpdate


async def list_inspections(
    db: AsyncSession, status: InspectionStatus | None = None, month: date | None = None
) -> list[Inspection]:
    query = select(Inspection)
    if status is not None:
        query = query.where(Inspection.status == status)
    if month is not None:
        query = query.where(
            extract("year", Inspection.scheduled_date) == month.year,
            extract("month", Inspection.scheduled_date) == month.month,
        )
    query = query.order_by(Inspection.scheduled_date.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_inspection(db: AsyncSession, inspection_id) -> Inspection:
    inspection = await db.get(Inspection, inspection_id)
    if inspection is None:
        raise NotFoundError("Inspection not found")
    return inspection


async def create_inspection(db: AsyncSession, payload: InspectionCreate) -> Inspection:
    inspection = Inspection(
        sector_id=payload.sector_id,
        scheduled_date=payload.scheduled_date,
        notes=payload.notes,
    )
    db.add(inspection)
    await db.commit()
    await db.refresh(inspection)
    return inspection


async def update_inspection(db: AsyncSession, inspection_id, payload: InspectionUpdate) -> Inspection:
    inspection = await get_inspection(db, inspection_id)

    if payload.status is not None:
        inspection.status = payload.status
    if payload.notes is not None:
        inspection.notes = payload.notes
    if payload.completed_at is not None:
        inspection.completed_at = payload.completed_at

    await db.commit()
    await db.refresh(inspection)
    return inspection
