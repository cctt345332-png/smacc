"""add employee deductions
Revision ID: aa5b6c7d
Revises: z4a5b6c7
"""
from alembic import op
import sqlalchemy as sa

revision = "aa5b6c7d"
down_revision = "z4a5b6c7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hr_employee_deductions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("employee_id", sa.String(), sa.ForeignKey("hr_employees.id"), nullable=False),
        sa.Column("deduction_date", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("reason", sa.String(500), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("approved_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_hr_employee_deductions_tenant_id", "hr_employee_deductions", ["tenant_id"])
    op.create_index("ix_hr_employee_deductions_employee_id", "hr_employee_deductions", ["employee_id"])
    op.create_index("ix_hr_employee_deductions_deduction_date", "hr_employee_deductions", ["deduction_date"])


def downgrade():
    op.drop_table("hr_employee_deductions")
