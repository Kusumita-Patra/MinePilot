"""align evacuation graph sector_ids with T2's real telemetry sectors

Revision ID: b5c6d7e8f9a0
Revises: a4b5c6d7e8f9
Create Date: 2026-09-12 20:45:00.000000

Bug found via live end-to-end testing: T2's actual data_generator.py
SECTORS list is `["sector_north_wall", "sector_south_face", "sector_shaft_b",
"sector_conveyor_3"]` — the real values that flow through telemetry and land
in EmergencyEvent.trigger_sector_id. The previous migration
(a4b5c6d7e8f9) instead reused the 3D digital twin's OWN separate sector
taxonomy (sector_main_pit / sector_deep_shaft_b / sector_surface_conveyor,
src/components/digital-twin/sectors.ts) for 3 of its 4 sectors — a
pre-existing mismatch between the twin's cosmetic sector naming and T2's
real telemetry contract that predates this module (also present in
blueprint/sensor-placement code, out of scope to fix wholesale here).

For the Emergency module specifically this is safety-critical, not
cosmetic: evacuation_pathfinding_service.worst_active_severity_by_sector
matches an active EmergencyEvent's trigger_sector_id against
EvacuationEdge.sector_id to decide which edges to hard-exclude. With the
mismatched names, a REAL organically-detected hazard in "sector_shaft_b" or
"sector_conveyor_3" would never match any edge's sector_id, silently
disabling the hard-exclusion safety guarantee for 3 of the mine's 4
sectors — routes would look "safe" while actually being computed as if no
hazard existed there at all. Confirmed live: two real events
(sector_shaft_b, sector_conveyor_3) were auto-detected from the live
telemetry stream during demo verification, neither matching any seeded
edge.

Fix: rename in place (pure data migration, no schema/topology change):
  sector_main_pit        -> sector_south_face
  sector_deep_shaft_b    -> sector_shaft_b
  sector_surface_conveyor-> sector_conveyor_3
  sector_north_wall unchanged (already correct).
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b5c6d7e8f9a0'
down_revision: Union[str, None] = 'a4b5c6d7e8f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_RENAMES = [
    ('sector_main_pit', 'sector_south_face'),
    ('sector_deep_shaft_b', 'sector_shaft_b'),
    ('sector_surface_conveyor', 'sector_conveyor_3'),
]
_TABLES = ['evacuation_nodes', 'evacuation_edges', 'evacuation_exits']


def upgrade() -> None:
    for table in _TABLES:
        for old, new in _RENAMES:
            op.execute(f"UPDATE {table} SET sector_id = '{new}' WHERE sector_id = '{old}'")


def downgrade() -> None:
    for table in _TABLES:
        for old, new in _RENAMES:
            op.execute(f"UPDATE {table} SET sector_id = '{old}' WHERE sector_id = '{new}'")
