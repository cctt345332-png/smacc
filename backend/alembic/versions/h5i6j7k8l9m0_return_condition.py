"""add return condition and warehouse to credit note lines

Revision ID: h5i6j7k8l9m0
Revises: g4b5c6d7e8f9
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "h5i6j7k8l9m0"
down_revision: Union[str, None] = "g4b5c6d7e8f9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "credit_note_lines",
        sa.Column("return_condition", sa.String(length=30), nullable=False, server_default="resalable"),
    )
    op.add_column(
        "credit_note_lines",
        sa.Column("warehouse_id", sa.String(), nullable=True),
    )
    op.create_index("ix_credit_note_lines_warehouse_id", "credit_note_lines", ["warehouse_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_credit_note_lines_warehouse_id", table_name="credit_note_lines")
    op.drop_column("credit_note_lines", "warehouse_id")
    op.drop_column("credit_note_lines", "return_condition")
