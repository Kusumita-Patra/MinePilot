"""add incident ticket sequence

Revision ID: 57af729136b4
Revises: 9e50ad514d2d
Create Date: 2026-09-05 15:58:15.660793

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '57af729136b4'
down_revision: Union[str, None] = '9e50ad514d2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SEQUENCE IF NOT EXISTS incident_ticket_seq START WITH 1")


def downgrade() -> None:
    op.execute("DROP SEQUENCE IF EXISTS incident_ticket_seq")
