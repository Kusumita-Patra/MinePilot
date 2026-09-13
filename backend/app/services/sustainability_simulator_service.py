"""Automatic/simulated environmental data pipeline for the P3 Sustainability
milestone (Energy/Waste/Land). Structural template is
emergency_escalation_service.py verbatim (same stop_event/tick shape).

This module NEVER touches T2's inference_api.py/risk_scoring.py/
data_generator.py, the SensorFrame WebSocket contract, or the safety
emergency system — it only ever writes to EnergyMetric/WasteMetric/
LandMetric (via the service layer directly, never HTTP-to-itself) and, for
the ENVIRONMENTAL_ANOMALY scenario, EnvironmentalReading for a PM10/PM2.5/
SO2/NOx SensorConfig — auto-creating one (blueprint_id/created_by left
None) if an admin hasn't already registered a matching sensor, so this
scenario always produces a visible result on a fresh demo DB.

Runtime scenario/running state is in-memory only (module-level dict, reset
on process restart) — this is control-plane state, not sustainability DATA,
matching emergency_broadcast_service.BroadcastManager's precedent. The
persisted metric rows are what matter for demo continuity across a restart.
"""

import asyncio
import logging
import math
import random
from datetime import date, datetime, timedelta, timezone

from app.core.config import get_settings
from app.db.database import AsyncSessionLocal
from sqlalchemy.exc import IntegrityError

from app.exceptions.custom_exceptions import DuplicateError
from app.models.enums import CorrectiveActionPriority, CorrectiveActionSourceType
from app.schemas.energy import EnergyMetricCreate
from app.schemas.land import LandMetricCreate
from app.schemas.sustainability import SimulatorScenario
from app.schemas.waste import WasteMetricCreate
from app.services import (
    corrective_action_service,
    energy_metric_service,
    land_metric_service,
    sustainability_target_service,
    waste_metric_service,
)

logger = logging.getLogger("minepilot.backend.sustainability_simulator")

# Matches SectorId in schemas/blueprint.py (the taxonomy WaterMetricCreate
# etc. already validate sector_id against) — reusing the existing sector
# list rather than inventing a second one, per spec §6.
SECTORS: list[str] = [
    "sector_north_wall",
    "sector_deep_shaft_b",
    "sector_surface_conveyor",
    "sector_main_pit",
]

_BACKFILL_DAYS = 14

_VALID_SCENARIOS: set[str] = {
    "NORMAL_OPERATION",
    "HIGH_ENERGY_CONSUMPTION",
    "HIGH_WASTE_GENERATION",
    "LOW_WASTE_DIVERSION",
    "LAND_RECLAMATION_PROGRESS",
    "LAND_DISTURBANCE_INCREASE",
    "ENVIRONMENTAL_ANOMALY",
}

_state: dict = {
    "running": False,
    "scenario": "NORMAL_OPERATION",
    "last_tick_at": None,
}

# Per-sector running trend state — in-memory only, deliberately reset on
# restart (the persisted rows in Postgres are what matter for continuity,
# not this pointer). Holds the last generated raw values so each tick nudges
# forward rather than independently re-rolling from scratch.
_sector_state: dict[str, dict] = {}


def get_status() -> dict:
    settings = get_settings()
    return {
        "enabled": settings.sustainability_simulator_enabled,
        "running": _state["running"],
        "scenario": _state["scenario"],
        "interval_seconds": settings.sustainability_simulator_interval_seconds,
        "last_tick_at": _state["last_tick_at"],
    }


def set_running(running: bool) -> None:
    _state["running"] = running


def set_scenario(scenario: SimulatorScenario) -> None:
    if scenario not in _VALID_SCENARIOS:
        raise ValueError(f"Unknown scenario: {scenario}")
    _state["scenario"] = scenario


# ---------------------------------------------------------------------------
# Pure generation functions — unit-tested directly (no DB/session needed).
# Each takes the previous tick's raw values (or None on first generation)
# and the current scenario name, and returns a plausible next value: a small
# bounded drift around the previous value (never an independent re-roll),
# an occasional spike, and a scenario-specific bias. Every invariant the
# schema/DB CheckConstraints enforce is also enforced here directly, so a
# real data problem is caught here (in a fast, deterministic unit test)
# rather than surfacing only as a 500 from the DB.
# ---------------------------------------------------------------------------


def next_energy_values(prev: dict | None, scenario: str) -> dict:
    base_electricity = prev["electricity_kwh"] if prev else random.uniform(9000, 11000)
    base_production = prev["production_tonnes"] if prev else random.uniform(4500, 5500)

    production = max(0.0, base_production + random.uniform(-100, 100))

    drift = random.uniform(-150, 150)
    if scenario == "HIGH_ENERGY_CONSUMPTION":
        drift += random.uniform(800, 1500)
    electricity = max(0.0, base_electricity + drift)
    if random.random() < 0.05:  # occasional spike
        electricity *= random.uniform(1.15, 1.3)
    elif random.random() < 0.05:  # occasional recovery back toward baseline
        electricity *= random.uniform(0.85, 0.95)

    # `is not None` (not truthiness) — a legitimately zero previous
    # renewable/fuel reading must continue from 0, not be treated the same
    # as "no previous value" and reset to a fresh baseline every tick.
    prev_renewable = prev.get("renewable_energy_kwh") if prev else None
    base_renewable = prev_renewable if prev_renewable is not None else electricity * 0.15
    renewable = max(0.0, base_renewable + random.uniform(-50, 50))
    if scenario == "HIGH_ENERGY_CONSUMPTION":
        renewable = max(0.0, renewable - random.uniform(50, 150))
    renewable = min(renewable, electricity)  # can never exceed total consumption

    peak_demand = max(0.0, electricity / 20 + random.uniform(-5, 5))
    prev_fuel = prev.get("fuel_litres") if prev else None
    fuel = max(0.0, (prev_fuel if prev_fuel is not None else 500) + random.uniform(-30, 30))

    return {
        "electricity_kwh": round(electricity, 1),
        "fuel_litres": round(fuel, 1),
        "renewable_energy_kwh": round(renewable, 1),
        "peak_demand_kw": round(peak_demand, 1),
        "production_tonnes": round(production, 1),
    }


def next_waste_values(prev: dict | None, scenario: str, production_tonnes: float) -> dict:
    base_total = prev["total_waste_tonnes"] if prev else production_tonnes * random.uniform(0.08, 0.12)
    drift = random.uniform(-5, 5)
    if scenario == "HIGH_WASTE_GENERATION":
        drift += random.uniform(30, 60)
    total = max(1.0, base_total + drift)
    if random.random() < 0.05:
        total *= random.uniform(1.1, 1.25)
    total = round(total, 1)

    diversion_pct = prev["_diversion_pct"] if prev and "_diversion_pct" in prev else 0.55
    diversion_pct += random.uniform(-0.02, 0.02)
    if scenario == "LOW_WASTE_DIVERSION":
        diversion_pct -= random.uniform(0.1, 0.2)
    diversion_pct = min(0.85, max(0.05, diversion_pct))

    diverted = total * diversion_pct
    recycled = round(diverted * 0.6, 1)
    reused = round(diverted * 0.4, 1)
    # disposed absorbs the remainder, FLOORED (never round()) to 1 decimal
    # with a small extra safety margin (0.05) subtracted first. A plain
    # round() here can itself round disposed UP by up to 0.05 — exactly
    # cancelling the margin and reproducing the same failure it was meant to
    # prevent (caught live twice while building this: once as a real
    # Postgres CheckViolationError on ck_waste_metrics_accounting, once as a
    # unit test failure with accounted == 605.4000000000001 > total ==
    # 605.4). floor() only ever rounds down, so
    # recycled+reused+disposed <= total - 0.05 always holds, comfortably
    # inside any IEEE754 cross-system representation noise.
    disposed = math.floor(max(0.0, total - recycled - reused - 0.05) * 10) / 10

    hazardous = round(total * random.uniform(0.02, 0.05), 2)

    return {
        "total_waste_tonnes": total,
        "recycled_waste_tonnes": recycled,
        "reused_waste_tonnes": reused,
        "disposed_waste_tonnes": disposed,
        "hazardous_waste_tonnes": hazardous,
        "production_tonnes": round(production_tonnes, 1),
        "_diversion_pct": diversion_pct,  # internal only — stripped before DB write
    }


def next_land_values(prev: dict | None, scenario: str) -> dict:
    disturbed = prev["total_disturbed_area_ha"] if prev else random.uniform(80, 150)
    reclaimed = prev["reclaimed_area_ha"] if prev else disturbed * random.uniform(0.3, 0.6)

    # A mine doesn't spontaneously "undisturb" land — disturbance only ever
    # holds flat or grows.
    disturbed_delta = random.uniform(0, 0.5)
    if scenario == "LAND_DISTURBANCE_INCREASE":
        disturbed_delta += random.uniform(2, 5)
    disturbed = disturbed + disturbed_delta

    reclaimed_delta = random.uniform(0, 0.3)
    if scenario == "LAND_RECLAMATION_PROGRESS":
        reclaimed_delta += random.uniform(1, 3)
    reclaimed = min(disturbed, reclaimed + reclaimed_delta)

    active_reclamation = min(disturbed, max(0.0, disturbed - reclaimed) * random.uniform(0.1, 0.3))
    revegetated = min(reclaimed, reclaimed * random.uniform(0.5, 0.8))

    erosion = 0
    if scenario == "ENVIRONMENTAL_ANOMALY" and random.random() < 0.3:
        erosion = random.randint(1, 3)
    elif random.random() < 0.05:
        erosion = 1

    disturbed_r = round(disturbed, 2)
    reclaimed_r = round(reclaimed, 2)
    # Defensive re-clamp AFTER independent rounding — belt-and-suspenders on
    # top of the min()-based clamping above, since spec explicitly calls out
    # "never generate reclaimed land greater than disturbed land" as a hard
    # invariant to guarantee, not just usually satisfy.
    if reclaimed_r > disturbed_r:
        reclaimed_r = disturbed_r
    active_r = round(active_reclamation, 2)
    if active_r > disturbed_r:
        active_r = disturbed_r
    reveg_r = round(revegetated, 2)
    if reveg_r > reclaimed_r:
        reveg_r = reclaimed_r

    return {
        "total_disturbed_area_ha": disturbed_r,
        "reclaimed_area_ha": reclaimed_r,
        "active_reclamation_area_ha": active_r,
        "revegetated_area_ha": reveg_r,
        "erosion_incidents": erosion,
    }


# ---------------------------------------------------------------------------
# DB-facing tick logic
# ---------------------------------------------------------------------------


async def _write_energy(db, sector_id: str | None, recorded_date: date, values: dict) -> None:
    payload = EnergyMetricCreate(sector_id=sector_id, recorded_date=recorded_date, data_source="SIMULATED_SENSOR", **values)
    try:
        # commit=False — the caller (_backfill_all_sectors_if_needed / _tick_once)
        # batches every write from the whole operation into ONE commit, per
        # the NullPool reconnect-cost note on create_metric itself.
        await energy_metric_service.create_metric(db, payload, created_by=None, commit=False)
    except DuplicateError:
        pass  # another process/tick already wrote this row — fine, skip


def _clamp_waste_accounting(values: dict) -> dict:
    """Final defensive guard applied immediately before every waste write
    (fresh tick, backfilled historical day, or an in-place update onto an
    existing row) — re-derives disposed so recycled+reused+disposed never
    exceeds total, independent of how the incoming values were produced.
    A real CheckViolationError was observed live even with next_waste_values'
    own floor+margin logic (e.g. total=692.9/recycled=195.1/reused=130.0
    persisted with disposed=367.8, 0.1 above the constraint-safe value) —
    this closes that gap at the single point every waste write passes
    through, rather than trying to prove the generator can never drift."""
    total = values["total_waste_tonnes"]
    recycled = values["recycled_waste_tonnes"]
    reused = values["reused_waste_tonnes"]
    disposed = values["disposed_waste_tonnes"]
    if recycled + reused + disposed > total:
        disposed = math.floor(max(0.0, total - recycled - reused - 0.05) * 10) / 10
        values = {**values, "disposed_waste_tonnes": disposed}
    return values


async def _write_waste(db, sector_id: str | None, recorded_date: date, values: dict) -> None:
    clean = _clamp_waste_accounting({k: v for k, v in values.items() if not k.startswith("_")})
    payload = WasteMetricCreate(sector_id=sector_id, recorded_date=recorded_date, data_source="SIMULATED_SENSOR", **clean)
    try:
        await waste_metric_service.create_metric(db, payload, created_by=None, commit=False)
    except DuplicateError:
        pass


async def _write_land(db, sector_id: str | None, recorded_date: date, values: dict) -> None:
    payload = LandMetricCreate(sector_id=sector_id, recorded_date=recorded_date, data_source="SIMULATED_SENSOR", **values)
    try:
        await land_metric_service.create_metric(db, payload, created_by=None, commit=False)
    except DuplicateError:
        pass


async def _backfill_all_sectors_if_needed(db, today: date) -> None:
    """Backfills ~14 real past days for EVERY sector AND a matching
    mine-wide (sector_id=None) rollup row per day — historical mine-wide
    summaries were previously empty (a documented limitation) since only
    per-sector rows existed for past dates; a manager checking "yesterday's"
    mine-wide summary got the honest-empty-state response even though real
    per-sector history existed. Runs day-outer/sector-inner (not
    sector-outer/day-inner like a single-sector backfill would have to be)
    specifically so every day's mine-wide row can be computed from that same
    day's 4 sector values before moving to the next day.

    The skip-check below deliberately probes for a MINE-WIDE row mid-window,
    not just "does sector data exist" — a demo DB that was already running
    before this fix has real per-sector history but zero historical
    mine-wide rows (today's mine-wide row is written by every live tick
    regardless, so checking "does sector_id=None have a recent row" would
    always look satisfied and this fix would never actually backfill the
    gap it exists to close)."""
    from sqlalchemy import select

    from app.models.energy_metric import EnergyMetric

    probe_day = today - timedelta(days=_BACKFILL_DAYS // 2)
    probe = (
        await db.execute(select(EnergyMetric.id).where(EnergyMetric.sector_id.is_(None), EnergyMetric.recorded_date == probe_day))
    ).scalar_one_or_none()
    if probe is not None:
        return  # mine-wide history already covers this window — no backfill needed

    prev_by_sector: dict[str, dict] = {sector_id: {} for sector_id in SECTORS}
    for offset in range(_BACKFILL_DAYS, 0, -1):
        day = today - timedelta(days=offset)
        day_energy: list[dict] = []
        day_waste: list[dict] = []
        day_land: list[dict] = []

        for sector_id in SECTORS:
            prev = prev_by_sector[sector_id]
            energy_values = next_energy_values(prev.get("energy"), "NORMAL_OPERATION")
            waste_values = next_waste_values(prev.get("waste"), "NORMAL_OPERATION", energy_values["production_tonnes"])
            land_values = next_land_values(prev.get("land"), "NORMAL_OPERATION")

            await _write_energy(db, sector_id, day, energy_values)
            await _write_waste(db, sector_id, day, waste_values)
            await _write_land(db, sector_id, day, land_values)

            prev_by_sector[sector_id] = {"energy": energy_values, "waste": waste_values, "land": land_values}
            day_energy.append(energy_values)
            day_waste.append(waste_values)
            day_land.append(land_values)

        mine_wide_energy = _sum_values(
            day_energy, ["electricity_kwh", "fuel_litres", "renewable_energy_kwh", "peak_demand_kw", "production_tonnes"]
        )
        mine_wide_waste = _sum_values(
            day_waste,
            [
                "total_waste_tonnes",
                "recycled_waste_tonnes",
                "reused_waste_tonnes",
                "disposed_waste_tonnes",
                "hazardous_waste_tonnes",
                "production_tonnes",
            ],
        )
        mine_wide_land = _sum_values(
            day_land, ["total_disturbed_area_ha", "reclaimed_area_ha", "active_reclamation_area_ha", "revegetated_area_ha"]
        )
        mine_wide_land["erosion_incidents"] = sum(v.get("erosion_incidents") or 0 for v in day_land)
        await _write_energy(db, None, day, mine_wide_energy)
        await _write_waste(db, None, day, mine_wide_waste)
        await _write_land(db, None, day, mine_wide_land)

    await db.commit()
    # Seed today's live-tick "previous value" state from the last backfilled
    # day so the very first live tick nudges forward from a real trend
    # rather than re-rolling a fresh random baseline.
    for sector_id in SECTORS:
        prev = prev_by_sector[sector_id]
        _sector_state.setdefault(f"{sector_id}:energy", prev.get("energy"))
        _sector_state.setdefault(f"{sector_id}:waste", prev.get("waste"))
        _sector_state.setdefault(f"{sector_id}:land", prev.get("land"))
    logger.info("Backfilled %s days of sustainability history (all sectors + mine-wide)", _BACKFILL_DAYS)


async def _maybe_create_corrective_action(db, source_id: str, message: str) -> None:
    await corrective_action_service.create_system_action(
        db,
        source_type=CorrectiveActionSourceType.SUSTAINABILITY_TARGET,
        source_id=source_id,
        title=message,
        priority=CorrectiveActionPriority.HIGH,
    )


async def _check_critical_breaches(db, scenario: str) -> None:
    """Mirrors the emergency escalation loop's own periodic-check pattern —
    if a category's active target is breached past critical_percentage,
    ensure exactly one corrective action exists (dedup handled inside
    create_system_action)."""
    from app.models.enums import SustainabilityCategory
    from app.services import sustainability_dashboard_service

    checks = [
        (SustainabilityCategory.ENERGY, "energy_intensity_kwh_per_tonne", "Investigate high energy intensity"),
        (SustainabilityCategory.WASTE, "waste_diversion_pct", "Investigate low waste diversion"),
        (SustainabilityCategory.LAND, "land_reclamation_pct", "Investigate lagging land reclamation"),
    ]
    for category, metric, title in checks:
        target = await sustainability_target_service.get_active_target(db, category, metric)
        if target is None or target.critical_percentage is None:
            continue
        actual = await sustainability_dashboard_service.resolve_actual_value(db, metric)
        if actual is None or not target.target_value:
            continue
        deviation_pct = abs((actual - target.target_value) / target.target_value * 100)
        if deviation_pct >= target.critical_percentage:
            await _maybe_create_corrective_action(db, f"{category.value}:{metric}", f"{title} (mine-wide)")


_ENVIRONMENTAL_SENSOR_TYPES = ("PM10", "PM2_5", "SO2", "NOX")


async def _ensure_environmental_sensors(db) -> None:
    """Auto-creates one ACTIVE, SIMULATED SensorConfig per environmental
    type (PM10/PM2.5/SO2/NOx) whenever none exists yet, so the
    ENVIRONMENTAL_ANOMALY scenario can demonstrate a real result in a fresh
    demo DB without requiring an admin to pre-register a sensor first.
    `blueprint_id`/`created_by` are None (migration a1c2d3e4f5b6 made both
    nullable specifically for this) — the sensor has no blueprint-relative
    2D placement yet, but is otherwise a fully real, functioning
    SensorConfig row (visible in /admin/mine/sensors, source_type=SIMULATED
    makes its provenance obvious). An admin can still register/place a real
    sensor of the same type independently; this only fills the gap when
    none exists at all."""
    from app.models.enums import SensorConfigStatus, SensorSourceType, SensorType
    from app.schemas.sensor import SensorConfigCreate
    from app.services import sensor_config_service

    created_any = False
    for i, sensor_type_name in enumerate(_ENVIRONMENTAL_SENSOR_TYPES):
        sensor_type = SensorType[sensor_type_name]
        existing = await sensor_config_service.list_sensors(db, sensor_type=sensor_type, status=SensorConfigStatus.ACTIVE)
        if existing:
            continue
        payload = SensorConfigCreate(
            sensor_id=f"sim-env-{sensor_type_name.lower()}-01",
            display_name=f"Simulated {sensor_type_name.replace('_', '.')} Monitor",
            sensor_type=sensor_type,
            source_type=SensorSourceType.SIMULATED,
            sector_id=SECTORS[i % len(SECTORS)],
            level_label="Simulated",
            depth=0.0,
            pixel_x=0.0,
            pixel_y=0.0,
        )
        try:
            await sensor_config_service.create_sensor(db, payload, created_by=None)
            created_any = True
        except DuplicateError:
            pass
    if created_any:
        await db.commit()
        logger.info("Auto-created missing simulated environmental sensors (no admin registration required)")


async def _maybe_write_environmental_anomaly(db) -> None:
    """Feeds a simulated elevated reading to a PM10/PM2.5/SO2/NOx sensor —
    auto-creates one first (see _ensure_environmental_sensors) if an admin
    hasn't registered one, so this scenario always produces a visible
    result rather than silently no-op-ing on a fresh demo DB."""
    from app.models.enums import SensorConfigStatus, SensorType
    from app.schemas.environment import EnvironmentalReadingCreate
    from app.services import environmental_reading_service, environmental_requirement_service, sensor_config_service

    await _ensure_environmental_sensors(db)

    # Shuffled, not fixed PM10-first — _ensure_environmental_sensors means
    # all 4 types now typically exist simultaneously, so a fixed iteration
    # order would deterministically pick PM10 every single tick (the loop
    # returns after its first match) and never demonstrate PM2.5/SO2/NOx at
    # all. Randomizing the order gives each pollutant a real chance across
    # ticks, matching the "see everything working" intent of this scenario.
    sensor_types = [SensorType.PM10, SensorType.PM2_5, SensorType.SO2, SensorType.NOX]
    random.shuffle(sensor_types)
    for sensor_type in sensor_types:
        configs = await sensor_config_service.list_sensors(db, sensor_type=sensor_type, status=SensorConfigStatus.ACTIVE)
        if not configs:
            continue
        config = configs[0]
        requirements = await environmental_requirement_service.list_requirements(db, is_active=True)
        requirement = next((r for r in requirements if r.parameter == sensor_type.value), None)
        threshold = requirement.warning_threshold if requirement and requirement.warning_threshold else 100.0
        value = round(threshold * random.uniform(1.1, 1.4), 2)
        payload = EnvironmentalReadingCreate(
            sensor_config_id=config["id"],
            parameter=sensor_type.value,
            value=value,
            unit=requirement.unit if requirement else "µg/m3",
            data_source="SIMULATED_SENSOR",
        )
        await environmental_reading_service.create_reading(db, payload)
        logger.info("Simulated environmental anomaly: %s=%s at %s", sensor_type.value, value, config["sensor_id"])
        return  # one simulated anomaly per tick is enough


_water_flow_state: dict = {"value": None}


def next_water_flow_value(prev: float | None) -> float:
    """Pure — unit-tested directly. A mine's dewatering/discharge flow rate
    (m3/h) — continuously reported (unlike the pollutant sensors, which only
    get a reading during ENVIRONMENTAL_ANOMALY), since flow is an
    always-on operational measurement, not something that's normally silent
    and occasionally spikes. Small bounded drift each tick, never negative."""
    base = prev if prev is not None else random.uniform(30, 60)
    value = max(0.0, base + random.uniform(-4, 4))
    if random.random() < 0.05:  # occasional surge (e.g. a pump cycle)
        value *= random.uniform(1.2, 1.5)
    return round(value, 2)


async def _ensure_water_flow_sensor(db) -> dict | None:
    """Auto-creates one ACTIVE, SIMULATED WATER_FLOW SensorConfig if none
    exists yet — same reasoning and shape as _ensure_environmental_sensors,
    kept as its own function since water flow is reported every tick
    unconditionally rather than only during a scenario, a different enough
    lifecycle to not share that function's loop. Returns the (possibly
    freshly-created) ACTIVE WATER_FLOW sensor, or None if creation failed."""
    from app.models.enums import SensorConfigStatus, SensorSourceType, SensorType
    from app.schemas.sensor import SensorConfigCreate
    from app.services import sensor_config_service

    existing = await sensor_config_service.list_sensors(
        db, sensor_type=SensorType.WATER_FLOW, status=SensorConfigStatus.ACTIVE
    )
    if existing:
        return existing[0]

    payload = SensorConfigCreate(
        sensor_id="sim-water-flow-01",
        display_name="Simulated Water Flow Monitor",
        sensor_type=SensorType.WATER_FLOW,
        source_type=SensorSourceType.SIMULATED,
        sector_id=SECTORS[0],
        level_label="Simulated",
        depth=0.0,
        pixel_x=0.0,
        pixel_y=0.0,
    )
    try:
        await sensor_config_service.create_sensor(db, payload, created_by=None)
        await db.commit()
        logger.info("Auto-created missing simulated water flow sensor (no admin registration required)")
    except DuplicateError:
        pass  # another tick/process just created it — fine, re-fetch below

    created = await sensor_config_service.list_sensors(
        db, sensor_type=SensorType.WATER_FLOW, status=SensorConfigStatus.ACTIVE
    )
    return created[0] if created else None


async def _write_water_flow_reading(db) -> None:
    """Writes one WATER_FLOW reading every tick — unconditional, unlike the
    pollutant sensors, since flow is a continuously-live measurement, not
    an anomaly demo. Auto-creates the sensor first if an admin hasn't
    registered one (see _ensure_water_flow_sensor)."""
    from app.schemas.environment import EnvironmentalReadingCreate
    from app.services import environmental_reading_service

    sensor = await _ensure_water_flow_sensor(db)
    if sensor is None:
        return

    value = next_water_flow_value(_water_flow_state["value"])
    _water_flow_state["value"] = value

    payload = EnvironmentalReadingCreate(
        sensor_config_id=sensor["id"],
        parameter="WATER_FLOW",
        value=value,
        unit="m3/h",
        data_source="SIMULATED_SENSOR",
    )
    await environmental_reading_service.create_reading(db, payload)


def _sum_values(all_values: list[dict], keys: list[str]) -> dict:
    """Mine-wide totals are sums of the per-sector totals for every metric
    here (electricity, waste tonnage, disturbed/reclaimed area, ...) —
    all additive quantities, not rates. None-valued optional fields are
    treated as 0 for the sum (a sector with no fuel data doesn't erase the
    mine-wide fuel total from sectors that do have it)."""
    return {key: round(sum(v.get(key) or 0 for v in all_values), 2) for key in keys}


async def _tick_once() -> None:
    today = date.today()
    scenario = _state["scenario"]

    async with AsyncSessionLocal() as db:
        await _backfill_all_sectors_if_needed(db, today)

        all_energy: list[dict] = []
        all_waste: list[dict] = []
        all_land: list[dict] = []

        for sector_id in SECTORS:
            prev_energy_row = await energy_metric_service.get_latest(db, sector_id=sector_id)
            prev_energy = _sector_state.get(f"{sector_id}:energy") or (
                {"electricity_kwh": prev_energy_row.electricity_kwh, "production_tonnes": prev_energy_row.production_tonnes or 5000.0,
                 "renewable_energy_kwh": prev_energy_row.renewable_energy_kwh, "fuel_litres": prev_energy_row.fuel_litres}
                if prev_energy_row else None
            )
            prev_waste = _sector_state.get(f"{sector_id}:waste")
            prev_land = _sector_state.get(f"{sector_id}:land")

            energy_values = next_energy_values(prev_energy, scenario)
            waste_values = next_waste_values(prev_waste, scenario, energy_values["production_tonnes"])
            land_values = next_land_values(prev_land, scenario)

            _sector_state[f"{sector_id}:energy"] = energy_values
            _sector_state[f"{sector_id}:waste"] = waste_values
            _sector_state[f"{sector_id}:land"] = land_values
            all_energy.append(energy_values)
            all_waste.append(waste_values)
            all_land.append(land_values)

            # Upsert TODAY's row: delete-then-recreate is avoided (extra
            # round trips); instead update in place if it already exists.
            # Wrapped in a SAVEPOINT (not just try/except) — the whole tick
            # commits once at the end for NullPool reconnect-cost reasons,
            # so without a savepoint a single sector's write failing (e.g. a
            # constraint violation from a corner case _clamp_waste_accounting
            # doesn't cover) would poison and roll back every other sector's
            # already-staged updates for this tick too, not just this one's.
            try:
                async with db.begin_nested():
                    await _upsert_today(db, sector_id, today, energy_values, waste_values, land_values)
            except IntegrityError:
                logger.exception("Sustainability upsert failed for %s — skipping this sector this tick", sector_id)

        # Mine-wide (sector_id=None) rollup — the score service and
        # dashboard insights both look up get_latest(db, sector_id=None),
        # so without this they'd never see any of the simulator's data at
        # all (found live: /api/energy/summary kept returning the honest
        # empty state even with 60 rows of real per-sector data present).
        mine_wide_energy = _sum_values(
            all_energy, ["electricity_kwh", "fuel_litres", "renewable_energy_kwh", "peak_demand_kw", "production_tonnes"]
        )
        mine_wide_waste = _sum_values(
            all_waste,
            [
                "total_waste_tonnes",
                "recycled_waste_tonnes",
                "reused_waste_tonnes",
                "disposed_waste_tonnes",
                "hazardous_waste_tonnes",
                "production_tonnes",
            ],
        )
        mine_wide_land = _sum_values(
            all_land,
            ["total_disturbed_area_ha", "reclaimed_area_ha", "active_reclamation_area_ha", "revegetated_area_ha"],
        )
        mine_wide_land["erosion_incidents"] = sum(v.get("erosion_incidents") or 0 for v in all_land)
        try:
            async with db.begin_nested():
                await _upsert_today(db, None, today, mine_wide_energy, mine_wide_waste, mine_wide_land)
        except IntegrityError:
            logger.exception("Sustainability mine-wide upsert failed — skipping the rollup this tick")

        await db.commit()
        await _check_critical_breaches(db, scenario)

        try:
            await _write_water_flow_reading(db)
        except Exception:
            logger.exception("Water flow sensor reading failed")

        if scenario == "ENVIRONMENTAL_ANOMALY":
            try:
                await _maybe_write_environmental_anomaly(db)
            except Exception:
                logger.exception("Simulated environmental anomaly write failed")

    _state["last_tick_at"] = datetime.now(timezone.utc)


async def _upsert_today(db, sector_id: str, today: date, energy_values: dict, waste_values: dict, land_values: dict) -> None:
    from sqlalchemy import select

    from app.models.energy_metric import EnergyMetric
    from app.models.land_metric import LandMetric
    from app.models.waste_metric import WasteMetric

    existing_energy = (
        await db.execute(select(EnergyMetric).where(EnergyMetric.sector_id == sector_id, EnergyMetric.recorded_date == today))
    ).scalar_one_or_none()
    if existing_energy is not None:
        for key, value in energy_values.items():
            setattr(existing_energy, key, value)
    else:
        await _write_energy(db, sector_id, today, energy_values)

    existing_waste = (
        await db.execute(select(WasteMetric).where(WasteMetric.sector_id == sector_id, WasteMetric.recorded_date == today))
    ).scalar_one_or_none()
    if existing_waste is not None:
        clamped_waste = _clamp_waste_accounting({k: v for k, v in waste_values.items() if not k.startswith("_")})
        for key, value in clamped_waste.items():
            setattr(existing_waste, key, value)
    else:
        await _write_waste(db, sector_id, today, waste_values)

    existing_land = (
        await db.execute(select(LandMetric).where(LandMetric.sector_id == sector_id, LandMetric.recorded_date == today))
    ).scalar_one_or_none()
    if existing_land is not None:
        for key, value in land_values.items():
            setattr(existing_land, key, value)
    else:
        await _write_land(db, sector_id, today, land_values)


async def run_sustainability_simulator_loop(stop_event: asyncio.Event) -> None:
    """Third background task, same stop_event/cancel shape as
    emergency_escalation_service.run_emergency_escalation_loop. Only ticks
    while `_state["running"]` is true — starts running by default (matching
    settings.sustainability_simulator_enabled deciding whether this task
    exists at all; once it exists, it's running unless paused)."""
    settings = get_settings()
    _state["running"] = True
    tick_seconds = settings.sustainability_simulator_interval_seconds

    while not stop_event.is_set():
        if _state["running"]:
            try:
                # A hard timeout, not just a try/except — a single tick that
                # hangs on a slow/stuck DB call (observed live: a dev-reload
                # cycle left a tick stuck mid-transaction, which then also
                # blocked the lifespan's graceful-shutdown await on this same
                # task indefinitely, leaving the whole backend unresponsive
                # to unrelated requests like GET /docs) must never be able to
                # wedge this loop or the app's shutdown forever.
                await asyncio.wait_for(_tick_once(), timeout=30)
            except asyncio.TimeoutError:
                logger.error("Sustainability simulator tick timed out after 30s — skipping this tick")
            except Exception:
                logger.exception("Sustainability simulator tick failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=tick_seconds)
        except asyncio.TimeoutError:
            pass
