"""add sustainability_scores, sustainability_targets tables

Revision ID: c9e1a3b5d7f9
Revises: b8d0f2a4c6e8
Create Date: 2026-09-12 09:20:00.000000

SustainabilityScore is an append-only snapshot table (one row per category
per computation, taken opportunistically by the service layer — no cron
exists in this codebase). SustainabilityTarget is admin-configured target
data reusing the already-seeded governance.view/governance.edit capabilities
(no new permission rows needed here).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c9e1a3b5d7f9'
down_revision: Union[str, None] = 'b8d0f2a4c6e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    category = sa.Enum(
        'WATER', 'ENERGY', 'WASTE', 'LAND', 'ENVIRONMENTAL', 'SAFETY', 'COMPLIANCE', 'LABOUR', 'OVERALL',
        name='sustainability_category',
    )
    period = sa.Enum('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', name='target_period')
    # data_source_type already exists (created in a7c9e1f3b5d7) — must use
    # postgresql.ENUM with create_type=False to reference it, not a plain
    # sa.Enum: a plain sa.Enum's create_type flag is not reliably honored
    # once it's adapted to the PG dialect during create_table compilation,
    # and would try (and fail) to CREATE TYPE a second time.
    data_source_type = postgresql.ENUM(
        'REAL_SENSOR', 'SIMULATED_SENSOR', 'MANUAL_ENTRY', 'CALCULATED', 'AI_ESTIMATE',
        name='data_source_type', create_type=False,
    )

    op.create_table(
        'sustainability_scores',
        sa.Column('id', sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column('category', category, nullable=False),
        sa.Column('score_pct', sa.Float(), nullable=False),
        sa.Column('methodology_notes', sa.Text(), nullable=False),
        sa.Column('data_source', data_source_type, nullable=False),
        sa.Column('time_range_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('time_range_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('computed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_sustainability_scores')),
    )
    op.create_index(
        'ix_sustainability_scores_category_computed', 'sustainability_scores', ['category', 'computed_at']
    )

    op.create_table(
        'sustainability_targets',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('category', category, nullable=False),
        sa.Column('metric', sa.String(), nullable=False),
        sa.Column('target_value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('period', period, nullable=False),
        sa.Column('warning_percentage', sa.Float(), nullable=True),
        sa.Column('critical_percentage', sa.Float(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_sustainability_targets_created_by_users')),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_sustainability_targets_updated_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_sustainability_targets')),
        sa.UniqueConstraint('category', 'metric', name='uq_sustainability_targets_category_metric'),
    )


def downgrade() -> None:
    op.drop_table('sustainability_targets')

    op.drop_index('ix_sustainability_scores_category_computed', table_name='sustainability_scores')
    op.drop_table('sustainability_scores')

    op.execute('DROP TYPE IF EXISTS target_period')
    op.execute('DROP TYPE IF EXISTS sustainability_category')
