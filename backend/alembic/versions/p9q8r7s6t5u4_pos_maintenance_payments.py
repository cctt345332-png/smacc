"""add auditable POS maintenance payments
Revision ID: p9q8r7s6t5u4
Revises: o8q9r0s1t2u3
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa

revision = "p9q8r7s6t5u4"
down_revision = "o8q9r0s1t2u3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pos_maintenance_payments",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("ticket_id", sa.String(), sa.ForeignKey("pos_maintenance_tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", sa.String(), sa.ForeignKey("pos_sessions.id"), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("payment_method", sa.String(30), nullable=False, server_default="cash"),
        sa.Column("journal_entry_id", sa.String(), nullable=True),
        sa.Column("received_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_pos_maintenance_payments_tenant_id", "pos_maintenance_payments", ["tenant_id"])
    op.create_index("ix_pos_maintenance_payments_ticket_id", "pos_maintenance_payments", ["ticket_id"])
    op.create_index("ix_pos_maintenance_payments_session_id", "pos_maintenance_payments", ["session_id"])
    op.create_index("ix_pos_maintenance_payments_journal_entry_id", "pos_maintenance_payments", ["journal_entry_id"])
    op.create_index("ix_pos_maintenance_payments_created_at", "pos_maintenance_payments", ["created_at"])
    op.create_index("ix_pos_maintenance_payments_ticket_created", "pos_maintenance_payments", ["ticket_id", "created_at"])


def downgrade() -> None:
    op.drop_table("pos_maintenance_payments")
