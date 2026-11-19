"""link maintenance tickets to sales invoices
Revision ID: t3u4v5w6x7y8
Revises: s2t3u4v5w6x7
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa

revision = "t3u4v5w6x7y8"
down_revision = "s2t3u4v5w6x7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pos_maintenance_tickets", sa.Column("invoice_id", sa.String(), nullable=True))
    op.create_index("ix_pos_maintenance_tickets_invoice_id", "pos_maintenance_tickets", ["invoice_id"])
    op.create_foreign_key("fk_pos_maintenance_tickets_invoice_id", "pos_maintenance_tickets", "invoices", ["invoice_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_pos_maintenance_tickets_invoice_id", "pos_maintenance_tickets", type_="foreignkey")
    op.drop_index("ix_pos_maintenance_tickets_invoice_id", table_name="pos_maintenance_tickets")
    op.drop_column("pos_maintenance_tickets", "invoice_id")
