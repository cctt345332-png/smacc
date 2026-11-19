"""link maintenance tickets to customers
Revision ID: q0r1s2t3u4v5
Revises: p9q8r7s6t5u4
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa

revision = "q0r1s2t3u4v5"
down_revision = "p9q8r7s6t5u4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pos_maintenance_tickets", sa.Column("customer_id", sa.String(), nullable=True))
    op.create_index("ix_pos_maintenance_tickets_customer_id", "pos_maintenance_tickets", ["customer_id"])
    op.create_foreign_key("fk_pos_maintenance_tickets_customer_id", "pos_maintenance_tickets", "customers", ["customer_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_pos_maintenance_tickets_customer_id", "pos_maintenance_tickets", type_="foreignkey")
    op.drop_index("ix_pos_maintenance_tickets_customer_id", table_name="pos_maintenance_tickets")
    op.drop_column("pos_maintenance_tickets", "customer_id")
