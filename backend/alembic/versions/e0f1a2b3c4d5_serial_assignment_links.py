"""Add actual rep and POS terminal links to serial classifications.

Revision ID: e0f1a2b3c4d5
Revises: d9e0f1a2b3c4
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "e0f1a2b3c4d5"
down_revision = "d9e0f1a2b3c4"
branch_labels = None
depends_on = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    return column in {c["name"] for c in inspect(bind).get_columns(table)}


def upgrade() -> None:
    if not _has_column("serial_items", "custodian_rep_id"):
        op.add_column(
            "serial_items",
            sa.Column("custodian_rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=True),
        )
        op.create_index("ix_serial_items_custodian_rep_id", "serial_items", ["custodian_rep_id"], unique=False)
    if not _has_column("serial_items", "demo_terminal_id"):
        op.add_column(
            "serial_items",
            sa.Column("demo_terminal_id", sa.String(), sa.ForeignKey("pos_terminals.id"), nullable=True),
        )
        op.create_index("ix_serial_items_demo_terminal_id", "serial_items", ["demo_terminal_id"], unique=False)


def downgrade() -> None:
    if _has_column("serial_items", "demo_terminal_id"):
        op.drop_index("ix_serial_items_demo_terminal_id", table_name="serial_items")
        op.drop_column("serial_items", "demo_terminal_id")
    if _has_column("serial_items", "custodian_rep_id"):
        op.drop_index("ix_serial_items_custodian_rep_id", table_name="serial_items")
        op.drop_column("serial_items", "custodian_rep_id")
