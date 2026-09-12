"""add worker_positions.last_moved_at and manual_stall (delay detection)

Revision ID: c6d7e8f9a0b1
Revises: b5c6d7e8f9a0
Create Date: 2026-09-12 21:30:00.000000

Previously deferred: worker-delay/no-movement detection. `last_moved_at` is
set whenever a worker's SIMULATED position actually advances a hop
(worker_position_service.advance_one_hop succeeding); the escalation loop
compares it against now() to flag WorkerEvacuationStatus.DELAYED.
`manual_stall` is a demo-only override (POST
/api/emergency/workers/positions/{id}/simulate/stall) so the "Worker Not
Moving" demo scenario can be triggered on demand rather than relying on
random simulated drift — the simulator otherwise always advances a worker
exactly one hop per tick, so there is no organic way to reach "delayed"
without an explicit trigger.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c6d7e8f9a0b1'
down_revision: Union[str, None] = 'b5c6d7e8f9a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('worker_positions', sa.Column('last_moved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'worker_positions',
        sa.Column('manual_stall', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE worker_positions SET last_moved_at = updated_at")


def downgrade() -> None:
    op.drop_column('worker_positions', 'manual_stall')
    op.drop_column('worker_positions', 'last_moved_at')
