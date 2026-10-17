"""stock_documents

Revision ID: n7o8p9q0r1s2
Revises: m5n6o7p8q9r0
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "n7o8p9q0r1s2"
down_revision: Union[str, None] = "m5n6o7p8q9r0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stock_documents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("document_number", sa.String(50), nullable=False),
        sa.Column("direction", sa.String(10), nullable=False),
        sa.Column("warehouse_id", sa.String(), nullable=False),
        sa.Column("destination_name", sa.String(200), nullable=True),
        sa.Column("reason", sa.String(50), nullable=False, server_default="other"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stock_documents_tenant_id", "stock_documents", ["tenant_id"])
    op.create_index("ix_stock_documents_document_number", "stock_documents", ["document_number"])
    op.create_index("ix_stock_documents_created_at", "stock_documents", ["created_at"])
    op.create_table(
        "stock_document_lines",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("document_id", sa.String(), nullable=False),
        sa.Column("line_no", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("item_id", sa.String(), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(18, 4), nullable=False, server_default="0"),
        sa.Column("serial_numbers_json", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["document_id"], ["stock_documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stock_document_lines_document_id", "stock_document_lines", ["document_id"])


def downgrade() -> None:
    op.drop_index("ix_stock_document_lines_document_id", table_name="stock_document_lines")
    op.drop_table("stock_document_lines")
    op.drop_index("ix_stock_documents_created_at", table_name="stock_documents")
    op.drop_index("ix_stock_documents_document_number", table_name="stock_documents")
    op.drop_index("ix_stock_documents_tenant_id", table_name="stock_documents")
    op.drop_table("stock_documents")
