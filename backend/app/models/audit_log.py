import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AdminAuditLog(Base):
    """Who did what, and when. Written by administrator-facing write endpoints
    only (blueprint changes, user management, alert/compliance rule changes) —
    never given raw request bodies, so secrets can't leak in here by accident."""

    __tablename__ = "admin_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    actor_role: Mapped[str] = mapped_column(String, nullable=False)
    action: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "blueprint.upload"
    resource_type: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "blueprint"
    resource_id: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str] = mapped_column(String, nullable=False)
    # Python attribute is `log_metadata` (SQLAlchemy reserves `.metadata` on
    # declarative instances) but the DB column is plain `metadata`.
    log_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
