from fastapi import APIRouter

from app.schemas.common import success_body

router = APIRouter(tags=["health"])


@router.get("/api/health")
async def health_check() -> dict:
    return success_body({}, message="ok")
