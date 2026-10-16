"""track mandatory stocktake notifications

Revision ID: l4m5n6o7p8q9
Revises: k3l4m5n6o7p8
"""
from alembic import op
import sqlalchemy as sa

revision = "l4m5n6o7p8q9"
down_revision = "k3l4m5n6o7p8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mandatory_stocktake_runs", sa.Column("reminder_sent_at", sa.DateTime(), nullable=True))
    op.add_column("mandatory_stocktake_runs", sa.Column("started_notified_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("mandatory_stocktake_runs", "started_notified_at")
    op.drop_column("mandatory_stocktake_runs", "reminder_sent_at")
