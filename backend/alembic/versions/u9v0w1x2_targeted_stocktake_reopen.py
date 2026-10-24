"""allow reopening stocktake for one representative

Revision ID: u9v0w1x2
down_revision: t8u9v0w1
"""
from alembic import op
import sqlalchemy as sa

revision = "u9v0w1x2"
down_revision = "t8u9v0w1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "mandatory_stocktake_runs",
        sa.Column("reopened_rep_ids_json", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("mandatory_stocktake_runs", "reopened_rep_ids_json")
