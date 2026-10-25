"""add employee advances and payroll advance deduction
Revision ID: x2y3z4a5
Revises: w1x2y3z4
"""
from alembic import op
import sqlalchemy as sa

revision = "x2y3z4a5"
down_revision = "w1x2y3z4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hr_employee_advances",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("employee_id", sa.String(), sa.ForeignKey("hr_employees.id"), nullable=False),
        sa.Column("total_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("monthly_installment", sa.Numeric(18, 2), nullable=False),
        sa.Column("paid_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("start_month", sa.Integer(), nullable=False),
        sa.Column("start_year", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("approved_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.add_column("hr_payroll", sa.Column("advance_deduction", sa.Numeric(18, 2), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("hr_payroll", "advance_deduction")
    op.drop_table("hr_employee_advances")
