"""add separate salary withdrawals and direct monthly settlements

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
"""
from alembic import op
import sqlalchemy as sa

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "hr_employee_withdrawals",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("employee_id", sa.String(), sa.ForeignKey("hr_employees.id"), nullable=False),
        sa.Column("withdrawal_date", sa.Date(), nullable=False),
        sa.Column("salary_month", sa.Integer(), nullable=False),
        sa.Column("salary_year", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("reason", sa.String(500), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("settlement_id", sa.String(), nullable=True),
        sa.Column("approved_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_hr_employee_withdrawals_tenant_id", "hr_employee_withdrawals", ["tenant_id"])
    op.create_index("ix_hr_employee_withdrawals_employee_id", "hr_employee_withdrawals", ["employee_id"])
    op.create_index("ix_hr_employee_withdrawals_withdrawal_date", "hr_employee_withdrawals", ["withdrawal_date"])
    op.create_index("ix_hr_employee_withdrawals_salary_period", "hr_employee_withdrawals", ["tenant_id", "salary_year", "salary_month"])
    op.create_index("ix_hr_employee_withdrawals_status", "hr_employee_withdrawals", ["status"])
    op.create_index("ix_hr_employee_withdrawals_settlement_id", "hr_employee_withdrawals", ["settlement_id"])

    op.create_table(
        "hr_salary_settlements",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("employee_id", sa.String(), sa.ForeignKey("hr_employees.id"), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("basic_salary", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("total_allowances", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("gross_salary", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("withdrawals_total", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("deductions_total", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("loan_installments_total", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("net_salary", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("paid_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("journal_entry_id", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("tenant_id", "employee_id", "year", "month", name="uq_hr_salary_settlement_period"),
    )
    op.create_index("ix_hr_salary_settlements_tenant_id", "hr_salary_settlements", ["tenant_id"])
    op.create_index("ix_hr_salary_settlements_employee_id", "hr_salary_settlements", ["employee_id"])
    op.create_index("ix_hr_salary_settlements_status", "hr_salary_settlements", ["status"])
    op.create_index("ix_hr_salary_settlements_period", "hr_salary_settlements", ["tenant_id", "year", "month"])

    op.create_table(
        "hr_salary_settlement_payments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("settlement_id", sa.String(), sa.ForeignKey("hr_salary_settlements.id"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("payment_method", sa.String(30), nullable=False, server_default="cash"),
        sa.Column("journal_entry_id", sa.String(), nullable=True),
        sa.Column("paid_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_hr_salary_settlement_payments_tenant_id", "hr_salary_settlement_payments", ["tenant_id"])
    op.create_index("ix_hr_salary_settlement_payments_settlement_id", "hr_salary_settlement_payments", ["settlement_id"])


def downgrade():
    op.drop_table("hr_salary_settlement_payments")
    op.drop_index("ix_hr_salary_settlements_period", table_name="hr_salary_settlements")
    op.drop_index("ix_hr_salary_settlements_status", table_name="hr_salary_settlements")
    op.drop_index("ix_hr_salary_settlements_employee_id", table_name="hr_salary_settlements")
    op.drop_index("ix_hr_salary_settlements_tenant_id", table_name="hr_salary_settlements")
    op.drop_table("hr_salary_settlements")
    op.drop_index("ix_hr_employee_withdrawals_settlement_id", table_name="hr_employee_withdrawals")
    op.drop_index("ix_hr_employee_withdrawals_status", table_name="hr_employee_withdrawals")
    op.drop_index("ix_hr_employee_withdrawals_salary_period", table_name="hr_employee_withdrawals")
    op.drop_index("ix_hr_employee_withdrawals_withdrawal_date", table_name="hr_employee_withdrawals")
    op.drop_index("ix_hr_employee_withdrawals_employee_id", table_name="hr_employee_withdrawals")
    op.drop_index("ix_hr_employee_withdrawals_tenant_id", table_name="hr_employee_withdrawals")
    op.drop_table("hr_employee_withdrawals")
