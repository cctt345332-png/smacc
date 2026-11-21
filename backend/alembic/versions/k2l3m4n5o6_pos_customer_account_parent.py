"""add customer receivable parent account to POS terminals

Revision ID: k2l3m4n5o6
Revises: j1k2l3m4n5o6
"""
from alembic import op
import sqlalchemy as sa

revision = "k2l3m4n5o6"
down_revision = "j1k2l3m4n5o6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pos_terminals",
        sa.Column("customer_account_parent_id", sa.String(), sa.ForeignKey("accounts.id"), nullable=True),
    )


def downgrade():
    op.drop_column("pos_terminals", "customer_account_parent_id")
