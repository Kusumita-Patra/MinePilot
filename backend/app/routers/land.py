from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.land import LandMetricCreate, LandMetricResponse
from app.services import audit_service, land_metric_service

router = APIRouter(prefix="/api/land", tags=["land"])


@router.get("/history")
async def list_metrics(
    sector_id: str | None = None,
    start: date | None = None,
    end: date | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    metrics = await land_metric_service.list_metrics(db, sector_id=sector_id, start=start, end=end)
    data = [LandMetricResponse(**land_metric_service.to_response_dict(m)).model_dump(mode="json") for m in metrics]
    return success_body(data)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_metric(
    payload: LandMetricCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    metric = await land_metric_service.create_metric(db, payload, current_user.id)
    await audit_service.record(
        db,
        actor=current_user,
        action="land_metric.create",
        resource_type="land_metric",
        resource_id=str(metric.id),
        description=(
            f"Recorded land metrics for {metric.sector_id or 'mine-wide'} on {metric.recorded_date} "
            f"({metric.data_source.value})"
        ),
    )
    return success_body(
        LandMetricResponse(**land_metric_service.to_response_dict(metric)).model_dump(mode="json"),
        message="Land metric recorded successfully",
    )


@router.get("/summary")
async def get_summary(
    sector_id: str | None = None,
    target_date: date | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    summary = await land_metric_service.get_summary(db, sector_id=sector_id, target_date=target_date)
    return success_body(summary.model_dump(mode="json"))
