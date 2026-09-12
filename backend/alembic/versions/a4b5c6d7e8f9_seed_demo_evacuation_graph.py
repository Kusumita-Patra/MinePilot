"""seed demo evacuation graph (16 nodes / 22 edges / 2 exits)

Revision ID: a4b5c6d7e8f9
Revises: f3a4b5c6d7e8
Create Date: 2026-09-13 09:30:00.000000

Pure data migration — no schema change. Kept separate from e2f3a4b5c6d7
(the schema migration) purely so this large literal coordinate table is
reviewable/regenerable independently.

Coordinates are a judgment call, not derived from any survey data (none
exists in this codebase): clustered around the existing procedural
network's shaft origin (0,0), at depths matching the frontend's own
LEVELS.level1=-15 (north wall) / LEVELS.level2=-30 (main pit) constants
(src/components/digital-twin/sectors.ts), staying well inside the
procedural terrain's ~520-unit radius, so the new evacuation-graph layer
renders inside the existing mine visualization rather than floating
separately. The two EXIT nodes sit at world_y=0 (surface).

Each edge's sector_id is simplified to its "from" node's sector — a
modeling simplification for this hand-authored seed (real
blueprint-derived edges, via evacuation_graph_service.derive_from_blueprint,
get their sector_id from the source BlueprintSection instead).
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a4b5c6d7e8f9'
down_revision: Union[str, None] = 'f3a4b5c6d7e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SECTOR_NORTH_WALL = 'sector_north_wall'
_SECTOR_MAIN_PIT = 'sector_main_pit'
_SECTOR_DEEP_SHAFT_B = 'sector_deep_shaft_b'
_SECTOR_SURFACE_CONVEYOR = 'sector_surface_conveyor'

# (key, node_type, sector, x, y[=depth], z, label)
_NODES = [
    ('n1', 'JUNCTION', _SECTOR_NORTH_WALL, 60, -15, 40, 'North Wall Junction 1'),
    ('n2', 'JUNCTION', _SECTOR_NORTH_WALL, 130, -15, 20, 'North Wall Junction 2'),
    ('n3', 'JUNCTION', _SECTOR_NORTH_WALL, 190, -15, -30, 'North Wall Junction 3'),
    ('n4', 'WORK_AREA', _SECTOR_NORTH_WALL, 210, -15, 90, 'North Wall Work Area'),
    ('n_exit', 'EXIT', _SECTOR_NORTH_WALL, 260, 0, 110, 'North Escape Raise'),
    ('m1', 'JUNCTION', _SECTOR_MAIN_PIT, -60, -30, -60, 'Main Pit Junction 1'),
    ('m2', 'JUNCTION', _SECTOR_MAIN_PIT, -10, -30, -90, 'Main Pit Junction 2'),
    ('m3', 'JUNCTION', _SECTOR_MAIN_PIT, 70, -30, -110, 'Main Pit Junction 3'),
    ('m4', 'WORK_AREA', _SECTOR_MAIN_PIT, -110, -30, -40, 'Main Pit Work Area'),
    ('m5', 'JUNCTION', _SECTOR_MAIN_PIT, 20, -30, 10, 'Main Pit Junction 4'),
    ('sb1', 'JUNCTION', _SECTOR_DEEP_SHAFT_B, 0, -30, 0, 'Deep Shaft B — Pit Level'),
    ('sb3', 'REFUGE_CHAMBER', _SECTOR_DEEP_SHAFT_B, 0, -22, 0, 'Deep Shaft B Refuge Chamber'),
    ('sb2', 'JUNCTION', _SECTOR_DEEP_SHAFT_B, 0, -15, 0, 'Deep Shaft B — North Wall Level'),
    ('sc1', 'JUNCTION', _SECTOR_SURFACE_CONVEYOR, 0, 0, 0, 'Shaft Collar'),
    ('sc_exit', 'EXIT', _SECTOR_SURFACE_CONVEYOR, 10, 0, 40, 'Main Shaft Exit'),
    ('sc2', 'WORK_AREA', _SECTOR_SURFACE_CONVEYOR, 50, 0, 50, 'Surface Conveyor Work Area'),
]

# (from_key, to_key, distance_m)
_EDGES = [
    ('n1', 'n2', 80), ('n2', 'n3', 85), ('n2', 'n4', 100), ('n3', 'n4', 130),
    ('n4', 'n_exit', 60), ('n1', 'n3', 140),
    ('m1', 'm2', 70), ('m2', 'm3', 95), ('m1', 'm4', 75), ('m2', 'm5', 110),
    ('m3', 'm5', 130), ('m3', 'm1', 160), ('m4', 'm2', 120),
    ('n1', 'sb2', 90), ('n3', 'sb2', 150), ('m5', 'sb1', 40),
    ('sb1', 'sb3', 20), ('sb3', 'sb2', 20), ('sb2', 'sc1', 45),
    ('sc1', 'sc_exit', 45), ('sc1', 'sc2', 55), ('sc2', 'sc_exit', 35),
]

_EXITS = [
    ('n_exit', 'North Escape Raise', _SECTOR_NORTH_WALL),
    ('sc_exit', 'Main Shaft Exit', _SECTOR_SURFACE_CONVEYOR),
]


def upgrade() -> None:
    node_type = postgresql.ENUM(
        'JUNCTION', 'EXIT', 'REFUGE_CHAMBER', 'WORK_AREA', name='evacuation_node_type', create_type=False
    )

    nodes_table = sa.table(
        'evacuation_nodes',
        sa.column('id', sa.UUID()), sa.column('node_type', node_type), sa.column('sector_id', sa.String()),
        sa.column('world_x', sa.Float()), sa.column('world_y', sa.Float()), sa.column('world_z', sa.Float()),
        sa.column('label', sa.String()),
    )
    edges_table = sa.table(
        'evacuation_edges',
        sa.column('id', sa.UUID()), sa.column('from_node_id', sa.UUID()), sa.column('to_node_id', sa.UUID()),
        sa.column('sector_id', sa.String()), sa.column('distance', sa.Float()),
    )
    exits_table = sa.table(
        'evacuation_exits',
        sa.column('id', sa.UUID()), sa.column('node_id', sa.UUID()), sa.column('name', sa.String()),
        sa.column('sector_id', sa.String()),
    )

    node_ids = {key: uuid.uuid4() for key, *_ in _NODES}

    op.bulk_insert(
        nodes_table,
        [
            {
                'id': node_ids[key], 'node_type': ntype, 'sector_id': sector,
                'world_x': float(x), 'world_y': float(y), 'world_z': float(z), 'label': label,
            }
            for key, ntype, sector, x, y, z, label in _NODES
        ],
    )

    node_sector = {key: sector for key, _, sector, *_ in _NODES}
    op.bulk_insert(
        edges_table,
        [
            {
                'id': uuid.uuid4(), 'from_node_id': node_ids[from_key], 'to_node_id': node_ids[to_key],
                'sector_id': node_sector[from_key], 'distance': float(dist),
            }
            for from_key, to_key, dist in _EDGES
        ],
    )

    op.bulk_insert(
        exits_table,
        [
            {'id': uuid.uuid4(), 'node_id': node_ids[key], 'name': name, 'sector_id': sector}
            for key, name, sector in _EXITS
        ],
    )


def downgrade() -> None:
    # Demo seed data only — safe to blanket-clear these three tables since
    # nothing else in this migration chain writes to them before this point.
    op.execute('DELETE FROM evacuation_exits')
    op.execute('DELETE FROM evacuation_edges')
    op.execute('DELETE FROM evacuation_nodes')
