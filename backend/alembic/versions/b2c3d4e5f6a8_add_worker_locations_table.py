"""add worker_locations table (continuous worker geotagging)

Revision ID: b2c3d4e5f6a8
Revises: a1c2d3e4f5b6
Create Date: 2026-09-13 12:00:00.000000

Continuous, always-on worker geotagging — separate from the existing
worker_positions table, which is scoped to the emergency/evacuation
lifecycle (reset on evacuation resolve, driven by evacuation routes). This
table is upserted continuously by a new background task
(worker_geotracking_service) independent of any emergency, reusing the
same evacuation_nodes graph (world_x/y/z) the 3D twin already understands.

Reuses the existing worker_position_source_type enum via
create_type=False (mandatory reuse pattern for enums already created by an
earlier migration — see c9e1a3b5d7f9/d1e2f3a4b5c6's own docstrings).

Each statement commits individually (Supavisor pooler workaround — see
e8f9a0b1c2d3's module docstring for the full rationale).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a8'
down_revision: Union[str, None] = 'a1c2d3e4f5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


worker_position_source_type_enum = postgresql.ENUM(
    'SIMULATED', 'REAL_TRACKER', 'MANUAL', name='worker_position_source_type', create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()

    op.create_table(
        'worker_locations',
        sa.Column('worker_id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('current_node_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('sector_id', sa.String(), nullable=True),
        sa.Column(
            'source_type', worker_position_source_type_enum, nullable=False, server_default='SIMULATED'
        ),
        sa.Column('last_moved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['worker_id'], ['users.id']),
        sa.ForeignKeyConstraint(['current_node_id'], ['evacuation_nodes.id']),
    )
    bind.commit()


def downgrade() -> None:
    bind = op.get_bind()
    op.drop_table('worker_locations')
    bind.commit()
