import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.enums import UserRole, user_role_enum


class RolePermission(Base):
    """One (role, capability) grant. Only `mine_manager`/`field_worker` rows
    are ever stored — `administrator` is a hardcoded superuser in
    `require_permission` (see core/security.py) and is never represented
    here, so an admin can never edit their own role out of existence."""

    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role", "capability", name="uq_role_permissions_role_capability"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role: Mapped[UserRole] = mapped_column(user_role_enum, nullable=False)
    capability: Mapped[str] = mapped_column(String, nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
