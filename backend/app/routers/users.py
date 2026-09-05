from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.database import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.common import success_body
from app.schemas.user import UserResponse
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.mine_manager)),
) -> dict:
    users = await user_service.list_users(db)
    data = [UserResponse.model_validate(u).model_dump(mode="json") for u in users]
    return success_body(data)
