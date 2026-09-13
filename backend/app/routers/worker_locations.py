from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.worker_location import WorkerLocationResponse
from app.services import worker_geotracking_service

router = APIRouter(prefix="/api/worker-locations", tags=["worker-locations"])


@router.get("")
async def list_worker_locations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Live, continuous worker geotagging — open to any authenticated role,
    matching the existing openness of other operational-monitoring reads
    (blueprint sections, sensor registry, evacuation graph) in this
    backend. Only /admin and the manager dashboard actually surface this in
    the UI; a field worker's own /field view does not."""
    locations = await worker_geotracking_service.list_locations(db)
    data = [WorkerLocationResponse(**loc).model_dump(mode="json") for loc in locations]
    return success_body(data)
