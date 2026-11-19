"""add maintenance service lines
Revision ID: s2t3u4v5w6x7
Revises: r1s2t3u4v5w6
Create Date: 2026-11-19
"""
from alembic import op
import sqlalchemy as sa

revision = "s2t3u4v5w6x7"
down_revision = "r1s2t3u4v5w6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pos_maintenance_service_lines",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("ticket_id", sa.String(), sa.ForeignKey("pos_maintenance_tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("service_name", sa.String(300), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_pos_maintenance_service_lines_tenant_id", "pos_maintenance_service_lines", ["tenant_id"])
    op.create_index("ix_pos_maintenance_service_lines_ticket_id", "pos_maintenance_service_lines", ["ticket_id"])


def downgrade() -> None:
    op.drop_table("pos_maintenance_service_lines")
