from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AdminAuditLog
from app.models.user import User


async def record(
    db: AsyncSession,
    *,
    actor: User,
    action: str,
    resource_type: str,
    description: str,
    resource_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    """Writes one audit entry. Only takes the specific fields listed above —
    never a raw request body or header dict — so a password/JWT/secret can
    never end up in `metadata` by accident."""
    db.add(
        AdminAuditLog(
            actor_user_id=actor.id,
            actor_role=actor.role.value,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            description=description,
            log_metadata=metadata,
        )
    )
    await db.commit()
