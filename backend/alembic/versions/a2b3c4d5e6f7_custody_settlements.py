"""Add custody settlement history.

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
"""
from alembic import op
import sqlalchemy as sa

revision = "a2b3c4d5e6f7"
down_revision = "f1a2b3c4d5e6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "custody_settlements",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("source_type", sa.String(20), nullable=False),
        sa.Column("source_id", sa.String(), nullable=False),
        sa.Column("period_from", sa.DateTime(), nullable=True),
        sa.Column("settled_at", sa.DateTime(), nullable=False),
        sa.Column("expected_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("received_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("difference", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_custody_settlements_tenant_id", "custody_settlements", ["tenant_id"])
    op.create_index("ix_custody_settlements_source", "custody_settlements", ["tenant_id", "source_type", "source_id"])
    op.create_index("ix_custody_settlements_settled_at", "custody_settlements", ["settled_at"])


def downgrade():
    op.drop_index("ix_custody_settlements_settled_at", table_name="custody_settlements")
    op.drop_index("ix_custody_settlements_source", table_name="custody_settlements")
    op.drop_index("ix_custody_settlements_tenant_id", table_name="custody_settlements")
    op.drop_table("custody_settlements")
