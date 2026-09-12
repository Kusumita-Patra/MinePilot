"""add environmental governance tables, extend sensor registry, add water metrics

Revision ID: a7c9e1f3b5d7
Revises: f6a7b8c9d0e1
Create Date: 2026-09-12 09:00:00.000000

Foundational schema for the Sustainability module: EnvironmentalRequirement
(admin-configurable environmental thresholds, same shape as
ComplianceRequirement/AlertRule), an environmental extension of the existing
SensorConfig registry (new SensorType values + a source_type column so
simulated/manual environmental sensors are never mistaken for real hardware),
EnvironmentalReading (a generic-parameter time-series table for those
sensors, since the frozen SensorFrame/TelemetryReading contract cannot carry
water/air/energy metrics), and WaterMetric (the flagship daily water-balance
aggregate table).

data_source_type is referenced by two tables in this migration, so it's
created once via raw SQL and referenced elsewhere with create_type=False —
same technique d4e5f6a7b8c9 uses for reusing the already-existing
`user_role` type.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a7c9e1f3b5d7'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_SENSOR_TYPES = [
    'PM10', 'PM2_5', 'SO2', 'NOX', 'WATER_PH', 'TURBIDITY', 'TDS',
    'WATER_FLOW', 'WATER_LEVEL', 'ENERGY_METER', 'RAINFALL',
]


def upgrade() -> None:
    # Each ADD VALUE is safe outside a transaction that inserts a row using
    # it — nothing in this migration does, matching the a1b2c3d4e5f6 precedent.
    for value in _NEW_SENSOR_TYPES:
        op.execute(f"ALTER TYPE sensor_type ADD VALUE IF NOT EXISTS '{value}'")

    op.execute(
        "CREATE TYPE data_source_type AS ENUM "
        "('REAL_SENSOR', 'SIMULATED_SENSOR', 'MANUAL_ENTRY', 'CALCULATED', 'AI_ESTIMATE')"
    )
    op.execute(
        "CREATE TYPE environmental_category AS ENUM "
        "('AIR', 'WATER', 'WASTE', 'EMISSIONS', 'LAND', 'NOISE', 'BIODIVERSITY', 'RECLAMATION', 'OTHER')"
    )
    op.execute("CREATE TYPE sensor_source_type AS ENUM ('REAL', 'SIMULATED', 'MANUAL')")

    data_source_type = postgresql.ENUM(
        'REAL_SENSOR', 'SIMULATED_SENSOR', 'MANUAL_ENTRY', 'CALCULATED', 'AI_ESTIMATE',
        name='data_source_type', create_type=False,
    )
    environmental_category = postgresql.ENUM(
        'AIR', 'WATER', 'WASTE', 'EMISSIONS', 'LAND', 'NOISE', 'BIODIVERSITY', 'RECLAMATION', 'OTHER',
        name='environmental_category', create_type=False,
    )
    sensor_source_type = postgresql.ENUM('REAL', 'SIMULATED', 'MANUAL', name='sensor_source_type', create_type=False)

    op.add_column(
        'sensor_configs',
        sa.Column('source_type', sensor_source_type, server_default='REAL', nullable=False),
    )

    op.create_table(
        'environmental_requirements',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('category', environmental_category, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('parameter', sa.String(), nullable=False),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('warning_threshold', sa.Float(), nullable=True),
        sa.Column('critical_threshold', sa.Float(), nullable=True),
        sa.Column('regulatory_reference', sa.String(), nullable=True),
        sa.Column('authority', sa.String(), nullable=True),
        sa.Column('frequency', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('updated_by', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(
            ['created_by'], ['users.id'], name=op.f('fk_environmental_requirements_created_by_users')
        ),
        sa.ForeignKeyConstraint(
            ['updated_by'], ['users.id'], name=op.f('fk_environmental_requirements_updated_by_users')
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_environmental_requirements')),
    )

    op.create_table(
        'environmental_readings',
        sa.Column('id', sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column('sensor_config_id', sa.UUID(), nullable=False),
        sa.Column('parameter', sa.String(), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('data_source', data_source_type, nullable=False),
        sa.Column('recorded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(
            ['sensor_config_id'], ['sensor_configs.id'],
            name=op.f('fk_environmental_readings_sensor_config_id_sensor_configs'),
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_environmental_readings')),
    )
    op.create_index(
        'ix_environmental_readings_sensor_recorded', 'environmental_readings', ['sensor_config_id', 'recorded_at']
    )

    op.create_table(
        'water_metrics',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('sector_id', sa.String(), nullable=True),
        sa.Column('recorded_date', sa.Date(), nullable=False),
        sa.Column('water_consumed_m3', sa.Float(), nullable=False),
        sa.Column('water_extracted_m3', sa.Float(), nullable=False),
        sa.Column('water_reused_m3', sa.Float(), nullable=False),
        sa.Column('water_discharged_m3', sa.Float(), nullable=False),
        sa.Column('rainwater_collected_m3', sa.Float(), nullable=True),
        sa.Column('production_tonnes', sa.Float(), nullable=True),
        sa.Column('data_source', data_source_type, nullable=False),
        sa.Column('created_by', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_water_metrics_created_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_water_metrics')),
        sa.UniqueConstraint('sector_id', 'recorded_date', name='uq_water_metrics_sector_date'),
    )
    op.create_index('ix_water_metrics_recorded_date', 'water_metrics', ['recorded_date'])


def downgrade() -> None:
    op.drop_index('ix_water_metrics_recorded_date', table_name='water_metrics')
    op.drop_table('water_metrics')

    op.drop_index('ix_environmental_readings_sensor_recorded', table_name='environmental_readings')
    op.drop_table('environmental_readings')

    op.drop_table('environmental_requirements')

    op.drop_column('sensor_configs', 'source_type')

    op.execute('DROP TYPE IF EXISTS sensor_source_type')
    op.execute('DROP TYPE IF EXISTS environmental_category')
    op.execute('DROP TYPE IF EXISTS data_source_type')
    # The 11 sensor_type labels added above are never removed — Postgres has
    # no cheap "DROP VALUE", same rationale as a1b2c3d4e5f6's downgrade.
