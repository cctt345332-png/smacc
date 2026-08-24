"""credit_note_line_identity — ربط المرتجع بالسطر الأصلي والسيريالات

Revision ID: a3b4c5d6e7f8
Revises: aa1bb2cc3dd4
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa


revision = "a3b4c5d6e7f8"
down_revision = "aa1bb2cc3dd4"
branch_labels = None
depends_on = None


def _columns(table_name: str) -> set[str]:
    conn = op.get_bind()
    return {
        row[0]
        for row in conn.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = :table_name"
            ),
            {"table_name": table_name},
        )
    }


def upgrade():
    columns = _columns("credit_note_lines")
    # Nullable لأن الإشعارات التاريخية لا تملك هوية سطر قابلة للاسترجاع بثقة.
    if "original_invoice_line_id" not in columns:
        op.add_column(
            "credit_note_lines",
            sa.Column("original_invoice_line_id", sa.String(), nullable=True),
        )
        op.create_index(
            "ix_credit_note_lines_original_invoice_line_id",
            "credit_note_lines",
            ["original_invoice_line_id"],
        )
    if "inventory_item_id" not in columns:
        op.add_column("credit_note_lines", sa.Column("inventory_item_id", sa.String(), nullable=True))
    if "variant_id" not in columns:
        op.add_column("credit_note_lines", sa.Column("variant_id", sa.String(), nullable=True))
    if "serial_ids_json" not in columns:
        op.add_column("credit_note_lines", sa.Column("serial_ids_json", sa.Text(), nullable=True))


def downgrade():
    columns = _columns("credit_note_lines")
    if "original_invoice_line_id" in columns:
        op.drop_index("ix_credit_note_lines_original_invoice_line_id", table_name="credit_note_lines")
        op.drop_column("credit_note_lines", "original_invoice_line_id")
    if "serial_ids_json" in columns:
        op.drop_column("credit_note_lines", "serial_ids_json")
    if "variant_id" in columns:
        op.drop_column("credit_note_lines", "variant_id")
    if "inventory_item_id" in columns:
        op.drop_column("credit_note_lines", "inventory_item_id")
