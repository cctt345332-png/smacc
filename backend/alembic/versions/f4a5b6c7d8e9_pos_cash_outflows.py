"""add POS cash outflows

Revision ID: f4a5b6c7d8e9
Revises: d2e3f4a5b6d7
"""
from alembic import op
import sqlalchemy as sa

revision = "f4a5b6c7d8e9"
down_revision = "d2e3f4a5b6d7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pos_cash_outflows",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), nullable=False),
        sa.Column("terminal_id", sa.String(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("outflow_type", sa.String(length=40), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("journal_entry_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["session_id"], ["pos_sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["terminal_id"], ["pos_terminals.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pos_cash_outflows_tenant_id", "pos_cash_outflows", ["tenant_id"])
    op.create_index("ix_pos_cash_outflows_session_id", "pos_cash_outflows", ["session_id"])
    op.create_index("ix_pos_cash_outflows_terminal_id", "pos_cash_outflows", ["terminal_id"])
    op.create_index("ix_pos_cash_outflows_outflow_type", "pos_cash_outflows", ["outflow_type"])
    op.create_index("ix_pos_cash_outflows_journal_entry_id", "pos_cash_outflows", ["journal_entry_id"])
    op.create_index("ix_pos_cash_outflows_created_at", "pos_cash_outflows", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_pos_cash_outflows_created_at", table_name="pos_cash_outflows")
    op.drop_index("ix_pos_cash_outflows_journal_entry_id", table_name="pos_cash_outflows")
    op.drop_index("ix_pos_cash_outflows_outflow_type", table_name="pos_cash_outflows")
    op.drop_index("ix_pos_cash_outflows_terminal_id", table_name="pos_cash_outflows")
    op.drop_index("ix_pos_cash_outflows_session_id", table_name="pos_cash_outflows")
    op.drop_index("ix_pos_cash_outflows_tenant_id", table_name="pos_cash_outflows")
    op.drop_table("pos_cash_outflows")
