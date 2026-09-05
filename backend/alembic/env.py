import asyncio
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy.engine import Connection

from alembic import context

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.database import engine  # noqa: E402 (shares the same statement_cache_size=0 setup as the app)
from app.models import *  # noqa: E402,F401,F403

config = context.config
settings = get_settings()
# configparser treats "%" as interpolation syntax, so a percent-encoded
# password (e.g. "%40" for a literal "@") must be escaped as "%%" here.
_db_url = settings.async_database_url.render_as_string(hide_password=False).replace("%", "%%")
config.set_main_option("sqlalchemy.url", _db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
