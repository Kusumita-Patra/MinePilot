from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

settings = get_settings()

# CLAUDE.md's statement_cache_size=0 / prepared_statement_cache_size=0 combo
# disables asyncpg's own client-side statement cache, but Supabase's shared
# transaction pooler can still hand two different clients the same backend
# session and asyncpg's default sequential statement naming ("__asyncpg_stmt_N__")
# collides across them, raising DuplicatePreparedStatementError. Per SQLAlchemy's
# own asyncpg dialect docs ("Prepared Statement Name with PGBouncer"), the fix is
# a NullPool (never hold a pooled connection across requests) plus a UUID-based
# prepared_statement_name_func so names can never collide.
engine = create_async_engine(
    settings.async_database_url,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
    },
)

AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
