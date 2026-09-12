import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import DuplicateError
from app.models.enums import DataSourceType
from app.models.water_metric import WaterMetric
from app.schemas.water import WaterMetricCreate, WaterSummaryResponse


def reuse_pct(metric: WaterMetric) -> float | None:
    # Spec: "Water Reuse % = (reused / total_used) x 100" — total_used is
    # water_consumed_m3, the field literally described as "used". See
    # Deviation #4 in the plan for the consumed-vs-extracted naming note.
    # Public (not module-private) — sustainability_score_service and
    # sustainability_dashboard_service both need this exact formula.
    if metric.water_consumed_m3 <= 0:
        return None
    return round(metric.water_reused_m3 / metric.water_consumed_m3 * 100, 1)


def efficiency_m3_per_tonne(metric: WaterMetric) -> float | None:
    if not metric.production_tonnes or metric.production_tonnes <= 0:
        return None
    return round(metric.water_consumed_m3 / metric.production_tonnes, 3)


async def create_metric(db: AsyncSession, payload: WaterMetricCreate, created_by: uuid.UUID) -> WaterMetric:
    existing = await db.execute(
        select(WaterMetric).where(
            WaterMetric.sector_id == payload.sector_id, WaterMetric.recorded_date == payload.recorded_date
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise DuplicateError(
            f"A water metric row already exists for {payload.sector_id or 'mine-wide'} on {payload.recorded_date}"
        )

    metric = WaterMetric(
        sector_id=payload.sector_id,
        recorded_date=payload.recorded_date,
        water_consumed_m3=payload.water_consumed_m3,
        water_extracted_m3=payload.water_extracted_m3,
        water_reused_m3=payload.water_reused_m3,
        water_discharged_m3=payload.water_discharged_m3,
        rainwater_collected_m3=payload.rainwater_collected_m3,
        production_tonnes=payload.production_tonnes,
        data_source=DataSourceType(payload.data_source),
        created_by=created_by,
    )
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    return metric


async def list_metrics(
    db: AsyncSession, *, sector_id: str | None = None, start: date | None = None, end: date | None = None
) -> list[WaterMetric]:
    query = select(WaterMetric)
    if sector_id is not None:
        query = query.where(WaterMetric.sector_id == sector_id)
    if start is not None:
        query = query.where(WaterMetric.recorded_date >= start)
    if end is not None:
        query = query.where(WaterMetric.recorded_date <= end)
    query = query.order_by(WaterMetric.recorded_date.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_latest(db: AsyncSession, *, sector_id: str | None = None) -> WaterMetric | None:
    result = await db.execute(
        select(WaterMetric)
        .where(WaterMetric.sector_id == sector_id)
        .order_by(WaterMetric.recorded_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def to_response_dict(metric: WaterMetric) -> dict:
    return {
        **{col.name: getattr(metric, col.name) for col in metric.__table__.columns},
        "reuse_pct": reuse_pct(metric),
        "efficiency_m3_per_tonne": efficiency_m3_per_tonne(metric),
    }


async def get_summary(db: AsyncSession, *, sector_id: str | None = None, target_date: date | None = None) -> WaterSummaryResponse:
    target_date = target_date or date.today()
    result = await db.execute(
        select(WaterMetric).where(WaterMetric.sector_id == sector_id, WaterMetric.recorded_date == target_date)
    )
    metric = result.scalar_one_or_none()

    if metric is None:
        # Honest empty state — never fabricate a summary when no data exists
        # for the requested day.
        return WaterSummaryResponse(
            date=target_date,
            sector_id=sector_id,
            water_used_m3=0.0,
            water_reused_m3=0.0,
            reuse_rate_pct=None,
            water_discharged_m3=0.0,
            efficiency_m3_per_tonne=None,
            data_source=None,
        )

    return WaterSummaryResponse(
        date=metric.recorded_date,
        sector_id=metric.sector_id,
        water_used_m3=metric.water_consumed_m3,
        water_reused_m3=metric.water_reused_m3,
        reuse_rate_pct=reuse_pct(metric),
        water_discharged_m3=metric.water_discharged_m3,
        efficiency_m3_per_tonne=efficiency_m3_per_tonne(metric),
        data_source=metric.data_source,
    )
