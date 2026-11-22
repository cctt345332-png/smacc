"""add maintenance customer receivables account to POS terminals

Revision ID: s1t2u3v4w5x6
Revises: r0s1t2u3v4w5
"""
from alembic import op
import sqlalchemy as sa

revision = "s1t2u3v4w5x6"
down_revision = "r0s1t2u3v4w5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pos_terminals",
        sa.Column("maintenance_customer_account_parent_id", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        "fk_pos_terminals_maintenance_customer_account",
        "pos_terminals",
        "accounts",
        ["maintenance_customer_account_parent_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_pos_terminals_maintenance_customer_account",
        "pos_terminals",
        type_="foreignkey",
    )
    op.drop_column("pos_terminals", "maintenance_customer_account_parent_id")
