import uuid
from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_permission
from app.db.database import get_db
from app.models.enums import InspectionStatus
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.inspection import InspectionCreate, InspectionResponse, InspectionUpdate
from app.services import inspection_service

router = APIRouter(prefix="/api/inspections", tags=["inspections"])


@router.get("")
async def list_inspections(
    status: InspectionStatus | None = None,
    month: date | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    inspections = await inspection_service.list_inspections(db, status, month)
    data = [InspectionResponse.model_validate(i).model_dump(mode="json") for i in inspections]
    return success_body(data)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_inspection(
    payload: InspectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("inspections.schedule")),
) -> dict:
    inspection = await inspection_service.create_inspection(db, payload)
    return success_body(
        InspectionResponse.model_validate(inspection).model_dump(mode="json"),
        message="Inspection scheduled successfully",
    )


@router.patch("/{inspection_id}")
async def update_inspection(
    inspection_id: uuid.UUID,
    payload: InspectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    inspection = await inspection_service.update_inspection(db, inspection_id, payload)
    return success_body(
        InspectionResponse.model_validate(inspection).model_dump(mode="json"),
        message="Inspection updated successfully",
    )
