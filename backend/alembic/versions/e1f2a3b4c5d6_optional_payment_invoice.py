"""allow customer receipts without an invoice

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
"""
from alembic import op

revision = "e1f2a3b4c5d6"
down_revision = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("payments", "invoice_id", nullable=True)


def downgrade() -> None:
    # لا يمكن إعادة NOT NULL إذا وجدت سندات مباشرة بلا فاتورة.
    # يجب معالجة هذه السندات قبل الرجوع إلى revision قديم.
    op.alter_column("payments", "invoice_id", nullable=False)
