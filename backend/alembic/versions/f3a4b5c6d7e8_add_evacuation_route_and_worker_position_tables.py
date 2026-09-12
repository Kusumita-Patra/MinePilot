"""add evacuation_routes, worker_positions tables

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-09-13 09:20:00.000000

EvacuationRoute is versioned rather than mutated in place: a route
invalidated by a new hazard is marked INVALIDATED and a fresh
route_version+1 row is created (superseded_by_route_id links them). Note the
self-referential FK is added via a separate op.create_foreign_key call after
the table exists, since a column can't self-FK inline within its own
CREATE TABLE definition's column list ordering here.

WorkerPosition is a live cache — one row per worker, upserted — mirroring
the existing Sensor table's pattern, not TelemetryReading's append-only
history. source_type defaults to SIMULATED since no real underground
personnel-tracking hardware exists in this project.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3a4b5c6d7e8'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    route_status = sa.Enum('ACTIVE', 'INVALIDATED', 'COMPLETED', name='evacuation_route_status')
    source_type = sa.Enum('SIMULATED', 'REAL_TRACKER', 'MANUAL', name='worker_position_source_type')
    evac_status = sa.Enum(
        'NOT_AFFECTED', 'EVACUATION_ASSIGNED', 'MOVING', 'DELAYED', 'ROUTE_CHANGED', 'SAFE_AT_EXIT',
        'UNACCOUNTED', 'TRACKING_LOST', name='worker_evacuation_status',
    )

    op.create_table(
        'evacuation_routes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('emergency_event_id', sa.UUID(), nullable=False),
        sa.Column('worker_id', sa.UUID(), nullable=False),
        sa.Column('origin_node_id', sa.UUID(), nullable=False),
        sa.Column('destination_exit_id', sa.UUID(), nullable=False),
        sa.Column('node_path', sa.JSON(), nullable=False),
        sa.Column('total_distance', sa.Float(), nullable=False),
        sa.Column('eta_seconds', sa.Integer(), nullable=False),
        sa.Column('safety_score', sa.Float(), nullable=False),
        sa.Column('hazards_avoided', sa.JSON(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('route_version', sa.Integer(), server_default='1', nullable=False),
        sa.Column('status', route_status, server_default='ACTIVE', nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('invalidated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('superseded_by_route_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['emergency_event_id'], ['emergency_events.id'], name=op.f('fk_evacuation_routes_emergency_event_id_emergency_events')),
        sa.ForeignKeyConstraint(['worker_id'], ['users.id'], name=op.f('fk_evacuation_routes_worker_id_users')),
        sa.ForeignKeyConstraint(['origin_node_id'], ['evacuation_nodes.id'], name=op.f('fk_evacuation_routes_origin_node_id_evacuation_nodes')),
        sa.ForeignKeyConstraint(['destination_exit_id'], ['evacuation_exits.id'], name=op.f('fk_evacuation_routes_destination_exit_id_evacuation_exits')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_evacuation_routes')),
    )
    op.create_foreign_key(
        op.f('fk_evacuation_routes_superseded_by_route_id_evacuation_routes'),
        'evacuation_routes', 'evacuation_routes', ['superseded_by_route_id'], ['id'],
    )
    op.create_index('ix_evacuation_routes_emergency_event_id', 'evacuation_routes', ['emergency_event_id'])
    op.create_index('ix_evacuation_routes_worker_id', 'evacuation_routes', ['worker_id'])
    op.create_index(
        'ix_evacuation_routes_event_worker_status', 'evacuation_routes', ['emergency_event_id', 'worker_id', 'status']
    )

    op.create_table(
        'worker_positions',
        sa.Column('worker_id', sa.UUID(), nullable=False),
        sa.Column('current_node_id', sa.UUID(), nullable=True),
        sa.Column('sector_id', sa.String(), nullable=True),
        sa.Column('source_type', source_type, server_default='SIMULATED', nullable=False),
        sa.Column('status', evac_status, server_default='NOT_AFFECTED', nullable=False),
        sa.Column('active_route_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['worker_id'], ['users.id'], name=op.f('fk_worker_positions_worker_id_users')),
        sa.ForeignKeyConstraint(['current_node_id'], ['evacuation_nodes.id'], name=op.f('fk_worker_positions_current_node_id_evacuation_nodes')),
        sa.ForeignKeyConstraint(['active_route_id'], ['evacuation_routes.id'], name=op.f('fk_worker_positions_active_route_id_evacuation_routes')),
        sa.PrimaryKeyConstraint('worker_id', name=op.f('pk_worker_positions')),
    )


def downgrade() -> None:
    op.drop_table('worker_positions')
    op.execute('DROP TYPE IF EXISTS worker_evacuation_status')
    op.execute('DROP TYPE IF EXISTS worker_position_source_type')

    op.drop_index('ix_evacuation_routes_event_worker_status', table_name='evacuation_routes')
    op.drop_index('ix_evacuation_routes_worker_id', table_name='evacuation_routes')
    op.drop_index('ix_evacuation_routes_emergency_event_id', table_name='evacuation_routes')
    op.drop_constraint(
        op.f('fk_evacuation_routes_superseded_by_route_id_evacuation_routes'), 'evacuation_routes', type_='foreignkey'
    )
    op.drop_table('evacuation_routes')
    op.execute('DROP TYPE IF EXISTS evacuation_route_status')
