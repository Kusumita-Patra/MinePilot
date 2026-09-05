from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest
from app.schemas.common import success_body
from app.schemas.user import UserResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> dict:
    user = await auth_service.register(db, payload)
    return success_body(user.model_dump(mode="json"), message="User registered successfully")


@router.post("/login")
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> dict:
    token = await auth_service.login(db, payload)
    return success_body(token.model_dump(mode="json"), message="Login successful")


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)) -> dict:
    return success_body(UserResponse.model_validate(current_user).model_dump(mode="json"))
