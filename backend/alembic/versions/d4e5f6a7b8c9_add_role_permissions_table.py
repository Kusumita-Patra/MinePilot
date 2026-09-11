"""add role_permissions table (dynamic, admin-editable RBAC)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-11 12:00:00.000000

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Mirrors backend/app/core/permissions.py's CAPABILITIES list. Seed values
# match today's actual hardcoded behavior exactly, so applying this
# migration changes nothing until an administrator edits a row via
# /admin/roles.
_CAPABILITY_DEFAULTS = {
    # capability: (mine_manager_default, field_worker_default)
    'blueprint.write': (False, False),
    'users.view': (True, False),
    'users.manage': (False, False),
    'inspections.schedule': (True, False),
    'incidents.transition': (True, True),
    'incidents.sign_off': (True, False),
    'governance.view': (False, False),
    'governance.edit': (False, False),
    'audit_logs.view': (False, False),
    'system_health.view': (False, False),
}


def upgrade() -> None:
    # user_role already exists (created in 9e50ad514d2d, extended in
    # a1b2c3d4e5f6) — create_type=False so this doesn't try to CREATE TYPE
    # it again.
    user_role_enum = postgresql.ENUM('mine_manager', 'field_worker', 'administrator', name='user_role', create_type=False)

    op.create_table(
        'role_permissions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('role', user_role_enum, nullable=False),
        sa.Column('capability', sa.String(), nullable=False),
        sa.Column('allowed', sa.Boolean(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_role_permissions_updated_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_role_permissions')),
        sa.UniqueConstraint('role', 'capability', name='uq_role_permissions_role_capability'),
    )

    role_permissions_table = sa.table(
        'role_permissions',
        sa.column('id', sa.UUID()),
        sa.column('role', sa.Enum('mine_manager', 'field_worker', 'administrator', name='user_role')),
        sa.column('capability', sa.String()),
        sa.column('allowed', sa.Boolean()),
    )
    rows = []
    for capability, (mgr_default, wkr_default) in _CAPABILITY_DEFAULTS.items():
        rows.append({'id': str(uuid.uuid4()), 'role': 'mine_manager', 'capability': capability, 'allowed': mgr_default})
        rows.append({'id': str(uuid.uuid4()), 'role': 'field_worker', 'capability': capability, 'allowed': wkr_default})
    op.bulk_insert(role_permissions_table, rows)


def downgrade() -> None:
    op.drop_table('role_permissions')
