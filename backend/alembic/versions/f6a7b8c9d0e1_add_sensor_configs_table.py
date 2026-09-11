"""add sensor_configs table (administrator-owned sensor registry)

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-09-11 14:00:00.000000

sensor_configs is separate from the existing `sensors` table (a pure
telemetry-ingestion cache, auto-upserted with no admin involvement) — this is
the administrator-owned registry: name, type, spatial placement on the
blueprint, thresholds, calibration, lifecycle. `sensor_id` is a plain unique
string, not a foreign key to `sensors.sensor_id`, so a sensor can be
registered/placed before it has ever sent a telemetry frame.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'sensor_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('sensor_id', sa.String(), nullable=False),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column(
            'sensor_type',
            sa.Enum(
                'METHANE', 'CARBON_MONOXIDE', 'TEMPERATURE', 'VENTILATION', 'HUMIDITY',
                'PRESSURE', 'VIBRATION', 'DUST', 'ELECTRICAL', 'NOISE',
                name='sensor_type',
            ),
            nullable=False,
        ),
        sa.Column('manufacturer', sa.String(), nullable=True),
        sa.Column('model', sa.String(), nullable=True),
        sa.Column(
            'status',
            sa.Enum('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'RETIRED', name='sensor_config_status'),
            server_default='ACTIVE',
            nullable=False,
        ),
        sa.Column('blueprint_id', sa.UUID(), nullable=False),
        sa.Column('section_id', sa.UUID(), nullable=True),
        sa.Column('sector_id', sa.String(), nullable=False),
        sa.Column('level_label', sa.String(), nullable=False),
        sa.Column('depth', sa.Float(), nullable=False),
        sa.Column('pixel_x', sa.Float(), nullable=False),
        sa.Column('pixel_y', sa.Float(), nullable=False),
        sa.Column('warning_threshold', sa.Float(), nullable=True),
        sa.Column('critical_threshold', sa.Float(), nullable=True),
        sa.Column('installation_date', sa.Date(), nullable=True),
        sa.Column('last_calibration_at', sa.Date(), nullable=True),
        sa.Column('next_calibration_at', sa.Date(), nullable=True),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ['blueprint_id'], ['mine_blueprints.id'], name=op.f('fk_sensor_configs_blueprint_id_mine_blueprints')
        ),
        sa.ForeignKeyConstraint(
            ['section_id'], ['blueprint_sections.id'], name=op.f('fk_sensor_configs_section_id_blueprint_sections')
        ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_sensor_configs_created_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_sensor_configs')),
        sa.UniqueConstraint('sensor_id', name='uq_sensor_configs_sensor_id'),
    )
    op.create_index(op.f('ix_sensor_configs_status'), 'sensor_configs', ['status'])
    op.create_index(op.f('ix_sensor_configs_sector_id'), 'sensor_configs', ['sector_id'])


def downgrade() -> None:
    op.drop_index(op.f('ix_sensor_configs_sector_id'), table_name='sensor_configs')
    op.drop_index(op.f('ix_sensor_configs_status'), table_name='sensor_configs')
    op.drop_table('sensor_configs')
    op.execute('DROP TYPE IF EXISTS sensor_config_status')
    op.execute('DROP TYPE IF EXISTS sensor_type')
