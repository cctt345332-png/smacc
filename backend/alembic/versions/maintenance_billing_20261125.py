"""Add maintenance billing ledger.
Revision ID: maintenance_billing_20261125
Revises: maintenance_parts_stock_20261125
"""
from alembic import op
import sqlalchemy as sa
revision = "maintenance_billing_20261125"
down_revision = "maintenance_parts_stock_20261125"
branch_labels = None
depends_on = None

def upgrade():
    op.create_table("maintenance_billings",
        sa.Column("id", sa.String(), nullable=False), sa.Column("tenant_id", sa.String(), nullable=False), sa.Column("case_id", sa.String(), nullable=False),
        sa.Column("labor_amount", sa.Numeric(14, 2), nullable=False), sa.Column("parts_amount", sa.Numeric(14, 2), nullable=False), sa.Column("discount_amount", sa.Numeric(14, 2), nullable=False), sa.Column("vat_amount", sa.Numeric(14, 2), nullable=False), sa.Column("total_amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("invoice_id", sa.String(), nullable=True), sa.Column("created_by", sa.String(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]), sa.ForeignKeyConstraint(["case_id"], ["maintenance_cases.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]), sa.ForeignKeyConstraint(["created_by"], ["users.id"]), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("case_id"))
    op.create_index("ix_maintenance_billings_tenant_id", "maintenance_billings", ["tenant_id"])
    op.create_index("ix_maintenance_billings_case_id", "maintenance_billings", ["case_id"])
    op.create_index("ix_maintenance_billings_invoice_id", "maintenance_billings", ["invoice_id"])

def downgrade():
    op.drop_index("ix_maintenance_billings_invoice_id", table_name="maintenance_billings")
    op.drop_index("ix_maintenance_billings_case_id", table_name="maintenance_billings")
    op.drop_index("ix_maintenance_billings_tenant_id", table_name="maintenance_billings")
    op.drop_table("maintenance_billings")
