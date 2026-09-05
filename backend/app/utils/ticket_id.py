from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

SEQUENCE_NAME = "incident_ticket_seq"


async def next_ticket_id(db: AsyncSession) -> str:
    result = await db.execute(text(f"SELECT nextval('{SEQUENCE_NAME}')"))
    seq_value = result.scalar_one()
    return f"INC-{seq_value:04d}"
