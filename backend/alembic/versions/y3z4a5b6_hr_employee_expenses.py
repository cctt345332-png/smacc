"""add HR employee expenses
Revision ID: y3z4a5b6
Revises: x2y3z4a5
"""
from alembic import op
import sqlalchemy as sa
revision = "y3z4a5b6"
down_revision = "x2y3z4a5"
branch_labels = None
depends_on = None
def upgrade():
    op.create_table("hr_employee_expenses",
        sa.Column("id", sa.String(), primary_key=True), sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("employee_id", sa.String(), sa.ForeignKey("hr_employees.id"), nullable=False), sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(100), nullable=False), sa.Column("description", sa.Text()), sa.Column("amount", sa.Numeric(18,2), nullable=False),
        sa.Column("receipt_file_name", sa.String(255)), sa.Column("receipt_content_type", sa.String(100)), sa.Column("receipt_file_data", sa.Text()),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"), sa.Column("approved_by", sa.String(), sa.ForeignKey("users.id")),
        sa.Column("approved_at", sa.DateTime()), sa.Column("journal_entry_id", sa.String()), sa.Column("created_by", sa.String(), sa.ForeignKey("users.id")), sa.Column("created_at", sa.DateTime()))
def downgrade():
    op.drop_table("hr_employee_expenses")
