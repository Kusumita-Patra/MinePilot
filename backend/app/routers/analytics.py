from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.common import success_body
from app.services import analytics_service

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/compliance")
async def compliance_breakdown(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return success_body(await analytics_service.get_compliance_breakdown(db))


@router.get("/risk-ranking")
async def risk_ranking(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return success_body(await analytics_service.get_risk_ranking(db))


@router.get("/inspections")
async def inspections_breakdown(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return success_body(await analytics_service.get_inspections_breakdown(db))
