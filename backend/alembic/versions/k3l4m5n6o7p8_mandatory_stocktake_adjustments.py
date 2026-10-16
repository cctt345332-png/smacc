"""track mandatory stocktake adjustment application

Revision ID: k3l4m5n6o7p8
Revises: j2k3l4m5n6o7
"""
from alembic import op
import sqlalchemy as sa

revision = "k3l4m5n6o7p8"
down_revision = "j2k3l4m5n6o7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("mandatory_stocktake_runs", sa.Column("adjustments_applied_at", sa.DateTime(), nullable=True))
    op.add_column("mandatory_stocktake_runs", sa.Column("adjustments_applied_by", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_mandatory_stocktake_runs_adjustments_applied_by_users",
        "mandatory_stocktake_runs",
        "users",
        ["adjustments_applied_by"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_mandatory_stocktake_runs_adjustments_applied_by_users", "mandatory_stocktake_runs", type_="foreignkey")
    op.drop_column("mandatory_stocktake_runs", "adjustments_applied_by")
    op.drop_column("mandatory_stocktake_runs", "adjustments_applied_at")
