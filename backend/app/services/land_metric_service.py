import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import DuplicateError
from app.models.enums import DataSourceType
from app.models.land_metric import LandMetric
from app.schemas.land import LandMetricCreate, LandSummaryResponse


def reclamation_rate_pct(metric: LandMetric) -> float | None:
    # Public (not module-private) — sustainability_score_service and
    # sustainability_dashboard_service both need this exact formula.
    if not metric.total_disturbed_area_ha or metric.total_disturbed_area_ha <= 0:
        return None
    return round(metric.reclaimed_area_ha / metric.total_disturbed_area_ha * 100, 1)


def revegetation_rate_pct(metric: LandMetric) -> float | None:
    if metric.revegetated_area_ha is None or not metric.reclaimed_area_ha or metric.reclaimed_area_ha <= 0:
        return None
    return round(metric.revegetated_area_ha / metric.reclaimed_area_ha * 100, 1)


def _validate_areas(disturbed: float, reclaimed: float, active: float | None, revegetated: float | None) -> None:
    """Pure — unit-tested directly. Backend-side belt-and-suspenders on top
    of the schema validator and the DB CheckConstraints."""
    if reclaimed > disturbed + 1e-6:
        raise ValueError(f"reclaimed_area_ha ({reclaimed}) exceeds total_disturbed_area_ha ({disturbed})")
    if active is not None and active > disturbed + 1e-6:
        raise ValueError(f"active_reclamation_area_ha ({active}) exceeds total_disturbed_area_ha ({disturbed})")
    if revegetated is not None and revegetated > reclaimed + 1e-6:
        raise ValueError(f"revegetated_area_ha ({revegetated}) exceeds reclaimed_area_ha ({reclaimed})")


async def create_metric(
    db: AsyncSession, payload: LandMetricCreate, created_by: uuid.UUID | None, *, commit: bool = True
) -> LandMetric:
    """`commit=False` lets a bulk caller (the sustainability simulator's
    backfill) stage many rows and commit once for the whole batch — see
    energy_metric_service.create_metric's identical docstring."""
    _validate_areas(
        payload.total_disturbed_area_ha,
        payload.reclaimed_area_ha,
        payload.active_reclamation_area_ha,
        payload.revegetated_area_ha,
    )
    existing = await db.execute(
        select(LandMetric).where(
            LandMetric.sector_id == payload.sector_id, LandMetric.recorded_date == payload.recorded_date
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise DuplicateError(
            f"A land metric row already exists for {payload.sector_id or 'mine-wide'} on {payload.recorded_date}"
        )

    metric = LandMetric(
        sector_id=payload.sector_id,
        recorded_date=payload.recorded_date,
        total_disturbed_area_ha=payload.total_disturbed_area_ha,
        reclaimed_area_ha=payload.reclaimed_area_ha,
        active_reclamation_area_ha=payload.active_reclamation_area_ha,
        revegetated_area_ha=payload.revegetated_area_ha,
        erosion_incidents=payload.erosion_incidents,
        data_source=DataSourceType(payload.data_source),
        created_by=created_by,
    )
    db.add(metric)
    if commit:
        await db.commit()
        await db.refresh(metric)
    else:
        await db.flush()
    return metric


async def list_metrics(
    db: AsyncSession, *, sector_id: str | None = None, start: date | None = None, end: date | None = None
) -> list[LandMetric]:
    query = select(LandMetric)
    if sector_id is not None:
        query = query.where(LandMetric.sector_id == sector_id)
    if start is not None:
        query = query.where(LandMetric.recorded_date >= start)
    if end is not None:
        query = query.where(LandMetric.recorded_date <= end)
    query = query.order_by(LandMetric.recorded_date.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_latest(db: AsyncSession, *, sector_id: str | None = None) -> LandMetric | None:
    result = await db.execute(
        select(LandMetric)
        .where(LandMetric.sector_id == sector_id)
        .order_by(LandMetric.recorded_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def to_response_dict(metric: LandMetric) -> dict:
    return {
        **{col.name: getattr(metric, col.name) for col in metric.__table__.columns},
        "reclamation_rate_pct": reclamation_rate_pct(metric),
        "revegetation_rate_pct": revegetation_rate_pct(metric),
    }


async def get_summary(
    db: AsyncSession, *, sector_id: str | None = None, target_date: date | None = None
) -> LandSummaryResponse:
    target_date = target_date or date.today()
    result = await db.execute(
        select(LandMetric).where(LandMetric.sector_id == sector_id, LandMetric.recorded_date == target_date)
    )
    metric = result.scalar_one_or_none()

    if metric is None:
        return LandSummaryResponse(
            date=target_date,
            sector_id=sector_id,
            total_disturbed_area_ha=0.0,
            reclaimed_area_ha=0.0,
            active_reclamation_area_ha=None,
            revegetated_area_ha=None,
            erosion_incidents=None,
            reclamation_rate_pct=None,
            revegetation_rate_pct=None,
            data_source=None,
        )

    return LandSummaryResponse(
        date=metric.recorded_date,
        sector_id=metric.sector_id,
        total_disturbed_area_ha=metric.total_disturbed_area_ha,
        reclaimed_area_ha=metric.reclaimed_area_ha,
        active_reclamation_area_ha=metric.active_reclamation_area_ha,
        revegetated_area_ha=metric.revegetated_area_ha,
        erosion_incidents=metric.erosion_incidents,
        reclamation_rate_pct=reclamation_rate_pct(metric),
        revegetation_rate_pct=revegetation_rate_pct(metric),
        data_source=metric.data_source,
    )
