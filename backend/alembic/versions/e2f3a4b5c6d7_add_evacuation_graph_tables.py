"""add evacuation_nodes, evacuation_edges, evacuation_exits tables

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-09-13 09:10:00.000000

The mine evacuation graph — this codebase's own authoritative representation,
deliberately not scraped from the frontend's client-only procedural tunnel
network (mineLayout.ts's VeinNet has no server-side form). Nodes carry raw
world coordinates so they can exist independent of any uploaded blueprint;
blueprint_section_id is optional provenance only, populated when derived via
evacuation_graph_service.derive_from_blueprint. Edges are undirected
(traversable both ways) and deliberately carry no stored hazard/cost column —
that's derived at pathfinding time from active EmergencyEvents plus
manually_blocked, which IS persisted since it's a genuine physical closure,
not transient hazard state.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    node_type = sa.Enum('JUNCTION', 'EXIT', 'REFUGE_CHAMBER', 'WORK_AREA', name='evacuation_node_type')

    op.create_table(
        'evacuation_nodes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('node_type', node_type, nullable=False),
        sa.Column('sector_id', sa.String(), nullable=False),
        sa.Column('blueprint_section_id', sa.UUID(), nullable=True),
        sa.Column('world_x', sa.Float(), nullable=False),
        sa.Column('world_y', sa.Float(), nullable=False),
        sa.Column('world_z', sa.Float(), nullable=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(
            ['blueprint_section_id'], ['blueprint_sections.id'], name=op.f('fk_evacuation_nodes_blueprint_section_id_blueprint_sections')
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_evacuation_nodes')),
    )
    op.create_index('ix_evacuation_nodes_sector_id', 'evacuation_nodes', ['sector_id'])

    op.create_table(
        'evacuation_edges',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('from_node_id', sa.UUID(), nullable=False),
        sa.Column('to_node_id', sa.UUID(), nullable=False),
        sa.Column('sector_id', sa.String(), nullable=False),
        sa.Column('distance', sa.Float(), nullable=False),
        sa.Column('blueprint_section_id', sa.UUID(), nullable=True),
        sa.Column('manually_blocked', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('blocked_reason', sa.String(), nullable=True),
        sa.Column('blocked_by', sa.UUID(), nullable=True),
        sa.Column('blocked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['from_node_id'], ['evacuation_nodes.id'], name=op.f('fk_evacuation_edges_from_node_id_evacuation_nodes')),
        sa.ForeignKeyConstraint(['to_node_id'], ['evacuation_nodes.id'], name=op.f('fk_evacuation_edges_to_node_id_evacuation_nodes')),
        sa.ForeignKeyConstraint(
            ['blueprint_section_id'], ['blueprint_sections.id'], name=op.f('fk_evacuation_edges_blueprint_section_id_blueprint_sections')
        ),
        sa.ForeignKeyConstraint(['blocked_by'], ['users.id'], name=op.f('fk_evacuation_edges_blocked_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_evacuation_edges')),
    )
    op.create_index('ix_evacuation_edges_from_to', 'evacuation_edges', ['from_node_id', 'to_node_id'])
    op.create_index('ix_evacuation_edges_sector_id', 'evacuation_edges', ['sector_id'])

    op.create_table(
        'evacuation_exits',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('node_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('sector_id', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('capacity_note', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['node_id'], ['evacuation_nodes.id'], name=op.f('fk_evacuation_exits_node_id_evacuation_nodes')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_evacuation_exits')),
        sa.UniqueConstraint('node_id', name='uq_evacuation_exits_node_id'),
    )


def downgrade() -> None:
    op.drop_table('evacuation_exits')

    op.drop_index('ix_evacuation_edges_sector_id', table_name='evacuation_edges')
    op.drop_index('ix_evacuation_edges_from_to', table_name='evacuation_edges')
    op.drop_table('evacuation_edges')

    op.drop_index('ix_evacuation_nodes_sector_id', table_name='evacuation_nodes')
    op.drop_table('evacuation_nodes')

    op.execute('DROP TYPE IF EXISTS evacuation_node_type')
