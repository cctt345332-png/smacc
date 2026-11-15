"""Add settlement period end date.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
"""
from alembic import op
import sqlalchemy as sa

revision = "b3c4d5e6f7a8"
down_revision = "a2b3c4d5e6f7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("custody_settlements", sa.Column("period_to", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("custody_settlements", "period_to")
