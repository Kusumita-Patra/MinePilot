"""add energy_metrics, waste_metrics, land_metrics tables (P3 sustainability)

Revision ID: e8f9a0b1c2d3
Revises: d7e8f9a0b1c2
Create Date: 2026-09-13 10:00:00.000000

P3 — Energy + Waste + Land Sustainability. These three tables mirror
WaterMetric's exact shape (one row per sector per day, sector_id nullable =
mine-wide, data_source provenance). SustainabilityCategory already has
ENERGY/WASTE/LAND (added ahead of time in c9e1a3b5d7f9) — no enum change
needed there. Reuses the existing `data_source_type` enum via
postgresql.ENUM(..., create_type=False), the mandatory reuse pattern in this
codebase (a bare sa.Enum(...) does not reliably honor create_type=False once
adapted during create_table compilation — see c9e1a3b5d7f9/d1e2f3a4b5c6).

Each CREATE TABLE is wrapped in a real-commit idempotent guard, not just
op.create_table directly: Supabase's Supavisor pooler in transaction-pooling
mode was found (live, while building the Emergency module this session) to
not guarantee one physical backend connection for the life of an
*uncommitted* multi-statement migration transaction — a caught "already
exists" can otherwise poison the rest of the migration with "current
transaction is aborted". Committing after each table is the only pattern
proven reliable against this pooler.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql
from sqlalchemy.exc import ProgrammingError

# revision identifiers, used by Alembic.
revision: str = 'e8f9a0b1c2d3'
down_revision: Union[str, None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_table_idempotent(create_fn) -> None:
    bind = op.get_bind()
    try:
        create_fn()
        bind.commit()
    except ProgrammingError as exc:
        bind.rollback()
        if "already exists" not in str(exc):
            raise


def upgrade() -> None:
    data_source_type = postgresql.ENUM(
        'REAL_SENSOR', 'SIMULATED_SENSOR', 'MANUAL_ENTRY', 'CALCULATED', 'AI_ESTIMATE',
        name='data_source_type', create_type=False,
    )

    def _create_energy_metrics():
        op.create_table(
            'energy_metrics',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('sector_id', sa.String(), nullable=True),
            sa.Column('recorded_date', sa.Date(), nullable=False),
            sa.Column('electricity_kwh', sa.Float(), nullable=False),
            sa.Column('fuel_litres', sa.Float(), nullable=True),
            sa.Column('renewable_energy_kwh', sa.Float(), nullable=True),
            sa.Column('peak_demand_kw', sa.Float(), nullable=True),
            sa.Column('production_tonnes', sa.Float(), nullable=True),
            sa.Column('data_source', data_source_type, nullable=False),
            sa.Column('created_by', sa.UUID(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.CheckConstraint('electricity_kwh >= 0', name='ck_energy_metrics_electricity_nonneg'),
            sa.CheckConstraint('fuel_litres IS NULL OR fuel_litres >= 0', name='ck_energy_metrics_fuel_nonneg'),
            sa.CheckConstraint(
                'renewable_energy_kwh IS NULL OR renewable_energy_kwh >= 0', name='ck_energy_metrics_renewable_nonneg'
            ),
            sa.CheckConstraint(
                'peak_demand_kw IS NULL OR peak_demand_kw >= 0', name='ck_energy_metrics_peak_demand_nonneg'
            ),
            sa.CheckConstraint(
                'production_tonnes IS NULL OR production_tonnes >= 0', name='ck_energy_metrics_production_nonneg'
            ),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_energy_metrics_created_by_users')),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_energy_metrics')),
            sa.UniqueConstraint('sector_id', 'recorded_date', name='uq_energy_metrics_sector_date'),
        )
        op.create_index('ix_energy_metrics_recorded_date', 'energy_metrics', ['recorded_date'])

    def _create_waste_metrics():
        op.create_table(
            'waste_metrics',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('sector_id', sa.String(), nullable=True),
            sa.Column('recorded_date', sa.Date(), nullable=False),
            sa.Column('total_waste_tonnes', sa.Float(), nullable=False),
            sa.Column('recycled_waste_tonnes', sa.Float(), server_default='0', nullable=False),
            sa.Column('reused_waste_tonnes', sa.Float(), server_default='0', nullable=False),
            sa.Column('disposed_waste_tonnes', sa.Float(), server_default='0', nullable=False),
            sa.Column('hazardous_waste_tonnes', sa.Float(), nullable=True),
            sa.Column('production_tonnes', sa.Float(), nullable=True),
            sa.Column('data_source', data_source_type, nullable=False),
            sa.Column('created_by', sa.UUID(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.CheckConstraint('total_waste_tonnes >= 0', name='ck_waste_metrics_total_nonneg'),
            sa.CheckConstraint('recycled_waste_tonnes >= 0', name='ck_waste_metrics_recycled_nonneg'),
            sa.CheckConstraint('reused_waste_tonnes >= 0', name='ck_waste_metrics_reused_nonneg'),
            sa.CheckConstraint('disposed_waste_tonnes >= 0', name='ck_waste_metrics_disposed_nonneg'),
            sa.CheckConstraint(
                'hazardous_waste_tonnes IS NULL OR hazardous_waste_tonnes >= 0', name='ck_waste_metrics_hazardous_nonneg'
            ),
            sa.CheckConstraint(
                'production_tonnes IS NULL OR production_tonnes >= 0', name='ck_waste_metrics_production_nonneg'
            ),
            sa.CheckConstraint(
                'recycled_waste_tonnes + reused_waste_tonnes + disposed_waste_tonnes <= total_waste_tonnes',
                name='ck_waste_metrics_accounting',
            ),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_waste_metrics_created_by_users')),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_waste_metrics')),
            sa.UniqueConstraint('sector_id', 'recorded_date', name='uq_waste_metrics_sector_date'),
        )
        op.create_index('ix_waste_metrics_recorded_date', 'waste_metrics', ['recorded_date'])

    def _create_land_metrics():
        op.create_table(
            'land_metrics',
            sa.Column('id', sa.UUID(), nullable=False),
            sa.Column('sector_id', sa.String(), nullable=True),
            sa.Column('recorded_date', sa.Date(), nullable=False),
            sa.Column('total_disturbed_area_ha', sa.Float(), nullable=False),
            sa.Column('reclaimed_area_ha', sa.Float(), server_default='0', nullable=False),
            sa.Column('active_reclamation_area_ha', sa.Float(), nullable=True),
            sa.Column('revegetated_area_ha', sa.Float(), nullable=True),
            sa.Column('erosion_incidents', sa.Integer(), nullable=True),
            sa.Column('data_source', data_source_type, nullable=False),
            sa.Column('created_by', sa.UUID(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
            sa.CheckConstraint('total_disturbed_area_ha >= 0', name='ck_land_metrics_disturbed_nonneg'),
            sa.CheckConstraint('reclaimed_area_ha >= 0', name='ck_land_metrics_reclaimed_nonneg'),
            sa.CheckConstraint(
                'active_reclamation_area_ha IS NULL OR active_reclamation_area_ha >= 0',
                name='ck_land_metrics_active_reclamation_nonneg',
            ),
            sa.CheckConstraint(
                'revegetated_area_ha IS NULL OR revegetated_area_ha >= 0', name='ck_land_metrics_revegetated_nonneg'
            ),
            sa.CheckConstraint(
                'erosion_incidents IS NULL OR erosion_incidents >= 0', name='ck_land_metrics_erosion_nonneg'
            ),
            sa.CheckConstraint('reclaimed_area_ha <= total_disturbed_area_ha', name='ck_land_metrics_reclaimed_le_disturbed'),
            sa.CheckConstraint(
                'active_reclamation_area_ha IS NULL OR active_reclamation_area_ha <= total_disturbed_area_ha',
                name='ck_land_metrics_active_le_disturbed',
            ),
            sa.CheckConstraint(
                'revegetated_area_ha IS NULL OR revegetated_area_ha <= reclaimed_area_ha',
                name='ck_land_metrics_revegetated_le_reclaimed',
            ),
            sa.ForeignKeyConstraint(['created_by'], ['users.id'], name=op.f('fk_land_metrics_created_by_users')),
            sa.PrimaryKeyConstraint('id', name=op.f('pk_land_metrics')),
            sa.UniqueConstraint('sector_id', 'recorded_date', name='uq_land_metrics_sector_date'),
        )
        op.create_index('ix_land_metrics_recorded_date', 'land_metrics', ['recorded_date'])

    _create_table_idempotent(_create_energy_metrics)
    _create_table_idempotent(_create_waste_metrics)
    _create_table_idempotent(_create_land_metrics)


def downgrade() -> None:
    op.drop_table('land_metrics')
    op.drop_table('waste_metrics')
    op.drop_table('energy_metrics')
