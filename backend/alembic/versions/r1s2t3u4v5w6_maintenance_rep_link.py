"""link maintenance tickets to sales representatives
Revision ID: r1s2t3u4v5w6
Revises: q0r1s2t3u4v5
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa

revision = "r1s2t3u4v5w6"
down_revision = "q0r1s2t3u4v5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pos_maintenance_tickets", sa.Column("rep_id", sa.String(), nullable=True))
    op.create_index("ix_pos_maintenance_tickets_rep_id", "pos_maintenance_tickets", ["rep_id"])
    op.create_foreign_key("fk_pos_maintenance_tickets_rep_id", "pos_maintenance_tickets", "sales_reps", ["rep_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_pos_maintenance_tickets_rep_id", "pos_maintenance_tickets", type_="foreignkey")
    op.drop_index("ix_pos_maintenance_tickets_rep_id", table_name="pos_maintenance_tickets")
    op.drop_column("pos_maintenance_tickets", "rep_id")
