"""Add inspection reports and requested parts to new maintenance workflow.
Revision ID: maintenance_inspection_20261125
Revises: maintenance_cases_20261125
"""
from alembic import op
import sqlalchemy as sa

revision = "maintenance_inspection_20261125"
down_revision = "maintenance_cases_20261125"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("maintenance_inspections",
        sa.Column("id", sa.String(), nullable=False), sa.Column("tenant_id", sa.String(), nullable=False), sa.Column("case_id", sa.String(), nullable=False),
        sa.Column("diagnosis", sa.Text(), nullable=False), sa.Column("failure_cause", sa.Text(), nullable=True), sa.Column("repair_required", sa.Text(), nullable=True),
        sa.Column("warranty_status", sa.String(length=30), nullable=False), sa.Column("cost_responsibility", sa.String(length=30), nullable=False),
        sa.Column("labor_amount", sa.Numeric(14, 2), nullable=False), sa.Column("expected_days", sa.Integer(), nullable=True), sa.Column("customer_approval", sa.String(length=30), nullable=False),
        sa.Column("customer_approved_at", sa.DateTime(), nullable=True), sa.Column("created_by", sa.String(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]), sa.ForeignKeyConstraint(["case_id"], ["maintenance_cases.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["created_by"], ["users.id"]), sa.PrimaryKeyConstraint("id"), sa.UniqueConstraint("case_id"))
    op.create_index("ix_maintenance_inspections_tenant_id", "maintenance_inspections", ["tenant_id"])
    op.create_index("ix_maintenance_inspections_case_id", "maintenance_inspections", ["case_id"])
    op.create_table("maintenance_inspection_parts",
        sa.Column("id", sa.String(), nullable=False), sa.Column("tenant_id", sa.String(), nullable=False), sa.Column("inspection_id", sa.String(), nullable=False), sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 3), nullable=False), sa.Column("unit_price", sa.Numeric(14, 2), nullable=False), sa.Column("status", sa.String(length=20), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]), sa.ForeignKeyConstraint(["inspection_id"], ["maintenance_inspections.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["product_id"], ["inventory_items.id"]), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_maintenance_inspection_parts_tenant_id", "maintenance_inspection_parts", ["tenant_id"])
    op.create_index("ix_maintenance_inspection_parts_inspection_id", "maintenance_inspection_parts", ["inspection_id"])
    op.create_index("ix_maintenance_inspection_parts_product_id", "maintenance_inspection_parts", ["product_id"])


def downgrade():
    op.drop_index("ix_maintenance_inspection_parts_product_id", table_name="maintenance_inspection_parts")
    op.drop_index("ix_maintenance_inspection_parts_inspection_id", table_name="maintenance_inspection_parts")
    op.drop_index("ix_maintenance_inspection_parts_tenant_id", table_name="maintenance_inspection_parts")
    op.drop_table("maintenance_inspection_parts")
    op.drop_index("ix_maintenance_inspections_case_id", table_name="maintenance_inspections")
    op.drop_index("ix_maintenance_inspections_tenant_id", table_name="maintenance_inspections")
    op.drop_table("maintenance_inspections")
