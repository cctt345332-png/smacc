"""add payment cancellation status

Revision ID: l3m4n5o6p7q8
Revises: k2l3m4n5o6p7
"""
from alembic import op
import sqlalchemy as sa

revision = "l3m4n5o6p7q8"
down_revision = "k2l3m4n5o6p7"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "payments",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="posted"),
    )
    op.create_index("ix_payments_status", "payments", ["status"], unique=False)


def downgrade():
    op.drop_index("ix_payments_status", table_name="payments")
    op.drop_column("payments", "status")
