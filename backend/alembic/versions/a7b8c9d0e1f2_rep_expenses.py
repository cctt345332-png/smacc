"""rep expenses and attachments
Revision ID: c3e4f5a6b7c8
Revises: i5d6e7f8a9b0, z2a3b4c5d6e7
Create Date: 2026-10-07
"""
from alembic import op
import sqlalchemy as sa

revision = "c3e4f5a6b7c8"
down_revision = ("i5d6e7f8a9b0", "z2a3b4c5d6e7")
branch_labels = None
depends_on = None

def upgrade():
    op.create_table(
        "rep_expenses",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=False, index=True),
        sa.Column("expense_number", sa.String(50), nullable=False, index=True),
        sa.Column("expense_date", sa.DateTime(), nullable=False, index=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("payment_method", sa.String(40), nullable=False, server_default="rep_advance"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending", index=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("journal_entry_id", sa.String(), sa.ForeignKey("journal_entries.id"), nullable=True),
        sa.Column("submitted_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "rep_expense_attachments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("expense_id", sa.String(), sa.ForeignKey("rep_expenses.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("file_data", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

def downgrade():
    op.drop_table("rep_expense_attachments")
    op.drop_table("rep_expenses")
