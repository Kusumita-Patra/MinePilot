import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_permission
from app.db.database import get_db
from app.models.enums import EnvironmentalCategory
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.environment import (
    EnvironmentalReadingCreate,
    EnvironmentalReadingResponse,
    EnvironmentalRequirementCreate,
    EnvironmentalRequirementResponse,
    EnvironmentalRequirementUpdate,
)
from app.services import audit_service, environmental_reading_service, environmental_requirement_service

router = APIRouter(prefix="/api/environment", tags=["environment"])


@router.get("/requirements")
async def list_requirements(
    category: EnvironmentalCategory | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.view")),
) -> dict:
    requirements = await environmental_requirement_service.list_requirements(db, category=category, is_active=is_active)
    data = [EnvironmentalRequirementResponse.model_validate(r).model_dump(mode="json") for r in requirements]
    return success_body(data)


@router.post("/requirements", status_code=status.HTTP_201_CREATED)
async def create_requirement(
    payload: EnvironmentalRequirementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.edit")),
) -> dict:
    requirement = await environmental_requirement_service.create_requirement(db, payload, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="environmental_requirement.create",
        resource_type="environmental_requirement",
        resource_id=str(requirement.id),
        description=f"Added environmental requirement '{requirement.name}' ({requirement.category.value})",
    )
    return success_body(
        EnvironmentalRequirementResponse.model_validate(requirement).model_dump(mode="json"),
        message="Environmental requirement created successfully",
    )


@router.patch("/requirements/{requirement_id}")
async def update_requirement(
    requirement_id: uuid.UUID,
    payload: EnvironmentalRequirementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("governance.edit")),
) -> dict:
    requirement = await environmental_requirement_service.update_requirement(
        db, requirement_id, payload, current_user.id
    )
    await audit_service.record(
        db,
        actor=current_user,
        action="environmental_requirement.update",
        resource_type="environmental_requirement",
        resource_id=str(requirement.id),
        description=f"Updated environmental requirement '{requirement.name}'",
    )
    return success_body(
        EnvironmentalRequirementResponse.model_validate(requirement).model_dump(mode="json"),
        message="Environmental requirement updated successfully",
    )


@router.get("/readings")
async def list_readings(
    sensor_config_id: uuid.UUID | None = None,
    parameter: str | None = None,
    since: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    readings = await environmental_reading_service.list_readings(
        db, sensor_config_id=sensor_config_id, parameter=parameter, since=since, limit=limit
    )
    data = [EnvironmentalReadingResponse(**r).model_dump(mode="json") for r in readings]
    return success_body(data)


@router.post("/readings", status_code=status.HTTP_201_CREATED)
async def create_reading(
    payload: EnvironmentalReadingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    # Open to every authenticated role, not manager/admin-only: there is no
    # hardware ingestion path, so this endpoint is the only way any
    # environmental data enters the system — including a field worker's
    # on-site manual reading. The schema only ever accepts SIMULATED_SENSOR /
    # MANUAL_ENTRY (never REAL_SENSOR), and every POST is audited.
    reading = await environmental_reading_service.create_reading(db, payload)
    await audit_service.record(
        db,
        actor=current_user,
        action="environmental_reading.create",
        resource_type="environmental_reading",
        resource_id=str(reading.id),
        description=f"Recorded {reading.parameter}={reading.value}{reading.unit} ({reading.data_source.value})",
    )
    return success_body(
        EnvironmentalReadingResponse.model_validate(reading).model_dump(mode="json"),
        message="Environmental reading recorded successfully",
    )
