"""add corrective_actions table + corrective_actions.manage/.verify permission rows

Revision ID: b8d0f2a4c6e8
Revises: a7c9e1f3b5d7
Create Date: 2026-09-12 09:10:00.000000

CorrectiveAction is a reusable tracker shared across safety incidents,
environmental requirement breaches, inspections, and ad-hoc manual creation.
`corrective_actions.manage` (create/assign/prioritize) and
`corrective_actions.verify` (confirm a completed fix) are seeded here for
mine_manager ONLY, both False by default so applying this migration changes
nothing until an administrator edits a cell — mirrors d4e5f6a7b8c9's
convention exactly. field_worker gets `corrective_actions.verify` for free
via the FIELD_WORKER_FIXED_CAPABILITIES code constant (see
core/permissions.py) and never gets a role_permissions row of its own —
e5f6a7b8c9d0 already established that any field_worker row here would be
dead data, since permission_service.is_allowed/list_matrix never read one.
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b8d0f2a4c6e8'
down_revision: Union[str, None] = 'a7c9e1f3b5d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_CAPABILITIES = ['corrective_actions.manage', 'corrective_actions.verify']


def upgrade() -> None:
    source_type = sa.Enum(
        'INCIDENT', 'ENVIRONMENTAL_REQUIREMENT', 'INSPECTION', 'MANUAL',
        name='corrective_action_source_type',
    )
    priority = sa.Enum('LOW', 'MEDIUM', 'HIGH', 'CRITICAL', name='corrective_action_priority')
    status = sa.Enum('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED', name='corrective_action_status')

    op.create_table(
        'corrective_actions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('source_type', source_type, nullable=False),
        sa.Column('source_id', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('priority', priority, server_default='MEDIUM', nullable=False),
        sa.Column('assigned_to', sa.UUID(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('status', status, server_default='OPEN', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('verification_required', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('verified_by', sa.UUID(), nullable=True),
        sa.Column('verification_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('remarks', sa.Text(), nullable=True),
        sa.Column('evidence_url', sa.String(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['assigned_to'], ['users.id'], name=op.f('fk_corrective_actions_assigned_to_users')),
        sa.ForeignKeyConstraint(['verified_by'], ['users.id'], name=op.f('fk_corrective_actions_verified_by_users')),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_corrective_actions_created_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_corrective_actions')),
    )
    op.create_index('ix_corrective_actions_status', 'corrective_actions', ['status'])
    op.create_index('ix_corrective_actions_source', 'corrective_actions', ['source_type', 'source_id'])
    op.create_index('ix_corrective_actions_due_date', 'corrective_actions', ['due_date'])

    user_role_enum = postgresql.ENUM('mine_manager', 'field_worker', 'administrator', name='user_role', create_type=False)
    role_permissions_table = sa.table(
        'role_permissions',
        sa.column('id', sa.UUID()),
        sa.column('role', user_role_enum),
        sa.column('capability', sa.String()),
        sa.column('allowed', sa.Boolean()),
    )
    op.bulk_insert(
        role_permissions_table,
        [
            {'id': str(uuid.uuid4()), 'role': 'mine_manager', 'capability': capability, 'allowed': False}
            for capability in _NEW_CAPABILITIES
        ],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM role_permissions WHERE role = 'mine_manager' AND capability IN "
        "('corrective_actions.manage', 'corrective_actions.verify')"
    )

    op.drop_index('ix_corrective_actions_due_date', table_name='corrective_actions')
    op.drop_index('ix_corrective_actions_source', table_name='corrective_actions')
    op.drop_index('ix_corrective_actions_status', table_name='corrective_actions')
    op.drop_table('corrective_actions')

    op.execute('DROP TYPE IF EXISTS corrective_action_status')
    op.execute('DROP TYPE IF EXISTS corrective_action_priority')
    op.execute('DROP TYPE IF EXISTS corrective_action_source_type')
