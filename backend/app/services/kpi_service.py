from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import IncidentStatus, RiskLevel
from app.models.incident import Incident
from app.models.inspection import Inspection
from app.models.sensor import Sensor

# PLAN.md §7 (assumption #10): no historical KPI snapshots are stored, so a
# day-over-day "trend" cannot be computed honestly yet. Returning None here
# rather than fabricating a number - the frontend should treat a null trend
# as "not available" until snapshot storage is added.


async def get_kpis(db: AsyncSession) -> dict:
    open_violations = (
        await db.execute(
            select(func.count())
            .select_from(Incident)
            .where(Incident.status != IncidentStatus.SIGNED_OFF)
        )
    ).scalar_one()

    pending_actions = (
        await db.execute(
            select(func.count())
            .select_from(Incident)
            .where(Incident.status.in_([IncidentStatus.TRIGGERED, IncidentStatus.ASSIGNED]))
        )
    ).scalar_one()

    today = date.today()
    inspections_this_month = (
        await db.execute(
            select(func.count())
            .select_from(Inspection)
            .where(func.extract("year", Inspection.scheduled_date) == today.year)
            .where(func.extract("month", Inspection.scheduled_date) == today.month)
        )
    ).scalar_one()

    total_sectors = (await db.execute(select(func.count(func.distinct(Sensor.sector_id))))).scalar_one()
    critical_sectors = (
        await db.execute(
            select(func.count(func.distinct(Incident.sector_id)))
            .where(Incident.status != IncidentStatus.SIGNED_OFF)
            .where(Incident.severity == RiskLevel.CRITICAL)
        )
    ).scalar_one()

    overall_compliance = (
        100.0 if total_sectors == 0 else round((total_sectors - critical_sectors) / total_sectors * 100, 1)
    )

    return {
        "overall_compliance": {"value": overall_compliance, "trend": None},
        "open_violations": {"value": open_violations, "trend": None},
        "pending_actions": {"value": pending_actions, "trend": None},
        "inspections_this_month": {"value": inspections_this_month, "trend": None},
    }
