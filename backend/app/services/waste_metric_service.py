import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import DuplicateError
from app.models.enums import DataSourceType
from app.models.waste_metric import WasteMetric
from app.schemas.waste import WasteMetricCreate, WasteSummaryResponse


def diversion_rate_pct(metric: WasteMetric) -> float | None:
    # Public (not module-private) — sustainability_score_service and
    # sustainability_dashboard_service both need this exact formula.
    if metric.total_waste_tonnes <= 0:
        return None
    return round((metric.recycled_waste_tonnes + metric.reused_waste_tonnes) / metric.total_waste_tonnes * 100, 1)


def recycling_rate_pct(metric: WasteMetric) -> float | None:
    if metric.total_waste_tonnes <= 0:
        return None
    return round(metric.recycled_waste_tonnes / metric.total_waste_tonnes * 100, 1)


def reuse_rate_pct(metric: WasteMetric) -> float | None:
    if metric.total_waste_tonnes <= 0:
        return None
    return round(metric.reused_waste_tonnes / metric.total_waste_tonnes * 100, 1)


def waste_intensity_tonnes_per_tonne(metric: WasteMetric) -> float | None:
    if not metric.production_tonnes or metric.production_tonnes <= 0:
        return None
    return round(metric.total_waste_tonnes / metric.production_tonnes, 3)


def _validate_accounting(total: float, recycled: float, reused: float, disposed: float) -> None:
    """Pure — unit-tested directly. Backend-side belt-and-suspenders on top
    of the schema validator and the DB CheckConstraint (spec §49: never rely
    on frontend validation alone)."""
    if recycled + reused + disposed > total + 1e-6:
        raise ValueError(f"recycled + reused + disposed ({recycled + reused + disposed}) exceeds total ({total})")


async def create_metric(
    db: AsyncSession, payload: WasteMetricCreate, created_by: uuid.UUID | None, *, commit: bool = True
) -> WasteMetric:
    """`commit=False` lets a bulk caller (the sustainability simulator's
    backfill) stage many rows and commit once for the whole batch — see
    energy_metric_service.create_metric's identical docstring."""
    _validate_accounting(
        payload.total_waste_tonnes, payload.recycled_waste_tonnes, payload.reused_waste_tonnes, payload.disposed_waste_tonnes
    )
    existing = await db.execute(
        select(WasteMetric).where(
            WasteMetric.sector_id == payload.sector_id, WasteMetric.recorded_date == payload.recorded_date
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise DuplicateError(
            f"A waste metric row already exists for {payload.sector_id or 'mine-wide'} on {payload.recorded_date}"
        )

    metric = WasteMetric(
        sector_id=payload.sector_id,
        recorded_date=payload.recorded_date,
        total_waste_tonnes=payload.total_waste_tonnes,
        recycled_waste_tonnes=payload.recycled_waste_tonnes,
        reused_waste_tonnes=payload.reused_waste_tonnes,
        disposed_waste_tonnes=payload.disposed_waste_tonnes,
        hazardous_waste_tonnes=payload.hazardous_waste_tonnes,
        production_tonnes=payload.production_tonnes,
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
) -> list[WasteMetric]:
    query = select(WasteMetric)
    if sector_id is not None:
        query = query.where(WasteMetric.sector_id == sector_id)
    if start is not None:
        query = query.where(WasteMetric.recorded_date >= start)
    if end is not None:
        query = query.where(WasteMetric.recorded_date <= end)
    query = query.order_by(WasteMetric.recorded_date.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_latest(db: AsyncSession, *, sector_id: str | None = None) -> WasteMetric | None:
    result = await db.execute(
        select(WasteMetric)
        .where(WasteMetric.sector_id == sector_id)
        .order_by(WasteMetric.recorded_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def to_response_dict(metric: WasteMetric) -> dict:
    return {
        **{col.name: getattr(metric, col.name) for col in metric.__table__.columns},
        "diversion_rate_pct": diversion_rate_pct(metric),
        "recycling_rate_pct": recycling_rate_pct(metric),
        "reuse_rate_pct": reuse_rate_pct(metric),
        "waste_intensity_tonnes_per_tonne": waste_intensity_tonnes_per_tonne(metric),
    }


async def get_summary(
    db: AsyncSession, *, sector_id: str | None = None, target_date: date | None = None
) -> WasteSummaryResponse:
    target_date = target_date or date.today()
    result = await db.execute(
        select(WasteMetric).where(WasteMetric.sector_id == sector_id, WasteMetric.recorded_date == target_date)
    )
    metric = result.scalar_one_or_none()

    if metric is None:
        return WasteSummaryResponse(
            date=target_date,
            sector_id=sector_id,
            total_waste_tonnes=0.0,
            recycled_waste_tonnes=0.0,
            reused_waste_tonnes=0.0,
            disposed_waste_tonnes=0.0,
            hazardous_waste_tonnes=None,
            diversion_rate_pct=None,
            recycling_rate_pct=None,
            reuse_rate_pct=None,
            waste_intensity_tonnes_per_tonne=None,
            data_source=None,
        )

    return WasteSummaryResponse(
        date=metric.recorded_date,
        sector_id=metric.sector_id,
        total_waste_tonnes=metric.total_waste_tonnes,
        recycled_waste_tonnes=metric.recycled_waste_tonnes,
        reused_waste_tonnes=metric.reused_waste_tonnes,
        disposed_waste_tonnes=metric.disposed_waste_tonnes,
        hazardous_waste_tonnes=metric.hazardous_waste_tonnes,
        diversion_rate_pct=diversion_rate_pct(metric),
        recycling_rate_pct=recycling_rate_pct(metric),
        reuse_rate_pct=reuse_rate_pct(metric),
        waste_intensity_tonnes_per_tonne=waste_intensity_tonnes_per_tonne(metric),
        data_source=metric.data_source,
    )
