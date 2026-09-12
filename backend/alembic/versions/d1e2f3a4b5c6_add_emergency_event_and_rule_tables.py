"""add emergency_events, emergency_rules tables + emergency capability rows

Revision ID: d1e2f3a4b5c6
Revises: c9e1a3b5d7f9
Create Date: 2026-09-13 09:00:00.000000

Foundational schema for the Emergency Safety & Evacuation module. An
EmergencyEvent is distinct from the existing compliance-workflow Incident
ticket the same reading already opens (trigger_incident_ticket_id is a soft,
non-functional cross-link for traceability only). EmergencyRule follows the
existing AlertRule precedent — one admin-configurable row per hazard type.

EmergencyEvent.severity reuses the ALREADY-EXISTING `risk_level` enum type
(created in the very first migration) — referenced here via
postgresql.ENUM(..., create_type=False), NOT a bare sa.Enum(...), which was
proven this session (migration c9e1a3b5d7f9) to not reliably honor
create_type=False once SQLAlchemy adapts it during create_table compilation.
"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c9e1a3b5d7f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_CAPABILITIES = [
    'emergency.acknowledge',
    'emergency.escalate',
    'emergency.resolve',
    'emergency.configure',
    'emergency.simulate',
]


def upgrade() -> None:
    op.execute("CREATE TYPE hazard_type AS ENUM ('METHANE', 'CARBON_MONOXIDE', 'FIRE', 'FLOOD', 'ROCKFALL', 'EQUIPMENT_FAILURE', 'OTHER')")
    op.execute(
        "CREATE TYPE emergency_event_status AS ENUM "
        "('DETECTED', 'ACTIVE', 'ACKNOWLEDGED', 'ESCALATED', 'EVACUATION_ACTIVE', 'RESOLVED', 'CANCELLED')"
    )

    hazard_type = postgresql.ENUM(
        'METHANE', 'CARBON_MONOXIDE', 'FIRE', 'FLOOD', 'ROCKFALL', 'EQUIPMENT_FAILURE', 'OTHER',
        name='hazard_type', create_type=False,
    )
    emergency_event_status = postgresql.ENUM(
        'DETECTED', 'ACTIVE', 'ACKNOWLEDGED', 'ESCALATED', 'EVACUATION_ACTIVE', 'RESOLVED', 'CANCELLED',
        name='emergency_event_status', create_type=False,
    )
    # risk_level already exists (created in 9e50ad514d2d) — create_type=False
    # so this doesn't try to CREATE TYPE it again (see module docstring).
    risk_level = postgresql.ENUM('NORMAL', 'WARNING', 'CRITICAL', name='risk_level', create_type=False)

    op.create_table(
        'emergency_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('hazard_type', hazard_type, nullable=False),
        sa.Column('severity', risk_level, nullable=False),
        sa.Column('status', emergency_event_status, server_default='DETECTED', nullable=False),
        sa.Column('trigger_sector_id', sa.String(), nullable=False),
        # Deliberately NOT an FK to sensors.sensor_id — the demo
        # /events/simulate endpoint must accept a synthetic sensor id that
        # was never ingested through the real telemetry pipeline. See the
        # matching comment in app/models/emergency_event.py.
        sa.Column('trigger_sensor_id', sa.String(), nullable=True),
        sa.Column('trigger_value', sa.Float(), nullable=True),
        sa.Column('trigger_incident_ticket_id', sa.String(), nullable=True),
        sa.Column('escalation_timeout_seconds', sa.Integer(), nullable=False),
        sa.Column('activated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acknowledged_by', sa.UUID(), nullable=True),
        sa.Column('escalated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('escalated_reason', sa.Text(), nullable=True),
        sa.Column('evacuation_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.UUID(), nullable=True),
        sa.Column('resolution_notes', sa.Text(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by', sa.UUID(), nullable=True),
        sa.Column('cancel_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['trigger_incident_ticket_id'], ['incidents.ticket_id'], name=op.f('fk_emergency_events_trigger_incident_ticket_id_incidents')),
        sa.ForeignKeyConstraint(['acknowledged_by'], ['users.id'], name=op.f('fk_emergency_events_acknowledged_by_users')),
        sa.ForeignKeyConstraint(['resolved_by'], ['users.id'], name=op.f('fk_emergency_events_resolved_by_users')),
        sa.ForeignKeyConstraint(['cancelled_by'], ['users.id'], name=op.f('fk_emergency_events_cancelled_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_emergency_events')),
    )
    op.create_index('ix_emergency_events_status', 'emergency_events', ['status'])
    op.create_index(
        'ix_emergency_events_hazard_sector_status', 'emergency_events', ['hazard_type', 'trigger_sector_id', 'status']
    )

    op.create_table(
        'emergency_rules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('hazard_type', hazard_type, nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('warning_threshold', sa.Float(), nullable=True),
        sa.Column('critical_threshold', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(), nullable=True),
        sa.Column('escalation_timeout_seconds', sa.Integer(), server_default='120', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_emergency_rules_updated_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_emergency_rules')),
        sa.UniqueConstraint('hazard_type', name='uq_emergency_rules_hazard_type'),
    )

    # Seed the one rule this pass actually uses — without it the detection
    # hook in telemetry_service.py has nothing to compare ch4_pct against.
    op.execute(
        f"""
        INSERT INTO emergency_rules (id, hazard_type, display_name, warning_threshold, critical_threshold, unit, escalation_timeout_seconds, is_active)
        VALUES ('{uuid.uuid4()}', 'METHANE', 'Methane (CH4)', 1.0, 2.5, '% CH4', 120, true)
        """
    )

    user_role_enum = postgresql.ENUM('mine_manager', 'field_worker', 'administrator', name='user_role', create_type=False)
    role_permissions_table = sa.table(
        'role_permissions',
        sa.column('id', sa.UUID()),
        sa.column('role', user_role_enum),
        sa.column('capability', sa.String()),
        sa.column('allowed', sa.Boolean()),
    )
    op.bulk_insert(
        role_permissions_table,
        [
            {'id': str(uuid.uuid4()), 'role': 'mine_manager', 'capability': capability, 'allowed': False}
            for capability in _NEW_CAPABILITIES
        ],
    )


def downgrade() -> None:
    op.execute(
        "DELETE FROM role_permissions WHERE role = 'mine_manager' AND capability IN "
        "('emergency.acknowledge', 'emergency.escalate', 'emergency.resolve', 'emergency.configure', 'emergency.simulate')"
    )

    op.drop_table('emergency_rules')

    op.drop_index('ix_emergency_events_hazard_sector_status', table_name='emergency_events')
    op.drop_index('ix_emergency_events_status', table_name='emergency_events')
    op.drop_table('emergency_events')

    op.execute('DROP TYPE IF EXISTS emergency_event_status')
    op.execute('DROP TYPE IF EXISTS hazard_type')
    # risk_level itself is never dropped — it existed before this migration.
