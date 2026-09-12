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
    commit: bool = True,
) -> None:
    """Writes one audit entry. Only takes the specific fields listed above —
    never a raw request body or header dict — so a password/JWT/secret can
    never end up in `metadata` by accident.

    `commit=False` lets a caller stage this insert alongside another pending
    write and commit both together in one round trip — under this project's
    required NullPool config (see database.py), every `db.commit()` tears
    down and rebuilds the DB connection, so a mutation followed by a separate
    audit-log commit pays that cost twice for what is logically one action."""
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
    if commit:
        await db.commit()
