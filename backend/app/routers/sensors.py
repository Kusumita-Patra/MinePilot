from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.db.database import get_db
from app.models.enums import SensorConfigStatus, SensorType, UserRole
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.sensor import (
    SensorConfigCreate,
    SensorConfigResponse,
    SensorConfigUpdate,
    SensorLocationUpdate,
    SensorStatsResponse,
    SensorStatusUpdate,
)
from app.services import admin_service, audit_service, sensor_config_service

router = APIRouter(prefix="/api/sensors", tags=["sensors"])


@router.get("")
async def list_sensors(
    sensor_type: SensorType | None = None,
    status_filter: SensorConfigStatus | None = Query(default=None, alias="status"),
    sector_id: str | None = None,
    level_label: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    sensors = await sensor_config_service.list_sensors(
        db, sensor_type=sensor_type, status=status_filter, sector_id=sector_id, level_label=level_label
    )
    data = [SensorConfigResponse(**s).model_dump(mode="json") for s in sensors]
    return success_body(data)


@router.get("/stats")
async def get_sensor_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    stats = await sensor_config_service.get_stats(db)
    return success_body(SensorStatsResponse(**stats).model_dump(mode="json"))


@router.get("/{sensor_id}")
async def get_sensor(
    sensor_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    sensor = await sensor_config_service.get_sensor(db, sensor_id)
    return success_body(SensorConfigResponse(**sensor).model_dump(mode="json"))


@router.get("/{sensor_id}/history")
async def get_sensor_history(
    sensor_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    logs = await admin_service.list_audit_logs_for_resource(db, resource_type="sensor", resource_id=sensor_id, limit=limit)
    return success_body(logs)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_sensor(
    payload: SensorConfigCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    config = await sensor_config_service.create_sensor(db, payload, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="sensor.register",
        resource_type="sensor",
        resource_id=config.sensor_id,
        description=f"Registered sensor {config.sensor_id} ({config.sensor_type.value}) at {config.level_label}/{config.sector_id}",
    )
    enriched = await sensor_config_service.get_sensor(db, config.sensor_id)
    return success_body(
        SensorConfigResponse(**enriched).model_dump(mode="json"),
        message="Sensor registered successfully",
    )


@router.patch("/{sensor_id}")
async def update_sensor(
    sensor_id: str,
    payload: SensorConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    config = await sensor_config_service.update_sensor(db, sensor_id, payload)
    await audit_service.record(
        db,
        actor=current_user,
        action="sensor.update",
        resource_type="sensor",
        resource_id=config.sensor_id,
        description=f"Updated configuration for sensor {config.sensor_id}",
        metadata={"changed_fields": list(payload.model_dump(exclude_unset=True).keys())},
    )
    enriched = await sensor_config_service.get_sensor(db, sensor_id)
    return success_body(
        SensorConfigResponse(**enriched).model_dump(mode="json"),
        message="Sensor updated successfully",
    )


@router.patch("/{sensor_id}/status")
async def update_sensor_status(
    sensor_id: str,
    payload: SensorStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    config = await sensor_config_service.update_status(db, sensor_id, payload.status)
    verb = {
        SensorConfigStatus.ACTIVE: "Reactivated",
        SensorConfigStatus.INACTIVE: "Deactivated",
        SensorConfigStatus.MAINTENANCE: "Placed into maintenance",
        SensorConfigStatus.RETIRED: "Retired",
    }[config.status]
    await audit_service.record(
        db,
        actor=current_user,
        action="sensor.status_change",
        resource_type="sensor",
        resource_id=config.sensor_id,
        description=f"{verb} sensor {config.sensor_id}",
    )
    enriched = await sensor_config_service.get_sensor(db, sensor_id)
    return success_body(
        SensorConfigResponse(**enriched).model_dump(mode="json"),
        message="Sensor status updated successfully",
    )


@router.patch("/{sensor_id}/location")
async def update_sensor_location(
    sensor_id: str,
    payload: SensorLocationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.administrator)),
) -> dict:
    config, previous_location = await sensor_config_service.update_location(db, sensor_id, payload)
    await audit_service.record(
        db,
        actor=current_user,
        action="sensor.move",
        resource_type="sensor",
        resource_id=config.sensor_id,
        description=(
            f"Moved sensor {config.sensor_id} from {previous_location['level_label']}/"
            f"{previous_location['sector_id']} to {config.level_label}/{config.sector_id}"
        ),
        metadata={"previous_location": previous_location},
    )
    enriched = await sensor_config_service.get_sensor(db, sensor_id)
    return success_body(
        SensorConfigResponse(**enriched).model_dump(mode="json"),
        message="Sensor location updated successfully",
    )
