"""Link POS receipt payments to cashier sessions and terminals.
Revision ID: pos_receipts_20261128
Revises: pos_treasury_settlement_20261128
"""
from alembic import op
import sqlalchemy as sa

revision = "pos_receipts_20261128"
down_revision = "pos_treasury_settlement_20261128"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("payments", sa.Column("pos_session_id", sa.String(), nullable=True))
    op.add_column("payments", sa.Column("pos_terminal_id", sa.String(), nullable=True))
    op.create_index("ix_payments_pos_session_id", "payments", ["pos_session_id"], unique=False)
    op.create_index("ix_payments_pos_terminal_id", "payments", ["pos_terminal_id"], unique=False)
    op.create_foreign_key("fk_payments_pos_session", "payments", "pos_sessions", ["pos_session_id"], ["id"])
    op.create_foreign_key("fk_payments_pos_terminal", "payments", "pos_terminals", ["pos_terminal_id"], ["id"])


def downgrade():
    op.drop_constraint("fk_payments_pos_terminal", "payments", type_="foreignkey")
    op.drop_constraint("fk_payments_pos_session", "payments", type_="foreignkey")
    op.drop_index("ix_payments_pos_terminal_id", table_name="payments")
    op.drop_index("ix_payments_pos_session_id", table_name="payments")
    op.drop_column("payments", "pos_terminal_id")
    op.drop_column("payments", "pos_session_id")
