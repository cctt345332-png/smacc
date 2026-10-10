"""notification_devices

Revision ID: e1f2a3b4c5d7
Revises: d9e8f7a6b5c4
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e1f2a3b4c5d7"
down_revision: Union[str, None] = "d9e8f7a6b5c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_devices",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("fcm_token", sa.String(length=1000), nullable=False),
        sa.Column("platform", sa.String(length=30), nullable=False, server_default="android"),
        sa.Column("device_name", sa.String(length=200), nullable=True),
        sa.Column("app_version", sa.String(length=50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_seen_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fcm_token"),
    )
    op.create_index("ix_user_devices_tenant_id", "user_devices", ["tenant_id"])
    op.create_index("ix_user_devices_user_id", "user_devices", ["user_id"])
    op.create_index("ix_user_devices_fcm_token", "user_devices", ["fcm_token"])


def downgrade() -> None:
    op.drop_index("ix_user_devices_fcm_token", table_name="user_devices")
    op.drop_index("ix_user_devices_user_id", table_name="user_devices")
    op.drop_index("ix_user_devices_tenant_id", table_name="user_devices")
    op.drop_table("user_devices")
