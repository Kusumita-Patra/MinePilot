from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.compliance_score import ComplianceScore
from app.models.enums import InspectionStatus, RiskLevel
from app.models.inspection import Inspection
from app.models.sensor import Sensor

# Same thresholds risk_scoring.py uses (>=75 CRITICAL, >=40 WARNING), duplicated
# here rather than importing across the T2/T3 service boundary.
_CRITICAL_THRESHOLD = 75
_WARNING_THRESHOLD = 40


def _risk_level_for(score: float) -> RiskLevel:
    if score >= _CRITICAL_THRESHOLD:
        return RiskLevel.CRITICAL
    if score >= _WARNING_THRESHOLD:
        return RiskLevel.WARNING
    return RiskLevel.NORMAL


async def get_compliance_breakdown(db: AsyncSession) -> list[dict]:
    # PLAN.md §7 (assumption #10): nothing currently populates compliance_scores;
    # this returns whatever has been recorded (empty list until that's decided).
    query = (
        select(ComplianceScore)
        .where(ComplianceScore.sector_id.is_(None))
        .distinct(ComplianceScore.category)
        .order_by(ComplianceScore.category, ComplianceScore.recorded_at.desc())
    )
    result = await db.execute(query)
    return [{"category": s.category.value, "score_pct": s.score_pct} for s in result.scalars().all()]


async def get_risk_ranking(db: AsyncSession) -> list[dict]:
    query = (
        select(Sensor.sector_id, func.avg(Sensor.last_risk_score).label("avg_risk_score"))
        .group_by(Sensor.sector_id)
        .order_by(func.avg(Sensor.last_risk_score).desc())
    )
    result = await db.execute(query)
    rankings = []
    for sector_id, avg_score in result.all():
        avg_score = round(float(avg_score), 1)
        rankings.append(
            {
                "sector_id": sector_id,
                "avg_risk_score": avg_score,
                "risk_level": _risk_level_for(avg_score).value,
            }
        )
    return rankings


async def get_inspections_breakdown(db: AsyncSession) -> dict:
    result = await db.execute(select(Inspection.status, func.count()).group_by(Inspection.status))
    counts = {status.value: 0 for status in InspectionStatus}
    for status_value, count in result.all():
        counts[status_value.value] = count

    return {
        "completed": counts[InspectionStatus.COMPLETED.value],
        "in_progress": counts[InspectionStatus.IN_PROGRESS.value],
        "scheduled": counts[InspectionStatus.SCHEDULED.value],
    }
