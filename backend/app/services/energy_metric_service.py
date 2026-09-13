import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions.custom_exceptions import DuplicateError
from app.models.energy_metric import EnergyMetric
from app.models.enums import DataSourceType
from app.schemas.energy import EnergyMetricCreate, EnergySummaryResponse


def energy_intensity_kwh_per_tonne(metric: EnergyMetric) -> float | None:
    # Public (not module-private) — sustainability_score_service and
    # sustainability_dashboard_service both need this exact formula.
    if not metric.production_tonnes or metric.production_tonnes <= 0:
        return None
    return round(metric.electricity_kwh / metric.production_tonnes, 3)


def renewable_percentage(metric: EnergyMetric) -> float | None:
    if not metric.renewable_energy_kwh or not metric.electricity_kwh or metric.electricity_kwh <= 0:
        return None
    return round(metric.renewable_energy_kwh / metric.electricity_kwh * 100, 1)


async def create_metric(
    db: AsyncSession, payload: EnergyMetricCreate, created_by: uuid.UUID | None, *, commit: bool = True
) -> EnergyMetric:
    """`commit=False` lets a bulk caller (the sustainability simulator's
    backfill) stage many rows and commit once for the whole batch — under
    this project's required NullPool config, every db.commit() tears down
    and rebuilds the DB connection, so committing per-row during a 14-day
    backfill across 4 sectors would be a reconnect storm. Mirrors
    audit_service.record's exact commit=False convention."""
    existing = await db.execute(
        select(EnergyMetric).where(
            EnergyMetric.sector_id == payload.sector_id, EnergyMetric.recorded_date == payload.recorded_date
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise DuplicateError(
            f"An energy metric row already exists for {payload.sector_id or 'mine-wide'} on {payload.recorded_date}"
        )

    metric = EnergyMetric(
        sector_id=payload.sector_id,
        recorded_date=payload.recorded_date,
        electricity_kwh=payload.electricity_kwh,
        fuel_litres=payload.fuel_litres,
        renewable_energy_kwh=payload.renewable_energy_kwh,
        peak_demand_kw=payload.peak_demand_kw,
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
) -> list[EnergyMetric]:
    query = select(EnergyMetric)
    if sector_id is not None:
        query = query.where(EnergyMetric.sector_id == sector_id)
    if start is not None:
        query = query.where(EnergyMetric.recorded_date >= start)
    if end is not None:
        query = query.where(EnergyMetric.recorded_date <= end)
    query = query.order_by(EnergyMetric.recorded_date.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def get_latest(db: AsyncSession, *, sector_id: str | None = None) -> EnergyMetric | None:
    result = await db.execute(
        select(EnergyMetric)
        .where(EnergyMetric.sector_id == sector_id)
        .order_by(EnergyMetric.recorded_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def to_response_dict(metric: EnergyMetric) -> dict:
    return {
        **{col.name: getattr(metric, col.name) for col in metric.__table__.columns},
        "energy_intensity_kwh_per_tonne": energy_intensity_kwh_per_tonne(metric),
        "renewable_percentage": renewable_percentage(metric),
    }


async def get_summary(
    db: AsyncSession, *, sector_id: str | None = None, target_date: date | None = None
) -> EnergySummaryResponse:
    target_date = target_date or date.today()
    result = await db.execute(
        select(EnergyMetric).where(EnergyMetric.sector_id == sector_id, EnergyMetric.recorded_date == target_date)
    )
    metric = result.scalar_one_or_none()

    if metric is None:
        # Honest empty state — never fabricate a summary when no data exists.
        return EnergySummaryResponse(
            date=target_date,
            sector_id=sector_id,
            electricity_kwh=0.0,
            fuel_litres=None,
            renewable_energy_kwh=None,
            peak_demand_kw=None,
            production_tonnes=None,
            energy_intensity_kwh_per_tonne=None,
            renewable_percentage=None,
            data_source=None,
        )

    return EnergySummaryResponse(
        date=metric.recorded_date,
        sector_id=metric.sector_id,
        electricity_kwh=metric.electricity_kwh,
        fuel_litres=metric.fuel_litres,
        renewable_energy_kwh=metric.renewable_energy_kwh,
        peak_demand_kw=metric.peak_demand_kw,
        production_tonnes=metric.production_tonnes,
        energy_intensity_kwh_per_tonne=energy_intensity_kwh_per_tonne(metric),
        renewable_percentage=renewable_percentage(metric),
        data_source=metric.data_source,
    )
