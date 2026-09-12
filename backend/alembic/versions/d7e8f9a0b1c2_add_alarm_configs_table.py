"""add alarm_configs table (virtual/digital alarm light+sound patterns)

Revision ID: d7e8f9a0b1c2
Revises: c6d7e8f9a0b1
Create Date: 2026-09-12 22:00:00.000000

Previously deferred: configurable alarm light/sound patterns. There is no
real alarm hardware anywhere in this system — `light_pattern`/
`sound_pattern` only ever drive on-screen visuals and a UI label. Seeded
with one row per AlarmState (SAFE/CAUTION/DANGER) so the admin config page
and every consumer always has a complete set to read.
"""
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.exc import ProgrammingError

# revision identifiers, used by Alembic.
revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, None] = 'c6d7e8f9a0b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _execute_idempotent(sql: str) -> None:
    """Catches "already exists" only, not a Python-level pre-check.

    Debugged live: a SELECT immediately before a CREATE TYPE, in the SAME
    alembic migration transaction, showed the type NOT existing — and the
    very next statement still raised DuplicateObjectError. Supabase's
    Supavisor pooler in transaction-pooling mode does not appear to
    guarantee statement-to-statement consistency for DDL the way a plain
    Postgres connection would (each statement can apparently be routed to
    a different backend even mid logical-transaction). A pre-check is
    therefore unreliable here; catching the specific "already exists" error
    per statement is the only reliable guard.

    Runs inside its own SAVEPOINT (begin_nested): a caught error still
    marks the OUTER transaction aborted in Postgres unless the failure is
    isolated to a sub-transaction — without this, the first caught
    "already exists" would silently poison every statement after it with
    "current transaction is aborted" (also hit live while building this).
    """
    bind = op.get_bind()
    savepoint = bind.begin_nested()
    try:
        bind.execute(sa.text(sql))
        savepoint.commit()
    except ProgrammingError as exc:
        savepoint.rollback()
        if "already exists" not in str(exc):
            raise


def upgrade() -> None:
    _execute_idempotent("CREATE TYPE alarm_state AS ENUM ('SAFE', 'CAUTION', 'DANGER')")
    _execute_idempotent("CREATE TYPE alarm_light_pattern AS ENUM ('SOLID', 'PULSE', 'STROBE')")
    _execute_idempotent("CREATE TYPE alarm_sound_pattern AS ENUM ('SILENT', 'CHIME', 'SIREN')")

    bind = op.get_bind()
    savepoint = bind.begin_nested()
    try:
        op.create_table(
            'alarm_configs',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column(
                'state', sa.Enum('SAFE', 'CAUTION', 'DANGER', name='alarm_state', create_type=False), nullable=False
            ),
            sa.Column(
                'light_pattern',
                sa.Enum('SOLID', 'PULSE', 'STROBE', name='alarm_light_pattern', create_type=False),
                nullable=False,
            ),
            sa.Column(
                'sound_pattern',
                sa.Enum('SILENT', 'CHIME', 'SIREN', name='alarm_sound_pattern', create_type=False),
                nullable=False,
            ),
            sa.Column('is_enabled', sa.Boolean(), server_default=sa.true(), nullable=False),
            sa.Column('updated_by', sa.UUID(), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_alarm_configs_updated_by_users')),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_alarm_configs')),
            sa.UniqueConstraint('state', name='uq_alarm_configs_state'),
        )
        savepoint.commit()
    except ProgrammingError as exc:
        savepoint.rollback()
        if "already exists" not in str(exc):
            raise

    _execute_idempotent(
        f"""
        INSERT INTO alarm_configs (id, state, light_pattern, sound_pattern, is_enabled)
        VALUES
            ('{uuid.uuid4()}', 'SAFE', 'SOLID', 'SILENT', true),
            ('{uuid.uuid4()}', 'CAUTION', 'PULSE', 'CHIME', true),
            ('{uuid.uuid4()}', 'DANGER', 'STROBE', 'SIREN', true)
        ON CONFLICT (state) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table('alarm_configs')
    op.execute('DROP TYPE IF EXISTS alarm_sound_pattern')
    op.execute('DROP TYPE IF EXISTS alarm_light_pattern')
    op.execute('DROP TYPE IF EXISTS alarm_state')
