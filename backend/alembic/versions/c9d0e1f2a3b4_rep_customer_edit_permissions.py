"""add per-rep customer edit permissions

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
"""
from alembic import op
import sqlalchemy as sa

revision = "c9d0e1f2a3b4"
down_revision = "b8c9d0e1f2a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "sales_reps",
        sa.Column(
            "customer_edit_permissions",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'::json"),
        ),
    )
    op.alter_column("sales_reps", "customer_edit_permissions", server_default=None)


def downgrade() -> None:
    op.drop_column("sales_reps", "customer_edit_permissions")
