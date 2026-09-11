"""add administrator role

Revision ID: a1b2c3d4e5f6
Revises: 3b464ec79ddd
Create Date: 2026-09-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '3b464ec79ddd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only adds the new enum label; it is never referenced by a row in this
    # same migration, so this is safe inside Alembic's transaction on
    # Postgres 12+ (Supabase). No existing users.role values are touched.
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrator'")


def downgrade() -> None:
    # Postgres has no cheap "DROP VALUE" for enum types (it would require
    # rebuilding the type and every column/index that uses it). Since no
    # downgrade path in this project has ever needed to un-add an enum value,
    # this is intentionally a no-op; downgrading past this revision while any
    # user has role='administrator' will fail at the FK/enum level, which is
    # the correct, safe failure mode.
    pass
