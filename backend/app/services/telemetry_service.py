import asyncio
import json
import logging
from datetime import datetime, timezone

import websockets
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.enums import RiskLevel
from app.models.sensor import Sensor
from app.models.telemetry_reading import TelemetryReading
from app.services import incident_service

logger = logging.getLogger("minepilot.backend.telemetry")
settings = get_settings()

# The exact fields of the frozen shared/types/telemetry.ts SensorFrame contract.
# T2's upstream stream also sends anomaly_factors; it is intentionally dropped
# here so the frontend never sees anything beyond the frozen shape.
CONTRACT_FIELDS = ("sensor_id", "sector_id", "coordinates", "telemetry", "risk_score", "risk_level", "timestamp")


class BroadcastManager:
    """In-process pub/sub for downstream frontend WebSocket clients. A simple
    per-connection queue is sufficient for a single-instance deployment."""

    def __init__(self) -> None:
        self._queues: set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._queues.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._queues.discard(queue)

    async def broadcast(self, message: dict) -> None:
        for queue in list(self._queues):
            try:
                queue.put_nowait(message)
            except asyncio.QueueFull:
                logger.warning("Dropping a telemetry frame for a slow WebSocket client")


broadcast_manager = BroadcastManager()


def _to_contract_frame(raw: dict) -> dict:
    return {field: raw[field] for field in CONTRACT_FIELDS if field in raw}


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _format_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


async def _process_frame(db: AsyncSession, raw: dict) -> None:
    sensor_id = raw["sensor_id"]
    sector_id = raw["sector_id"]
    telemetry = raw["telemetry"]
    risk_score = int(raw["risk_score"])
    risk_level = RiskLevel(raw["risk_level"])
    recorded_at = _parse_timestamp(raw["timestamp"])

    sensor = await db.get(Sensor, sensor_id)
    if sensor is None:
        sensor = Sensor(
            sensor_id=sensor_id,
            sector_id=sector_id,
            last_coordinates=raw["coordinates"],
            last_risk_score=risk_score,
            last_risk_level=risk_level,
            last_seen_at=recorded_at,
        )
        db.add(sensor)
    else:
        sensor.sector_id = sector_id
        sensor.last_coordinates = raw["coordinates"]
        sensor.last_risk_score = risk_score
        sensor.last_risk_level = risk_level
        sensor.last_seen_at = recorded_at

    db.add(
        TelemetryReading(
            sensor_id=sensor_id,
            sector_id=sector_id,
            ch4_pct=telemetry["ch4_pct"],
            co_ppm=telemetry["co_ppm"],
            dust_pm10=telemetry["dust_pm10"],
            displacement_mm=telemetry["displacement_mm"],
            temp_c=telemetry["temp_c"],
            risk_score=risk_score,
            risk_level=risk_level,
            recorded_at=recorded_at,
        )
    )

    await db.commit()

    if risk_level != RiskLevel.NORMAL:
        await incident_service.trigger_incident(db, sensor_id, sector_id, risk_score, risk_level)

    await broadcast_manager.broadcast(_to_contract_frame(raw))


async def run_ingestion_loop(stop_event: asyncio.Event) -> None:
    """Background task: connects to T2's simulated /ws/telemetry as a client,
    persists every frame, triggers incidents, and re-broadcasts to the
    frontend-facing WebSocket. Retries with exponential backoff on disconnect."""
    backoff = 1
    while not stop_event.is_set():
        try:
            # T2's simulator loop doesn't reliably answer WebSocket pings on
            # time (it's busy generating/broadcasting frames), which trips
            # this client's default 20s ping_timeout and drops an otherwise
            # healthy connection every ~1s. We don't control that server, so
            # disable our own ping-based liveness check here — the constant
            # stream of frames is itself sufficient liveness signal, and a
            # truly dead TCP connection still surfaces as a read error below.
            async with websockets.connect(settings.ml_service_ws_url, ping_interval=None) as upstream:
                logger.info("Connected to upstream telemetry simulator at %s", settings.ml_service_ws_url)
                backoff = 1
                async for message in upstream:
                    if stop_event.is_set():
                        break
                    try:
                        raw = json.loads(message)
                        async with AsyncSessionLocal() as db:
                            await _process_frame(db, raw)
                    except Exception:
                        logger.exception("Failed to process an upstream telemetry frame")
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if stop_event.is_set():
                break
            logger.warning(
                "Upstream telemetry connection lost (%s); retrying in %ss", exc, backoff
            )
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)


async def get_latest_frames(db: AsyncSession, sector_id: str | None = None) -> list[dict]:
    query = (
        select(TelemetryReading, Sensor.last_coordinates)
        .join(Sensor, Sensor.sensor_id == TelemetryReading.sensor_id)
        .distinct(TelemetryReading.sensor_id)
    )
    if sector_id is not None:
        query = query.where(TelemetryReading.sector_id == sector_id)
    query = query.order_by(TelemetryReading.sensor_id, TelemetryReading.recorded_at.desc())

    result = await db.execute(query)
    return [_reading_to_frame(reading, coordinates) for reading, coordinates in result.all()]


async def get_history(
    db: AsyncSession,
    sensor_id: str | None = None,
    sector_id: str | None = None,
    from_: datetime | None = None,
    to: datetime | None = None,
    limit: int = 200,
) -> list[dict]:
    filters = []
    if sensor_id is not None:
        filters.append(TelemetryReading.sensor_id == sensor_id)
    if sector_id is not None:
        filters.append(TelemetryReading.sector_id == sector_id)
    if from_ is not None:
        filters.append(TelemetryReading.recorded_at >= from_)
    if to is not None:
        filters.append(TelemetryReading.recorded_at <= to)

    base_query = select(TelemetryReading, Sensor.last_coordinates).join(
        Sensor, Sensor.sensor_id == TelemetryReading.sensor_id
    )
    if filters:
        base_query = base_query.where(and_(*filters))

    count_query = select(func.count()).select_from(TelemetryReading)
    if filters:
        count_query = count_query.where(and_(*filters))
    total = (await db.execute(count_query)).scalar_one()

    if total <= limit:
        query = base_query.order_by(TelemetryReading.recorded_at.desc()).limit(limit)
        result = await db.execute(query)
        return [_reading_to_frame(reading, coordinates) for reading, coordinates in result.all()]

    # More rows exist in [from, to] than `limit` can hold. Rather than just
    # returning the newest `limit` rows — which silently drops everything
    # before them and stops the chart short of the requested start — spread
    # `limit` evenly-spaced buckets across the whole window and keep the
    # latest reading in each bucket, so the chart always spans the full
    # selected range.
    bucketed = base_query.add_columns(
        func.ntile(limit).over(order_by=TelemetryReading.recorded_at).label("bucket")
    ).subquery()
    sampled = (
        select(bucketed)
        .distinct(bucketed.c.bucket)
        .order_by(bucketed.c.bucket, bucketed.c.recorded_at.desc())
    ).subquery()

    query = select(sampled).order_by(sampled.c.recorded_at.desc())
    result = await db.execute(query)
    return [_row_to_frame(row) for row in result.all()]


def _row_to_frame(row) -> dict:
    return {
        "sensor_id": row.sensor_id,
        "sector_id": row.sector_id,
        "coordinates": row.last_coordinates,
        "telemetry": {
            "ch4_pct": row.ch4_pct,
            "co_ppm": row.co_ppm,
            "displacement_mm": row.displacement_mm,
            "temp_c": row.temp_c,
            "dust_pm10": row.dust_pm10,
        },
        "risk_score": row.risk_score,
        "risk_level": row.risk_level.value,
        "timestamp": _format_timestamp(row.recorded_at),
    }


def _reading_to_frame(reading: TelemetryReading, coordinates: dict) -> dict:
    return {
        "sensor_id": reading.sensor_id,
        "sector_id": reading.sector_id,
        "coordinates": coordinates,
        "telemetry": {
            "ch4_pct": reading.ch4_pct,
            "co_ppm": reading.co_ppm,
            "displacement_mm": reading.displacement_mm,
            "temp_c": reading.temp_c,
            "dust_pm10": reading.dust_pm10,
        },
        "risk_score": reading.risk_score,
        "risk_level": reading.risk_level.value,
        "timestamp": _format_timestamp(reading.recorded_at),
    }
