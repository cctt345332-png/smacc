"""add payroll paid amount and move employee GOSI share to company

Revision ID: z4a5b6c7
Revises: y3z4a5b6
"""
from alembic import op
import sqlalchemy as sa

revision = "z4a5b6c7"
down_revision = "y3z4a5b6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "hr_payroll",
        sa.Column("paid_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
    )
    op.create_table(
        "hr_payroll_payments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("payroll_id", sa.String(), sa.ForeignKey("hr_payroll.id"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("payment_method", sa.String(30), nullable=False),
        sa.Column("journal_entry_id", sa.String(), nullable=True),
        sa.Column("paid_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("paid_at", sa.DateTime(), nullable=False),
    )
    # الرواتب القديمة غير المدفوعة كانت تخصم حصة الموظف؛ تُعاد للصافي
    # وتنقل مسؤولية التأمينات بالكامل إلى الشركة.
    op.execute(sa.text("""
        UPDATE hr_payroll
        SET total_deductions = total_deductions - COALESCE(gosi_employee, 0),
            net_salary = net_salary + COALESCE(gosi_employee, 0),
            gosi_employee = 0
        WHERE status <> 'paid' AND COALESCE(gosi_employee, 0) <> 0
    """))


def downgrade():
    op.drop_table("hr_payroll_payments")
    op.drop_column("hr_payroll", "paid_amount")
