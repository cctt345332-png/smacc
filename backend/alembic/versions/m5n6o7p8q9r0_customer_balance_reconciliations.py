"""customer balance reconciliations

Revision ID: m5n6o7p8q9r0
Revises: l3m4n5o6p7q8
"""
from alembic import op
import sqlalchemy as sa

revision = "m5n6o7p8q9r0"
down_revision = "l3m4n5o6p7q8"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "customer_balance_reconciliations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("customer_id", sa.String(), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=True),
        sa.Column("reconciliation_date", sa.DateTime(), nullable=False),
        sa.Column("from_date", sa.DateTime(), nullable=False),
        sa.Column("to_date", sa.DateTime(), nullable=False),
        sa.Column("system_balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("acknowledged_balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("difference", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("snapshot_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="confirmed"),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_customer_balance_reconciliations_tenant_id", "customer_balance_reconciliations", ["tenant_id"])
    op.create_index("ix_customer_balance_reconciliations_customer_id", "customer_balance_reconciliations", ["customer_id"])
    op.create_index("ix_customer_balance_reconciliations_rep_id", "customer_balance_reconciliations", ["rep_id"])
    op.create_index("ix_customer_balance_reconciliations_reconciliation_date", "customer_balance_reconciliations", ["reconciliation_date"])


def downgrade():
    op.drop_table("customer_balance_reconciliations")
