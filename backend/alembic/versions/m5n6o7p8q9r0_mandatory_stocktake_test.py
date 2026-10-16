"""mark mandatory stocktake test runs

Revision ID: m5n6o7p8q9r0
Revises: l4m5n6o7p8q9
"""
from alembic import op
import sqlalchemy as sa

revision = "m5n6o7p8q9r0"
down_revision = "l4m5n6o7p8q9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mandatory_stocktake_runs", sa.Column("is_test", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.alter_column("mandatory_stocktake_runs", "is_test", server_default=None)


def downgrade() -> None:
    op.drop_column("mandatory_stocktake_runs", "is_test")
