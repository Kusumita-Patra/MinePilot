"""remove field_worker rows from role_permissions (now fixed, not editable)

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-11 13:00:00.000000

Field Inspector (the field_worker role) access was made fixed by product
decision — they can only ever transition incidents (assign/resolve/escalate),
never anything admin-editable. app/services/permission_service.py now
hardcodes this (FIELD_WORKER_FIXED_CAPABILITIES in core/permissions.py)
instead of reading from this table, so the seeded field_worker rows from
d4e5f6a7b8c9 are dead data — this just removes them for hygiene. Nothing in
the app queries role_permissions for field_worker anymore either way.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(sa.text("DELETE FROM role_permissions WHERE role = 'field_worker'"))


def downgrade() -> None:
    # Re-seeding the exact prior rows isn't meaningful (they were never read
    # dynamically even before this migration's app-code counterpart landed);
    # nothing depends on them existing.
    pass
