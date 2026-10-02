"""Add receipt/discount voucher type to sales payments.

Revision ID: i5d6e7f8a9b0
Revises: h4c5d6e7f8
"""
from alembic import op
import sqlalchemy as sa

revision = "i5d6e7f8a9b0"
down_revision = "h4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    cols = [r[0] for r in conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns WHERE table_name='payments'"
    ))]
    if "payment_type" not in cols:
        op.add_column(
            "payments",
            sa.Column("payment_type", sa.String(length=20), nullable=False, server_default="receipt"),
        )
    # PostgreSQL enum values are additive and this is safe on existing databases.
    enum_exists = conn.execute(sa.text(
        "SELECT 1 FROM pg_type WHERE typname='vouchertype'"
    )).scalar()
    if enum_exists:
        conn.execute(sa.text("ALTER TYPE vouchertype ADD VALUE IF NOT EXISTS 'DISCOUNT'"))


def downgrade():
    op.drop_column("payments", "payment_type")
    # PostgreSQL cannot safely remove an enum value in-place; existing discount
    # vouchers must be migrated before a manual downgrade.
