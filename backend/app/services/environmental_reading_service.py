import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import AppException, NotFoundError
from app.models.enums import DataSourceType, SensorConfigStatus
from app.models.environmental_reading import EnvironmentalReading
from app.models.sensor_config import SensorConfig
from app.schemas.environment import EnvironmentalReadingCreate


async def _get_active_sensor_config(db: AsyncSession, sensor_config_id: uuid.UUID) -> SensorConfig:
    config = await db.get(SensorConfig, sensor_config_id)
    if config is None:
        raise NotFoundError("Sensor config not found")
    if config.status != SensorConfigStatus.ACTIVE:
        raise AppException(f"Sensor {config.sensor_id} is not ACTIVE (status: {config.status.value})", status_code=409)
    return config


async def create_reading(db: AsyncSession, payload: EnvironmentalReadingCreate) -> EnvironmentalReading:
    config = await _get_active_sensor_config(db, payload.sensor_config_id)

    reading = EnvironmentalReading(
        sensor_config_id=config.id,
        parameter=payload.parameter,
        value=payload.value,
        unit=payload.unit,
        data_source=DataSourceType(payload.data_source),
        recorded_at=payload.recorded_at or datetime.now(timezone.utc),
    )
    db.add(reading)
    await db.commit()
    await db.refresh(reading)
    return reading


async def list_readings(
    db: AsyncSession,
    *,
    sensor_config_id: uuid.UUID | None = None,
    parameter: str | None = None,
    since: datetime | None = None,
    limit: int = 100,
) -> list[dict]:
    query = select(EnvironmentalReading, SensorConfig.display_name).join(
        SensorConfig, EnvironmentalReading.sensor_config_id == SensorConfig.id
    )
    if sensor_config_id is not None:
        query = query.where(EnvironmentalReading.sensor_config_id == sensor_config_id)
    if parameter is not None:
        query = query.where(EnvironmentalReading.parameter == parameter)
    if since is not None:
        query = query.where(EnvironmentalReading.recorded_at >= since)
    query = query.order_by(EnvironmentalReading.recorded_at.desc()).limit(limit)

    result = await db.execute(query)
    readings = []
    for reading, display_name in result.all():
        readings.append(
            {
                **{col.name: getattr(reading, col.name) for col in reading.__table__.columns},
                "sensor_display_name": display_name,
            }
        )
    return readings


async def get_latest_by_parameter(db: AsyncSession, parameter: str) -> EnvironmentalReading | None:
    result = await db.execute(
        select(EnvironmentalReading)
        .where(EnvironmentalReading.parameter == parameter)
        .order_by(EnvironmentalReading.recorded_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
