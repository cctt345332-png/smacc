"""inventory_stock

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-20 04:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('inventory_stock',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('item_id', sa.String(), nullable=False),
        sa.Column('warehouse_id', sa.String(), nullable=False),
        sa.Column('quantity', sa.Numeric(18, 3), nullable=False, server_default='0'),
        sa.Column('reserved_qty', sa.Numeric(18, 3), nullable=False, server_default='0'),
        sa.Column('reorder_point', sa.Numeric(18, 3), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id']),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventory_stock_tenant_id', 'inventory_stock', ['tenant_id'])
    op.create_index('ix_inventory_stock_item_id', 'inventory_stock', ['item_id'])
    op.create_index('ix_inventory_stock_item_warehouse', 'inventory_stock', ['item_id', 'warehouse_id'], unique=True)


def downgrade():
    op.drop_index('ix_inventory_stock_item_warehouse', 'inventory_stock')
    op.drop_index('ix_inventory_stock_item_id', 'inventory_stock')
    op.drop_index('ix_inventory_stock_tenant_id', 'inventory_stock')
    op.drop_table('inventory_stock')
