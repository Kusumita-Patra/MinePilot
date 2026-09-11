"""add admin_audit_logs, alert_rules, compliance_requirements tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-11 00:10:00.000000

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'admin_audit_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('actor_user_id', sa.UUID(), nullable=False),
        sa.Column('actor_role', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource_type', sa.String(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(
            ['actor_user_id'], ['users.id'], name=op.f('fk_admin_audit_logs_actor_user_id_users')
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_admin_audit_logs')),
    )
    op.create_index(op.f('ix_admin_audit_logs_created_at'), 'admin_audit_logs', ['created_at'])

    op.create_table(
        'alert_rules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('rule_key', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('warning_threshold', sa.Float(), nullable=True),
        sa.Column('critical_threshold', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], name=op.f('fk_alert_rules_updated_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_alert_rules')),
        sa.UniqueConstraint('rule_key', name=op.f('uq_alert_rules_rule_key')),
    )

    op.create_table(
        'compliance_requirements',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column(
            'applies_to',
            sa.Enum('WORKER', 'CONTRACTOR', name='requirement_applies_to'),
            nullable=False,
        ),
        sa.Column('document_type', sa.String(), nullable=False),
        sa.Column('warning_threshold_days', sa.Integer(), nullable=False),
        sa.Column('critical_threshold_days', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_compliance_requirements')),
    )

    # Seed rows so the admin Alert Rules / Compliance Rules pages aren't empty
    # on first load. Values match the examples in the product spec exactly.
    alert_rules_table = sa.table(
        'alert_rules',
        sa.column('id', sa.UUID()),
        sa.column('rule_key', sa.String()),
        sa.column('display_name', sa.String()),
        sa.column('warning_threshold', sa.Float()),
        sa.column('critical_threshold', sa.Float()),
        sa.column('unit', sa.String()),
        sa.column('is_active', sa.Boolean()),
    )
    op.bulk_insert(
        alert_rules_table,
        [
            {
                'id': str(uuid.uuid4()),
                'rule_key': 'gas_concentration',
                'display_name': 'Gas Concentration',
                'warning_threshold': 1.0,
                'critical_threshold': 2.0,
                'unit': '% CH4',
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'rule_key': 'ventilation',
                'display_name': 'Ventilation',
                'warning_threshold': 60.0,
                'critical_threshold': 40.0,
                'unit': '% airflow',
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'rule_key': 'equipment_health',
                'display_name': 'Equipment Health',
                'warning_threshold': 70.0,
                'critical_threshold': 50.0,
                'unit': 'score',
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'rule_key': 'document_expiry',
                'display_name': 'Document Expiry',
                'warning_threshold': 30.0,
                'critical_threshold': 7.0,
                'unit': 'days',
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'rule_key': 'contractor_risk',
                'display_name': 'Contractor Risk',
                'warning_threshold': 60.0,
                'critical_threshold': 80.0,
                'unit': 'score',
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'rule_key': 'incident_risk',
                'display_name': 'Incident Risk',
                'warning_threshold': 50.0,
                'critical_threshold': 100.0,
                'unit': 'score',
                'is_active': True,
            },
        ],
    )

    compliance_requirements_table = sa.table(
        'compliance_requirements',
        sa.column('id', sa.UUID()),
        sa.column('applies_to', sa.Enum('WORKER', 'CONTRACTOR', name='requirement_applies_to')),
        sa.column('document_type', sa.String()),
        sa.column('warning_threshold_days', sa.Integer()),
        sa.column('critical_threshold_days', sa.Integer()),
        sa.column('is_active', sa.Boolean()),
    )
    op.bulk_insert(
        compliance_requirements_table,
        [
            {
                'id': str(uuid.uuid4()),
                'applies_to': 'WORKER',
                'document_type': 'Medical Examination',
                'warning_threshold_days': 30,
                'critical_threshold_days': 7,
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'applies_to': 'WORKER',
                'document_type': 'Safety Training',
                'warning_threshold_days': 60,
                'critical_threshold_days': 30,
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'applies_to': 'WORKER',
                'document_type': 'Competency Certificate',
                'warning_threshold_days': 90,
                'critical_threshold_days': 30,
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'applies_to': 'CONTRACTOR',
                'document_type': 'CLRA Licence',
                'warning_threshold_days': 90,
                'critical_threshold_days': 30,
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'applies_to': 'CONTRACTOR',
                'document_type': 'Insurance',
                'warning_threshold_days': 60,
                'critical_threshold_days': 30,
                'is_active': True,
            },
            {
                'id': str(uuid.uuid4()),
                'applies_to': 'CONTRACTOR',
                'document_type': 'Safety Certificate',
                'warning_threshold_days': 60,
                'critical_threshold_days': 7,
                'is_active': True,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table('compliance_requirements')
    op.execute('DROP TYPE IF EXISTS requirement_applies_to')
    op.drop_table('alert_rules')
    op.drop_index(op.f('ix_admin_audit_logs_created_at'), table_name='admin_audit_logs')
    op.drop_table('admin_audit_logs')
