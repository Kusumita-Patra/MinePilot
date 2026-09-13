"""make sensor_configs.blueprint_id and created_by nullable

Revision ID: a1c2d3e4f5b6
Revises: f9a0b1c2d3e4
Create Date: 2026-09-13 11:00:00.000000

Solves a previously-documented limitation: the sustainability simulator's
ENVIRONMENTAL_ANOMALY scenario could only inject a simulated PM10/PM2.5/
SO2/NOx reading if an administrator had ALREADY registered a matching
SensorConfig — because SensorConfigCreate.blueprint_id and
SensorConfig.created_by were both NOT NULL, and a fresh demo DB may have no
blueprint uploaded and the simulator has no User actor. This mirrors the
exact precedent already set for corrective_actions.created_by
(f9a0b1c2d3e4) for the same reason (a system-generated row with no human
actor/no dependent resource yet). A sensor auto-created with
blueprint_id=None simply has no blueprint-relative placement to render on
the 2D tracer canvas yet (source_type=SIMULATED makes this visually obvious
in the registry) — it is otherwise a fully real, functioning sensor config
row, not a special-cased shape.

Each statement commits individually (Supavisor pooler workaround, see
e8f9a0b1c2d3's module docstring for the full rationale).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1c2d3e4f5b6'
down_revision: Union[str, None] = 'f9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    bind.execute(sa.text("ALTER TABLE sensor_configs ALTER COLUMN blueprint_id DROP NOT NULL"))
    bind.commit()

    bind.execute(sa.text("ALTER TABLE sensor_configs ALTER COLUMN created_by DROP NOT NULL"))
    bind.commit()


def downgrade() -> None:
    bind = op.get_bind()
    bind.execute(sa.text("ALTER TABLE sensor_configs ALTER COLUMN created_by SET NOT NULL"))
    bind.commit()
    bind.execute(sa.text("ALTER TABLE sensor_configs ALTER COLUMN blueprint_id SET NOT NULL"))
    bind.commit()
