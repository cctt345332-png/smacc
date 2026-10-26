"""rep attendance settings

Revision ID: ad8e9f0a
Revises: ac7d8e9f
"""
from alembic import op
import sqlalchemy as sa

revision = "ad8e9f0a"
down_revision = "ac7d8e9f"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "rep_attendance_settings",
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("start_time", sa.String(length=5), nullable=False, server_default="17:00"),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Riyadh"),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("tenant_id"),
    )


def downgrade():
    op.drop_table("rep_attendance_settings")
