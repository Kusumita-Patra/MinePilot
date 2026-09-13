"""add SUSTAINABILITY_TARGET source type, nullable corrective_actions.created_by, seed sustainability.simulate capability

Revision ID: f9a0b1c2d3e4
Revises: e8f9a0b1c2d3
Create Date: 2026-09-13 10:05:00.000000

P3 — Energy + Waste + Land Sustainability. The sustainability simulator
creates corrective actions with no human actor (system-generated when a
target is repeatedly breached), so corrective_actions.created_by must become
nullable, and needs its own source_type distinct from MANUAL for correct
filtering (see corrective_action_service.create_system_action /
list_open_environmental). Also seeds the new `sustainability.simulate`
capability (mine_manager-grantable, default False), mirroring
emergency.simulate's exact precedent from d1e2f3a4b5c6.

Each statement commits individually (see e8f9a0b1c2d3's module docstring for
why — the Supavisor pooler doesn't reliably preserve one physical backend
across an uncommitted multi-statement migration transaction). The new enum
value is never referenced as a literal within this same migration, so the
Postgres 12+ "ADD VALUE inside a transaction" restriction doesn't apply
here regardless.
"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f9a0b1c2d3e4'
down_revision: Union[str, None] = 'e8f9a0b1c2d3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("ALTER TYPE corrective_action_source_type ADD VALUE IF NOT EXISTS 'SUSTAINABILITY_TARGET'"))
    bind.commit()

    bind.execute(sa.text("ALTER TABLE corrective_actions ALTER COLUMN created_by DROP NOT NULL"))
    bind.commit()

    bind.execute(
        sa.text(
            "INSERT INTO role_permissions (id, role, capability, allowed) "
            "VALUES (:id, 'mine_manager', 'sustainability.simulate', false) "
            "ON CONFLICT DO NOTHING"
        ),
        {"id": str(uuid.uuid4())},
    )
    bind.commit()


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("DELETE FROM role_permissions WHERE role = 'mine_manager' AND capability = 'sustainability.simulate'"))
    bind.commit()
    bind.execute(sa.text("ALTER TABLE corrective_actions ALTER COLUMN created_by SET NOT NULL"))
    bind.commit()
    # Postgres cannot drop a single enum value — leaving SUSTAINABILITY_TARGET
    # in the type on downgrade is the standard accepted limitation for
    # ADD VALUE migrations in this codebase (see user_role's own precedent).
