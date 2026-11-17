"""create isolated POS maintenance tickets and parts

Revision ID: h9i0j1k2l3m4
Revises: g8h9i0j1k2l3
Create Date: 2026-11-17
"""
from alembic import op
import sqlalchemy as sa

revision = "h9i0j1k2l3m4"
down_revision = "g8h9i0j1k2l3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pos_maintenance_tickets",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("terminal_id", sa.String(), sa.ForeignKey("pos_terminals.id"), nullable=False),
        sa.Column("maintenance_warehouse_id", sa.String(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("ticket_number", sa.String(50), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("customer_phone", sa.String(50), nullable=True),
        sa.Column("device_name", sa.String(300), nullable=False),
        sa.Column("device_serial", sa.String(200), nullable=True),
        sa.Column("reported_problem", sa.Text(), nullable=False),
        sa.Column("diagnosis", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("assigned_to", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("estimated_cost", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("approved_cost", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("paid_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_pos_maintenance_tickets_tenant_id", "pos_maintenance_tickets", ["tenant_id"])
    op.create_index("ix_pos_maintenance_tickets_terminal_id", "pos_maintenance_tickets", ["terminal_id"])
    op.create_index("ix_pos_maintenance_tickets_maintenance_warehouse_id", "pos_maintenance_tickets", ["maintenance_warehouse_id"])
    op.create_index("ix_pos_maintenance_tickets_ticket_number", "pos_maintenance_tickets", ["ticket_number"])
    op.create_index("ix_pos_maintenance_tickets_status", "pos_maintenance_tickets", ["status"])
    op.create_table(
        "pos_maintenance_parts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("ticket_id", sa.String(), sa.ForeignKey("pos_maintenance_tickets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("product_id", sa.String(), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 3), nullable=False, server_default="1"),
        sa.Column("unit_price", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("serial_item_id", sa.String(), sa.ForeignKey("serial_items.id"), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="planned"),
        sa.Column("stock_document_id", sa.String(), nullable=True),
        sa.Column("issued_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("issued_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_pos_maintenance_parts_tenant_id", "pos_maintenance_parts", ["tenant_id"])
    op.create_index("ix_pos_maintenance_parts_ticket_id", "pos_maintenance_parts", ["ticket_id"])
    op.create_index("ix_pos_maintenance_parts_product_id", "pos_maintenance_parts", ["product_id"])


def downgrade():
    op.drop_table("pos_maintenance_parts")
    op.drop_table("pos_maintenance_tickets")
