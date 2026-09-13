from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import DataSourceType
from app.models.sustainability_target import SustainabilityTarget
from app.services import (
    corrective_action_service,
    energy_metric_service,
    land_metric_service,
    sustainability_score_service,
    sustainability_target_service,
    waste_metric_service,
    water_metric_service,
)


async def _resolve_water(db: AsyncSession, fn) -> float | None:
    metric = await water_metric_service.get_latest(db, sector_id=None)
    return fn(metric) if metric else None


async def _resolve_energy(db: AsyncSession, fn) -> float | None:
    metric = await energy_metric_service.get_latest(db, sector_id=None)
    return fn(metric) if metric else None


async def _resolve_waste(db: AsyncSession, fn) -> float | None:
    metric = await waste_metric_service.get_latest(db, sector_id=None)
    return fn(metric) if metric else None


async def _resolve_land(db: AsyncSession, fn) -> float | None:
    metric = await land_metric_service.get_latest(db, sector_id=None)
    return fn(metric) if metric else None


# Each resolver is self-contained (db) -> float | None: fetches its own
# category's latest aggregate row and applies the matching calculation
# function. Metrics with no resolver here simply produce no insight yet — a
# documented gap, not a faked one. Extend this map as more metrics get a
# real data source.
_ACTUAL_VALUE_RESOLVERS = {
    "water_reuse_pct": lambda db: _resolve_water(db, water_metric_service.reuse_pct),
    "water_intensity_m3_per_tonne": lambda db: _resolve_water(db, water_metric_service.efficiency_m3_per_tonne),
    "energy_intensity_kwh_per_tonne": lambda db: _resolve_energy(db, energy_metric_service.energy_intensity_kwh_per_tonne),
    "renewable_energy_pct": lambda db: _resolve_energy(db, energy_metric_service.renewable_percentage),
    "waste_diversion_pct": lambda db: _resolve_waste(db, waste_metric_service.diversion_rate_pct),
    "waste_intensity_tonnes_per_tonne": lambda db: _resolve_waste(db, waste_metric_service.waste_intensity_tonnes_per_tonne),
    "land_reclamation_pct": lambda db: _resolve_land(db, land_metric_service.reclamation_rate_pct),
}


async def resolve_actual_value(db: AsyncSession, metric: str) -> float | None:
    """Public — the sustainability simulator's critical-breach check also
    needs this exact resolution logic, so it's exposed here rather than
    duplicated."""
    resolver = _ACTUAL_VALUE_RESOLVERS.get(metric)
    if resolver is None:
        return None
    return await resolver(db)


async def _get_actual_for_target(db: AsyncSession, target: SustainabilityTarget) -> float | None:
    return await resolve_actual_value(db, target.metric)


async def get_insights(db: AsyncSession) -> list[dict]:
    """Rule-based target-vs-actual comparisons only — NOT statistical anomaly
    detection (real anomaly detection was explicitly deferred). Every insight
    is a fixed-format sentence triggered by a SustainabilityTarget breach,
    always CALCULATED. See plan Deviation #2."""
    targets = await sustainability_target_service.list_targets(db, is_active=True)
    insights: list[dict] = []

    for target in targets:
        actual = await _get_actual_for_target(db, target)
        if actual is None or not target.target_value:
            continue

        deviation_pct = (actual - target.target_value) / target.target_value * 100
        severity = None
        if target.critical_percentage is not None and abs(deviation_pct) >= target.critical_percentage:
            severity = "critical"
        elif target.warning_percentage is not None and abs(deviation_pct) >= target.warning_percentage:
            severity = "warning"
        if severity is None:
            continue

        direction = "above" if deviation_pct > 0 else "below"
        label = target.metric.replace("_", " ")
        insights.append(
            {
                "message": (
                    f"{label} is {abs(round(deviation_pct, 1))}% {direction} its target of "
                    f"{target.target_value}{target.unit}."
                ),
                "severity": severity,
                "data_source": DataSourceType.CALCULATED,
                "metric": target.metric,
            }
        )

    return insights


async def get_dashboard(db: AsyncSession) -> dict:
    scores = await sustainability_score_service.get_dashboard_scores(db)
    overall = scores.pop("OVERALL")
    sub_scores = list(scores.values())

    water_summary = await water_metric_service.get_summary(db)
    open_actions = await corrective_action_service.list_open_environmental(db)
    insights = await get_insights(db)

    return {
        "overall_score": overall,
        "sub_scores": sub_scores,
        "water_summary": water_summary,
        "open_environmental_actions": [corrective_action_service.to_response_dict(a) for a in open_actions],
        "insights": insights,
    }
