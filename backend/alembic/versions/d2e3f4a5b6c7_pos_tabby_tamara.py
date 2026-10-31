"""Add Tabby and Tamara POS settlement accounts and session totals.

Revision ID: d2e3f4a5b6c7
Revises: c1d2e3f4a5b7
"""
from alembic import op
import sqlalchemy as sa

revision = "d2e3f4a5b6c7"
down_revision = "c1d2e3f4a5b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pos_terminals", sa.Column("tabby_account_id", sa.String(), nullable=True))
    op.add_column("pos_terminals", sa.Column("tamara_account_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_pos_terminals_tabby_account", "pos_terminals", "accounts", ["tabby_account_id"], ["id"])
    op.create_foreign_key("fk_pos_terminals_tamara_account", "pos_terminals", "accounts", ["tamara_account_id"], ["id"])
    op.add_column("pos_sessions", sa.Column("total_tabby", sa.Numeric(18, 2), server_default="0", nullable=False))
    op.add_column("pos_sessions", sa.Column("total_tamara", sa.Numeric(18, 2), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("pos_sessions", "total_tamara")
    op.drop_column("pos_sessions", "total_tabby")
    op.drop_constraint("fk_pos_terminals_tamara_account", "pos_terminals", type_="foreignkey")
    op.drop_constraint("fk_pos_terminals_tabby_account", "pos_terminals", type_="foreignkey")
    op.drop_column("pos_terminals", "tamara_account_id")
    op.drop_column("pos_terminals", "tabby_account_id")
