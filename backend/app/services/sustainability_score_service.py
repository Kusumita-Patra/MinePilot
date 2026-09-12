from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import DataSourceType, SustainabilityCategory
from app.models.sustainability_score import SustainabilityScore
from app.services import (
    analytics_service,
    corrective_action_service,
    environmental_reading_service,
    environmental_requirement_service,
    kpi_service,
    sustainability_target_service,
    water_metric_service,
)

# Rate-limits how often a snapshot row is actually persisted per category —
# this codebase has no cron, and a chatty dashboard polling GET
# /api/sustainability/scores every few seconds shouldn't accumulate a row
# per poll. The live response always reflects a fresh computation regardless
# of whether a new snapshot was written this call. See plan Deviation #3.
_SNAPSHOT_MIN_INTERVAL = timedelta(minutes=5)

# ENERGY/WASTE/LAND/LABOUR have no backing data model in this pass (deferred
# per the flagship-slice scope) — only these 4 are actually computed, plus
# OVERALL as their average. Deliberately not faked as 100/neutral.
_COMPUTED_CATEGORIES = [
    SustainabilityCategory.WATER,
    SustainabilityCategory.ENVIRONMENTAL,
    SustainabilityCategory.SAFETY,
    SustainabilityCategory.COMPLIANCE,
]


async def _latest_snapshots(
    db: AsyncSession, categories: list[SustainabilityCategory]
) -> dict[SustainabilityCategory, SustainabilityScore]:
    """One round trip for every category's latest snapshot, not one per
    category — see the NullPool reconnect-per-commit note below for why
    minimizing round trips matters here specifically."""
    result = await db.execute(
        select(SustainabilityScore)
        .where(SustainabilityScore.category.in_(categories))
        .distinct(SustainabilityScore.category)
        .order_by(SustainabilityScore.category, SustainabilityScore.computed_at.desc())
    )
    return {row.category: row for row in result.scalars().all()}


def _should_snapshot(latest: SustainabilityScore | None) -> bool:
    if latest is None:
        return True
    return (datetime.now(timezone.utc) - latest.computed_at) >= _SNAPSHOT_MIN_INTERVAL


def _stage_snapshot(
    db: AsyncSession,
    category: SustainabilityCategory,
    score_pct: float,
    methodology_notes: str,
    range_start: datetime,
    range_end: datetime,
) -> None:
    """Stages (db.add, no commit) — the caller commits once for the whole
    batch. Under this project's required NullPool config, every db.commit()
    tears down and reopens the physical DB connection (see
    audit_service.py's docstring); committing once per category here instead
    of once total was turning a single dashboard request into 5+ extra
    Supabase reconnects, which is what made this endpoint painfully slow
    (and, under concurrent polling load, appear to hang outright)."""
    db.add(
        SustainabilityScore(
            category=category,
            score_pct=score_pct,
            methodology_notes=methodology_notes,
            data_source=DataSourceType.CALCULATED,
            time_range_start=range_start,
            time_range_end=range_end,
        )
    )


async def compute_water_score(db: AsyncSession) -> dict:
    metric = await water_metric_service.get_latest(db, sector_id=None)
    if metric is None:
        return {
            "score_pct": 50.0,
            "contributing_metrics": {},
            "methodology_notes": "No WaterMetric rows exist yet — neutral default score.",
        }

    actual_reuse_pct = water_metric_service.reuse_pct(metric)
    target = await sustainability_target_service.get_active_target(db, SustainabilityCategory.WATER, "water_reuse_pct")
    if actual_reuse_pct is None or target is None:
        return {
            "score_pct": 50.0,
            "contributing_metrics": {
                "reuse_pct": actual_reuse_pct,
                "target_pct": target.target_value if target else None,
            },
            "methodology_notes": (
                "No active 'water_reuse_pct' SustainabilityTarget configured, or reuse_pct not "
                "computable from the latest WaterMetric — neutral default."
            ),
        }

    score = min(100.0, round(actual_reuse_pct / target.target_value * 100, 1))
    return {
        "score_pct": score,
        "contributing_metrics": {"reuse_pct": actual_reuse_pct, "target_pct": target.target_value},
        "methodology_notes": (
            "score = min(100, actual_reuse_pct / target_reuse_pct * 100), using the latest WaterMetric "
            "row and the active 'water_reuse_pct' SustainabilityTarget."
        ),
    }


async def compute_environmental_score(db: AsyncSession) -> dict:
    requirements = await environmental_requirement_service.list_requirements(db, is_active=True)
    evaluated = []
    compliant_count = 0
    for requirement in requirements:
        latest = await environmental_reading_service.get_latest_by_parameter(db, requirement.parameter)
        if latest is None:
            # Excluded from the denominator, not silently counted compliant.
            continue
        evaluated.append(
            {"parameter": requirement.parameter, "value": latest.value, "warning_threshold": requirement.warning_threshold}
        )
        if requirement.warning_threshold is None or latest.value < requirement.warning_threshold:
            compliant_count += 1

    if not evaluated:
        return {
            "score_pct": 50.0,
            "contributing_metrics": {"evaluated_requirements": 0},
            "methodology_notes": (
                "No active EnvironmentalRequirement has a matching EnvironmentalReading yet — neutral default."
            ),
        }

    score = round(compliant_count / len(evaluated) * 100, 1)
    return {
        "score_pct": score,
        "contributing_metrics": {"evaluated_requirements": len(evaluated), "compliant": compliant_count, "details": evaluated},
        "methodology_notes": (
            "% of active EnvironmentalRequirements (with at least one recorded reading) whose latest "
            "reading is below its warning_threshold. Requirements with no reading yet are excluded from "
            "the denominator, not counted as compliant."
        ),
    }


def _corrective_action_score_from_counts(open_count: int, overdue_count: int) -> float:
    """Pure function, unit-tested directly (see
    tests/test_sustainability_score_service.py) — kept free of I/O so the
    overdue-ratio arithmetic and clamping can be verified without a DB."""
    if open_count == 0:
        return 100.0
    return max(0.0, round(100 - overdue_count / open_count * 100, 1))


async def compute_corrective_action_score(db: AsyncSession) -> dict:
    open_actions = await corrective_action_service.list_open(db)
    overdue_count = sum(1 for a in open_actions if corrective_action_service.to_response_dict(a)["is_overdue"])
    open_count = len(open_actions)

    score = _corrective_action_score_from_counts(open_count, overdue_count)
    return {
        "score_pct": score,
        "contributing_metrics": {"open_count": open_count, "overdue_count": overdue_count},
        "methodology_notes": "score = 100 - (overdue_open_actions / total_open_actions * 100), clamped to [0, 100].",
    }


async def compute_safety_score(db: AsyncSession) -> dict:
    kpis = await kpi_service.get_kpis(db)
    value = kpis["overall_compliance"]["value"]
    return {
        "score_pct": value,
        "contributing_metrics": {"overall_compliance": value},
        "methodology_notes": "Delegated to kpi_service.get_kpis's overall_compliance value — not recomputed here.",
    }


async def compute_compliance_score(db: AsyncSession) -> dict:
    breakdown = await analytics_service.get_compliance_breakdown(db)
    breakdown_avg = round(sum(c["score_pct"] for c in breakdown) / len(breakdown), 1) if breakdown else None
    corrective = await compute_corrective_action_score(db)

    components = [v for v in (breakdown_avg, corrective["score_pct"]) if v is not None]
    score = round(sum(components) / len(components), 1) if components else 50.0
    return {
        "score_pct": score,
        "contributing_metrics": {
            "compliance_breakdown_avg": breakdown_avg,
            "compliance_breakdown_categories": breakdown,
            "corrective_action_score": corrective["score_pct"],
            "corrective_action_detail": corrective["contributing_metrics"],
        },
        "methodology_notes": (
            "Average of (a) analytics_service.get_compliance_breakdown's category average — delegated, "
            "not recomputed — and (b) the corrective-action overdue ratio. Falls back to a neutral 50 "
            "if neither component has data yet."
        ),
    }


_COMPUTE_FN = {
    SustainabilityCategory.WATER: compute_water_score,
    SustainabilityCategory.ENVIRONMENTAL: compute_environmental_score,
    SustainabilityCategory.SAFETY: compute_safety_score,
    SustainabilityCategory.COMPLIANCE: compute_compliance_score,
}


def _compute_overall(computed: dict[SustainabilityCategory, dict]) -> dict:
    values = [result["score_pct"] for result in computed.values()]
    score = round(sum(values) / len(values), 1) if values else 0.0
    return {
        "score_pct": score,
        "contributing_metrics": {category.value: result["score_pct"] for category, result in computed.items()},
        "methodology_notes": (
            "Unweighted average of the Water/Environmental/Safety/Compliance sub-scores — equal "
            "weighting, pending product input on relative importance. Energy/Waste/Land/Labour are out "
            "of scope for this pass and excluded from the average (not treated as 100)."
        ),
    }


async def get_dashboard_scores(db: AsyncSession) -> dict[str, dict]:
    now = datetime.now(timezone.utc)
    range_start = now - timedelta(days=1)

    computed: dict[SustainabilityCategory, dict] = {}
    for category in _COMPUTED_CATEGORIES:
        computed[category] = await _COMPUTE_FN[category](db)

    overall = _compute_overall(computed)
    computed[SustainabilityCategory.OVERALL] = overall

    latest_snapshots = await _latest_snapshots(db, list(computed.keys()))
    staged_any = False
    for category, result in computed.items():
        if _should_snapshot(latest_snapshots.get(category)):
            _stage_snapshot(db, category, result["score_pct"], result["methodology_notes"], range_start, now)
            staged_any = True
    if staged_any:
        await db.commit()

    responses: dict[str, dict] = {}
    for category, result in computed.items():
        responses[category.value] = {
            "category": category,
            "score_pct": result["score_pct"],
            "methodology_notes": result["methodology_notes"],
            "data_source": DataSourceType.CALCULATED,
            "time_range_start": range_start,
            "time_range_end": now,
            "computed_at": now,
            "contributing_metrics": result["contributing_metrics"],
        }
    return responses
