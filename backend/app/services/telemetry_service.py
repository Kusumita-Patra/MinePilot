import asyncio
import json
import logging
from datetime import datetime, timezone

import websockets
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import AsyncSessionLocal
from app.models.alert_rule import AlertRule
from app.models.enums import HazardType, RiskLevel
from app.models.sensor import Sensor
from app.models.sensor_config import SensorConfig
from app.models.telemetry_reading import TelemetryReading
from app.services import emergency_event_service, emergency_rule_service, governance_risk_service, incident_service

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

# Updated every time a frame arrives from T2's upstream simulator; read by
# admin_service.get_system_health() as the telemetry-ingestion liveness signal.
# Deliberately not threaded into the ingestion/persistence logic itself.
_last_frame_at: datetime | None = None


def get_ingestion_status() -> dict:
    if _last_frame_at is None:
        return {"status": "unavailable", "detail": "No telemetry frame received since startup"}
    age_seconds = (datetime.now(timezone.utc) - _last_frame_at).total_seconds()
    if age_seconds <= 15:
        return {"status": "healthy", "detail": f"Last frame {age_seconds:.0f}s ago"}
    if age_seconds <= 60:
        return {"status": "degraded", "detail": f"Last frame {age_seconds:.0f}s ago"}
    return {"status": "unavailable", "detail": f"Last frame {age_seconds:.0f}s ago"}


def _to_contract_frame(raw: dict) -> dict:
    return {field: raw[field] for field in CONTRACT_FIELDS if field in raw}


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _format_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


# Governance thresholds (AlertRule/SensorConfig) are evaluated against every
# single frame, but the frame-read loop below is deliberately DB-free (see
# its own comment on why broadcast happens before persistence) — so this
# cache is refreshed on a timer instead of once per frame. A NullPool session
# open (~1s, see _BATCH_MAX's comment) amortized over a whole TTL window
# rather than paid per frame is the same trade-off already made elsewhere in
# this file; a stale-by-at-most-TTL admin edit is an acceptable cost for it.
_GOVERNANCE_CACHE_TTL_SECONDS = 15
_governance_cache: tuple[dict[str, AlertRule], dict[str, SensorConfig]] = ({}, {})
_governance_cache_at: datetime | None = None
_governance_cache_lock = asyncio.Lock()


async def _get_governance_snapshot() -> tuple[dict[str, AlertRule], dict[str, SensorConfig]]:
    global _governance_cache, _governance_cache_at
    now = datetime.now(timezone.utc)
    if _governance_cache_at is not None and (now - _governance_cache_at).total_seconds() < _GOVERNANCE_CACHE_TTL_SECONDS:
        return _governance_cache
    async with _governance_cache_lock:
        now = datetime.now(timezone.utc)
        if _governance_cache_at is not None and (now - _governance_cache_at).total_seconds() < _GOVERNANCE_CACHE_TTL_SECONDS:
            return _governance_cache
        try:
            async with AsyncSessionLocal() as db:
                alert_rules = await governance_risk_service.load_alert_rules(db)
                sensor_configs = await governance_risk_service.load_sensor_configs(db)
            _governance_cache = (alert_rules, sensor_configs)
            _governance_cache_at = now
        except Exception:
            logger.exception("Failed to refresh governance threshold cache; keeping the previous snapshot")
    return _governance_cache


async def _apply_governance(raw: dict) -> None:
    """Mutates `raw`'s risk_score/risk_level in place if an admin-configured
    threshold is breached and more severe than T2's own assessment. Runs
    before both broadcast and persistence so the live 3D twin, the stored
    reading, and any triggered incident all agree on the escalated level."""
    alert_rules, sensor_configs = await _get_governance_snapshot()
    governance_level = governance_risk_service.evaluate(raw, alert_rules, sensor_configs)
    risk_score, risk_level = governance_risk_service.apply_escalation(
        int(raw["risk_score"]), RiskLevel(raw["risk_level"]), governance_level
    )
    raw["risk_score"] = risk_score
    raw["risk_level"] = risk_level.value


async def _process_frame(db: AsyncSession, raw: dict) -> None:
    """Persists a frame whose risk_score/risk_level have already been through
    governance escalation (see `_apply_governance` in the ingestion loop below)
    — by the time a frame reaches this queue, those fields are final."""
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

    # Emergency detection is keyed on the raw telemetry field for a hazard
    # type (ch4_pct for METHANE), never on risk_level/risk_score — those are
    # blended signals that don't identify a specific hazard, and this must
    # never read or mutate T2's risk engine output. See
    # emergency_event_service.detect_and_create.
    rule = await emergency_rule_service.get_active_rule(db, HazardType.METHANE)
    ch4 = telemetry.get("ch4_pct")
    if rule is not None and ch4 is not None and rule.critical_threshold is not None and ch4 >= rule.critical_threshold:
        await emergency_event_service.detect_and_create(db, HazardType.METHANE, sector_id, sensor_id, ch4, rule)


# Every NullPool session pays a full fresh-connection round trip to Supabase
# (~1s observed here) before it can run a single query — versus ~0.1s for a
# query on an already-open connection. At typical telemetry arrival rates
# (faster than 1 frame/s across sensors), paying that ~1s *per frame* means
# persistence can never keep up with real time, so the backlog — and the
# visible lag between "now" and the latest stored reading — only grows.
# Batching many queued frames onto one reused connection amortizes that
# fixed cost across the whole batch instead of paying it every frame.
_BATCH_MAX = 50


async def _persist_frames(queue: "asyncio.Queue[dict]") -> None:
    """Drains the frame queue and persists it in batches, each batch sharing
    one DB connection, decoupled from the upstream WebSocket read loop below.
    Reading every frame promptly off the socket matters regardless of how
    fast persistence is — T2's own send-side queue is bounded and drops
    frames outright once its client falls behind — so this stays a separate
    task from the reader even though it can now keep up with it."""
    while True:
        batch = [await queue.get()]
        while len(batch) < _BATCH_MAX:
            try:
                batch.append(queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        try:
            async with AsyncSessionLocal() as db:
                for raw in batch:
                    try:
                        await _process_frame(db, raw)
                    except Exception:
                        logger.exception("Failed to persist a queued telemetry frame")
                        # A failed frame can leave the shared session's
                        # transaction aborted; roll back so the rest of this
                        # batch doesn't fail too.
                        await db.rollback()
        except Exception:
            logger.exception("Failed to open a DB session for a batch of queued telemetry frames")


async def run_ingestion_loop(stop_event: asyncio.Event) -> None:
    """Background task: connects to T2's simulated /ws/telemetry as a client,
    persists every frame, triggers incidents, and re-broadcasts to the
    frontend-facing WebSocket. Retries with exponential backoff on disconnect."""
    # Bounded but generous: a DB hiccup of even a minute or two at typical
    # frame rates fits comfortably, so the reader below never has to wait on
    # persistence to keep consuming the socket.
    queue: "asyncio.Queue[dict]" = asyncio.Queue(maxsize=5000)
    writer_task = asyncio.create_task(_persist_frames(queue))
    try:
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
                        except Exception:
                            logger.exception("Failed to parse an upstream telemetry frame")
                            continue
                        await _apply_governance(raw)
                        # Broadcast immediately (in-memory, effectively free) so
                        # live viewers aren't held up by a DB round-trip either;
                        # persistence/incident-triggering happens off-queue.
                        await broadcast_manager.broadcast(_to_contract_frame(raw))
                        await queue.put(raw)
                        global _last_frame_at
                        _last_frame_at = datetime.now(timezone.utc)
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
    finally:
        writer_task.cancel()
        try:
            await writer_task
        except asyncio.CancelledError:
            pass


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
