"""manual_notifications

Revision ID: d9e8f7a6b5c4
Revises: z2a3b4c5d6e7
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d9e8f7a6b5c4"
down_revision: Union[str, None] = "c3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("created_by_id", sa.String(), nullable=True))
    op.add_column("notifications", sa.Column("is_manual", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_foreign_key(
        "fk_notifications_created_by_id_users",
        "notifications",
        "users",
        ["created_by_id"],
        ["id"],
    )
    op.create_index("ix_notifications_created_by_id", "notifications", ["created_by_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_created_by_id", table_name="notifications")
    op.drop_constraint("fk_notifications_created_by_id_users", "notifications", type_="foreignkey")
    op.drop_column("notifications", "is_manual")
    op.drop_column("notifications", "created_by_id")
