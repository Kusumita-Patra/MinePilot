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
    """Catches "already exists"/"does not exist yet" only, not a
    Python-level pre-check — and COMMITS THE REAL OUTER TRANSACTION after
    every statement, not just a SAVEPOINT.

    Debugged live, twice: (1) a SELECT immediately before a CREATE TYPE, in
    the SAME uncommitted alembic migration transaction, showed the type NOT
    existing — and the very next statement still raised
    DuplicateObjectError. (2) after switching to SAVEPOINT-per-statement
    (commits the sub-transaction but leaves the OUTER transaction
    uncommitted), CREATE TABLE then failed with "type alarm_state does not
    exist" even though it had just been created and savepoint-committed
    moments earlier in the same outer transaction.

    Both point to the same cause: Supabase's Supavisor pooler in
    transaction-pooling mode does not guarantee one physical backend for
    the life of a single *uncommitted* logical transaction — different
    statements can land on different backends, and an uncommitted change
    on backend A is invisible to backend B. A real COMMIT is the only thing
    guaranteed to be visible everywhere (ordinary Postgres MVCC), so this
    function commits after every single statement rather than relying on
    savepoints or transactional atomicity across the whole migration.
    """
    bind = op.get_bind()
    try:
        bind.execute(sa.text(sql))
        bind.commit()
    except ProgrammingError as exc:
        bind.rollback()
        if "already exists" not in str(exc):
            raise


def upgrade() -> None:
    _execute_idempotent("CREATE TYPE alarm_state AS ENUM ('SAFE', 'CAUTION', 'DANGER')")
    _execute_idempotent("CREATE TYPE alarm_light_pattern AS ENUM ('SOLID', 'PULSE', 'STROBE')")
    _execute_idempotent("CREATE TYPE alarm_sound_pattern AS ENUM ('SILENT', 'CHIME', 'SIREN')")

    _execute_idempotent(
        """
        CREATE TABLE alarm_configs (
            id UUID NOT NULL,
            state alarm_state NOT NULL,
            light_pattern alarm_light_pattern NOT NULL,
            sound_pattern alarm_sound_pattern NOT NULL,
            is_enabled BOOLEAN DEFAULT true NOT NULL,
            updated_by UUID,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
            CONSTRAINT pk_alarm_configs PRIMARY KEY (id),
            CONSTRAINT uq_alarm_configs_state UNIQUE (state),
            CONSTRAINT fk_alarm_configs_updated_by_users FOREIGN KEY(updated_by) REFERENCES users (id)
        )
        """
    )

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
