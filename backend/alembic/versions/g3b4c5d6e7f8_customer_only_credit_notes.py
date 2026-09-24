"""allow customer-only sales returns

Revision ID: g3b4c5d6e7f8
Revises: f2a3b4c5d6e7
"""
from alembic import op

revision = "g3b4c5d6e7f8"
down_revision = "f2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("credit_notes", "original_invoice_id", nullable=True)


def downgrade() -> None:
    op.alter_column("credit_notes", "original_invoice_id", nullable=False)

