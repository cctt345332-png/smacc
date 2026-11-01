"""Add serial classification for sale, custody, demo, and maintenance.

Revision ID: d9e0f1a2b3c4
Revises: c8d9e0f1a2b3
"""
from alembic import op
import sqlalchemy as sa

revision = "d9e0f1a2b3c4"
down_revision = "c8d9e0f1a2b3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "serial_items",
        sa.Column("serial_classification", sa.String(length=30), nullable=False, server_default="sale"),
    )
    op.add_column(
        "serial_items",
        sa.Column("classification_reference", sa.String(length=200), nullable=True),
    )
    op.create_index(
        "ix_serial_items_serial_classification",
        "serial_items",
        ["serial_classification"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_serial_items_serial_classification", table_name="serial_items")
    op.drop_column("serial_items", "classification_reference")
    op.drop_column("serial_items", "serial_classification")
