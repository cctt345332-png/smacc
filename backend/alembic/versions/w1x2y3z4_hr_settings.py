"""add human resources work settings
Revision ID: w1x2y3z4
Revises: v0w1x2y3
"""
from alembic import op
import sqlalchemy as sa

revision = "w1x2y3z4"
down_revision = "v0w1x2y3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hr_settings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False, unique=True, index=True),
        sa.Column("work_start_time", sa.String(length=5), nullable=False, server_default="09:00"),
        sa.Column("work_end_time", sa.String(length=5), nullable=False, server_default="17:00"),
        sa.Column("grace_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("overtime_multiplier", sa.Numeric(5, 2), nullable=False, server_default="1.50"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("hr_settings")
