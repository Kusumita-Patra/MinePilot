from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import UserRole
from app.schemas.user import UserResponse

# Public self-registration only ever creates the two operational roles.
# Administrator accounts are never self-assignable here — see
# backend/scripts/promote_to_admin.py and POST /api/users (administrator-only).
SelfRegisterableRole = Literal[UserRole.mine_manager, UserRole.field_worker]


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=1)
    role: SelfRegisterableRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


class UpdateFullNameRequest(BaseModel):
    full_name: str = Field(min_length=1)


class UpdateEmailRequest(BaseModel):
    new_email: EmailStr
    current_password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
