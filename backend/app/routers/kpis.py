from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.common import success_body
from app.services import kpi_service

router = APIRouter(prefix="/api/kpis", tags=["kpis"])


@router.get("")
async def get_kpis(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    kpis = await kpi_service.get_kpis(db)
    return success_body(kpis)
