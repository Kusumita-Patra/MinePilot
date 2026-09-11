"""add blueprint_section zone_type and status fields

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-11 00:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_zone_type_values = ('NORMAL', 'RESTRICTED', 'EMERGENCY', 'HIGH_RISK', 'WORK_ZONE')
_section_status_values = ('ACTIVE', 'CLOSED', 'UNDER_MAINTENANCE')


def upgrade() -> None:
    # ALTER TABLE ADD COLUMN with a brand-new enum type doesn't auto-create
    # the type the way create_table does, so the type is created explicitly
    # first (create_type=False on the column reference avoids a double-create).
    zone_type = postgresql.ENUM(*_zone_type_values, name='zone_type', create_type=False)
    zone_type.create(op.get_bind(), checkfirst=True)
    section_status = postgresql.ENUM(*_section_status_values, name='section_status', create_type=False)
    section_status.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'blueprint_sections',
        sa.Column('zone_type', zone_type, nullable=False, server_default='NORMAL'),
    )
    op.add_column(
        'blueprint_sections',
        sa.Column('status', section_status, nullable=False, server_default='ACTIVE'),
    )


def downgrade() -> None:
    op.drop_column('blueprint_sections', 'status')
    op.drop_column('blueprint_sections', 'zone_type')
    postgresql.ENUM(name='section_status').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name='zone_type').drop(op.get_bind(), checkfirst=True)
