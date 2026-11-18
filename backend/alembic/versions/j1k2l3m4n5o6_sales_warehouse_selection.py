"""Add optional warehouse selection to sales documents.

Revision ID: j1k2l3m4n5o6
Revises: i0j1k2l3m4n5
"""
from alembic import op
import sqlalchemy as sa

revision = "j1k2l3m4n5o6"
down_revision = "i0j1k2l3m4n5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("invoices", sa.Column("warehouse_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_invoices_warehouse_id", "invoices", "warehouses", ["warehouse_id"], ["id"])
    op.add_column("quotations", sa.Column("warehouse_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_quotations_warehouse_id", "quotations", "warehouses", ["warehouse_id"], ["id"])
    op.add_column("quotation_lines", sa.Column("inventory_item_id", sa.String(), nullable=True))
    op.add_column("quotation_lines", sa.Column("serial_ids_json", sa.Text(), nullable=True))
    op.add_column("quotation_lines", sa.Column("variant_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("quotation_lines", "variant_id")
    op.drop_column("quotation_lines", "serial_ids_json")
    op.drop_column("quotation_lines", "inventory_item_id")
    op.drop_constraint("fk_quotations_warehouse_id", "quotations", type_="foreignkey")
    op.drop_column("quotations", "warehouse_id")
    op.drop_constraint("fk_invoices_warehouse_id", "invoices", type_="foreignkey")
    op.drop_column("invoices", "warehouse_id")
