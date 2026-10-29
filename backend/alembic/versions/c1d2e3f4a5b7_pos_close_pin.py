"""add POS terminal close PIN
Revision ID: c1d2e3f4a5b7
Revises: b0c1d2e3f4a5
"""
from alembic import op
import sqlalchemy as sa

revision = "c1d2e3f4a5b7"
down_revision = "b0c1d2e3f4a5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pos_terminals", sa.Column("close_pin_hash", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("pos_terminals", "close_pin_hash")
