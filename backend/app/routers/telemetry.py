from datetime import datetime

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status as ws_status

from app.core.security import get_current_user, get_current_user_ws
from app.db.database import AsyncSessionLocal, get_db
from app.models.user import User
from app.schemas.common import success_body
from app.services import telemetry_service
from app.services.telemetry_service import broadcast_manager

router = APIRouter(tags=["telemetry"])


@router.get("/api/telemetry/latest")
async def latest_telemetry(
    sector_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    frames = await telemetry_service.get_latest_frames(db, sector_id)
    return success_body(frames)


@router.get("/api/telemetry/history")
async def telemetry_history(
    sensor_id: str | None = None,
    sector_id: str | None = None,
    from_: datetime | None = Query(default=None, alias="from"),
    to: datetime | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    frames = await telemetry_service.get_history(db, sensor_id, sector_id, from_, to, limit)
    return success_body(frames)


@router.websocket("/ws/telemetry")
async def telemetry_ws(websocket: WebSocket, token: str | None = Query(default=None)) -> None:
    async with AsyncSessionLocal() as db:
        user = await get_current_user_ws(token, db)

    if user is None:
        await websocket.close(code=ws_status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    queue = broadcast_manager.subscribe()
    try:
        while True:
            frame = await queue.get()
            await websocket.send_json(frame)
    except WebSocketDisconnect:
        pass
    finally:
        broadcast_manager.unsubscribe(queue)
