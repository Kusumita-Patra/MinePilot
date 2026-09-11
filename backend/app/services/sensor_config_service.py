import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import DuplicateError, NotFoundError
from app.models.enums import SensorConfigStatus, SensorType
from app.models.sensor import Sensor
from app.models.sensor_config import SensorConfig
from app.models.telemetry_reading import TelemetryReading
from app.schemas.sensor import (
    SensorConfigCreate,
    SensorConfigUpdate,
    SensorLocationUpdate,
)
from app.services.admin_service import OFFLINE_SENSOR_THRESHOLD_SECONDS

CALIBRATION_DUE_SOON_DAYS = 14


async def _latest_readings(db: AsyncSession, sensor_ids: list[str]) -> dict[str, dict]:
    """Latest TelemetryReading per sensor_id, for exactly the given ids —
    the same distinct-on-sensor_id join telemetry_service.get_latest_frames
    uses, scoped down instead of fetching every sensor's latest reading when
    only a handful are needed."""
    if not sensor_ids:
        return {}
    result = await db.execute(
        select(TelemetryReading)
        .where(TelemetryReading.sensor_id.in_(sensor_ids))
        .distinct(TelemetryReading.sensor_id)
        .order_by(TelemetryReading.sensor_id, TelemetryReading.recorded_at.desc())
    )
    readings = {}
    for reading in result.scalars().all():
        readings[reading.sensor_id] = {
            "ch4_pct": reading.ch4_pct,
            "co_ppm": reading.co_ppm,
            "displacement_mm": reading.displacement_mm,
            "temp_c": reading.temp_c,
            "dust_pm10": reading.dust_pm10,
            "risk_score": reading.risk_score,
            "risk_level": reading.risk_level.value,
            "timestamp": reading.recorded_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
    return readings


async def _last_seen_map(db: AsyncSession, sensor_ids: list[str]) -> dict[str, datetime]:
    if not sensor_ids:
        return {}
    result = await db.execute(select(Sensor.sensor_id, Sensor.last_seen_at).where(Sensor.sensor_id.in_(sensor_ids)))
    return {sensor_id: last_seen_at for sensor_id, last_seen_at in result.all()}


def _calibration_status(next_calibration_at: date | None) -> str | None:
    if next_calibration_at is None:
        return None
    today = datetime.now(timezone.utc).date()
    if next_calibration_at < today:
        return "OVERDUE"
    if next_calibration_at <= today + timedelta(days=CALIBRATION_DUE_SOON_DAYS):
        return "DUE_SOON"
    return "VALID"


def _is_reporting(last_seen_at: datetime | None) -> bool:
    if last_seen_at is None:
        return False
    age = datetime.now(timezone.utc) - last_seen_at
    return age.total_seconds() <= OFFLINE_SENSOR_THRESHOLD_SECONDS


async def _enrich(db: AsyncSession, configs: list[SensorConfig]) -> list[dict]:
    sensor_ids = [c.sensor_id for c in configs]
    readings = await _latest_readings(db, sensor_ids)
    last_seen = await _last_seen_map(db, sensor_ids)
    enriched = []
    for config in configs:
        enriched.append(
            {
                **{col.name: getattr(config, col.name) for col in config.__table__.columns},
                "is_reporting": _is_reporting(last_seen.get(config.sensor_id)),
                "current_reading": readings.get(config.sensor_id),
                "calibration_status": _calibration_status(config.next_calibration_at),
            }
        )
    return enriched


async def list_sensors(
    db: AsyncSession,
    *,
    sensor_type: SensorType | None = None,
    status: SensorConfigStatus | None = None,
    sector_id: str | None = None,
    level_label: str | None = None,
) -> list[dict]:
    query = select(SensorConfig)
    if sensor_type is not None:
        query = query.where(SensorConfig.sensor_type == sensor_type)
    if status is not None:
        query = query.where(SensorConfig.status == status)
    if sector_id is not None:
        query = query.where(SensorConfig.sector_id == sector_id)
    if level_label is not None:
        query = query.where(SensorConfig.level_label == level_label)
    query = query.order_by(SensorConfig.sensor_id)

    result = await db.execute(query)
    configs = list(result.scalars().all())
    return await _enrich(db, configs)


async def get_sensor_config(db: AsyncSession, sensor_id: str) -> SensorConfig:
    result = await db.execute(select(SensorConfig).where(SensorConfig.sensor_id == sensor_id))
    config = result.scalar_one_or_none()
    if config is None:
        raise NotFoundError("Sensor not found")
    return config


async def get_sensor(db: AsyncSession, sensor_id: str) -> dict:
    config = await get_sensor_config(db, sensor_id)
    enriched = await _enrich(db, [config])
    return enriched[0]


async def create_sensor(db: AsyncSession, payload: SensorConfigCreate, created_by: uuid.UUID) -> SensorConfig:
    existing = await db.execute(select(SensorConfig).where(SensorConfig.sensor_id == payload.sensor_id))
    if existing.scalar_one_or_none() is not None:
        raise DuplicateError(f"A sensor with id {payload.sensor_id!r} is already registered")

    config = SensorConfig(
        sensor_id=payload.sensor_id,
        display_name=payload.display_name,
        sensor_type=payload.sensor_type,
        manufacturer=payload.manufacturer,
        model=payload.model,
        blueprint_id=payload.blueprint_id,
        section_id=payload.section_id,
        sector_id=payload.sector_id,
        level_label=payload.level_label,
        depth=payload.depth,
        pixel_x=payload.pixel_x,
        pixel_y=payload.pixel_y,
        warning_threshold=payload.warning_threshold,
        critical_threshold=payload.critical_threshold,
        installation_date=payload.installation_date,
        last_calibration_at=payload.last_calibration_at,
        next_calibration_at=payload.next_calibration_at,
        created_by=created_by,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


async def update_sensor(db: AsyncSession, sensor_id: str, payload: SensorConfigUpdate) -> SensorConfig:
    config = await get_sensor_config(db, sensor_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    await db.commit()
    await db.refresh(config)
    return config


async def update_status(db: AsyncSession, sensor_id: str, new_status: SensorConfigStatus) -> SensorConfig:
    config = await get_sensor_config(db, sensor_id)
    config.status = new_status
    await db.commit()
    await db.refresh(config)
    return config


async def update_location(db: AsyncSession, sensor_id: str, payload: SensorLocationUpdate) -> tuple[SensorConfig, dict]:
    config = await get_sensor_config(db, sensor_id)
    previous_location = {
        "sector_id": config.sector_id,
        "level_label": config.level_label,
        "depth": config.depth,
        "pixel_x": config.pixel_x,
        "pixel_y": config.pixel_y,
    }
    config.section_id = payload.section_id
    config.sector_id = payload.sector_id
    config.level_label = payload.level_label
    config.depth = payload.depth
    config.pixel_x = payload.pixel_x
    config.pixel_y = payload.pixel_y
    await db.commit()
    await db.refresh(config)
    return config, previous_location


async def get_stats(db: AsyncSession) -> dict:
    result = await db.execute(select(SensorConfig))
    configs = list(result.scalars().all())
    total = len(configs)
    by_status = {s.value: 0 for s in SensorConfigStatus}
    for config in configs:
        by_status[config.status.value] += 1

    active_ids = [c.sensor_id for c in configs if c.status == SensorConfigStatus.ACTIVE]
    last_seen = await _last_seen_map(db, active_ids)
    offline_count = sum(1 for sensor_id in active_ids if not _is_reporting(last_seen.get(sensor_id)))

    return {"total": total, "by_status": by_status, "offline_count": offline_count}
