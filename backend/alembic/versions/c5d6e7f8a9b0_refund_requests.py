"""refund_requests — طلب استرداد مرتبط بإشعار دائن

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa


revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    exists = conn.execute(sa.text("SELECT to_regclass('public.refund_requests')")).scalar()
    if exists:
        return
    # ينشئ PostgreSQL نوع enum مرة واحدة مع الجدول نفسه.
    status = sa.Enum("requested", "approved", "rejected", "cancelled", name="refundrequeststatus")
    op.create_table(
        "refund_requests",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("credit_note_id", sa.String(), sa.ForeignKey("credit_notes.id"), nullable=False),
        sa.Column("original_invoice_id", sa.String(), sa.ForeignKey("invoices.id"), nullable=False),
        sa.Column("customer_id", sa.String(), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("status", status, nullable=False, server_default="requested"),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("requested_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("approved_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.Column("rejection_reason", sa.String(length=500), nullable=True),
        sa.Column("payment_voucher_id", sa.String(), sa.ForeignKey("vouchers.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    for name, columns in (
        ("ix_refund_requests_tenant_id", ["tenant_id"]),
        ("ix_refund_requests_credit_note_id", ["credit_note_id"]),
        ("ix_refund_requests_original_invoice_id", ["original_invoice_id"]),
        ("ix_refund_requests_customer_id", ["customer_id"]),
        ("ix_refund_requests_status", ["status"]),
    ):
        op.create_index(name, "refund_requests", columns)


def downgrade():
    op.drop_table("refund_requests")
    sa.Enum(name="refundrequeststatus").drop(op.get_bind(), checkfirst=True)
