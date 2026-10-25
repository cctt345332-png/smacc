"""add POS card settlement GL account

Revision ID: ab6c7d8e
Revises: aa5b6c7d
"""
from alembic import op
import sqlalchemy as sa

revision = "ab6c7d8e"
down_revision = "aa5b6c7d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pos_terminals",
        sa.Column("card_settlement_account_id", sa.String(), nullable=True),
    )
    op.create_foreign_key(
        "fk_pos_terminals_card_settlement_account",
        "pos_terminals",
        "accounts",
        ["card_settlement_account_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_pos_terminals_card_settlement_account", "pos_terminals", type_="foreignkey")
    op.drop_column("pos_terminals", "card_settlement_account_id")
