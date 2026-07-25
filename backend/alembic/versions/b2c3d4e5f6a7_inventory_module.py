"""inventory_module

Revision ID: b2c3d4e5f6a7
Revises: e84024df992c
Create Date: 2026-04-20 01:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'e84024df992c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── business_type على tenants ─────────────────────────────────────
    op.add_column('tenants',
        sa.Column('business_type', sa.String(50), nullable=False, server_default='general')
    )

    # ── Warehouses ────────────────────────────────────────────────────
    op.create_table('warehouses',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('name_ar', sa.String(200), nullable=False),
        sa.Column('name_en', sa.String(200), nullable=True),
        sa.Column('branch_name', sa.String(200), nullable=True),
        sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_warehouses_tenant_id', 'warehouses', ['tenant_id'])

    # ── Product Categories ────────────────────────────────────────────
    op.create_table('product_categories',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('name_ar', sa.String(200), nullable=False),
        sa.Column('name_en', sa.String(200), nullable=True),
        sa.Column('parent_id', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['parent_id'], ['product_categories.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_product_categories_tenant_id', 'product_categories', ['tenant_id'])

    # ── Inventory Items (النواة) ──────────────────────────────────────
    op.create_table('inventory_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('category_id', sa.String(), nullable=True),
        sa.Column('default_warehouse_id', sa.String(), nullable=True),
        sa.Column('name_ar', sa.String(300), nullable=False),
        sa.Column('name_en', sa.String(300), nullable=True),
        sa.Column('sku', sa.String(100), nullable=True),
        sa.Column('barcode', sa.String(100), nullable=True),
        sa.Column('description_ar', sa.Text(), nullable=True),
        sa.Column('tracking_type',
            sa.Enum('quantity','serial','batch','variant','weight', name='trackingtype'),
            nullable=False, server_default='quantity'),
        sa.Column('unit_type',
            sa.Enum('piece','kg','gram','liter','meter','box','pack','ton', name='unittype'),
            nullable=False, server_default='piece'),
        sa.Column('cost_price', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('sale_price', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('vat_rate', sa.Numeric(5, 2), nullable=False, server_default='15'),
        sa.Column('quantity_on_hand', sa.Numeric(18, 3), nullable=False, server_default='0'),
        sa.Column('quantity_reserved', sa.Numeric(18, 3), nullable=False, server_default='0'),
        sa.Column('reorder_point', sa.Numeric(18, 3), nullable=False, server_default='0'),
        sa.Column('store_enabled', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('store_description_ar', sa.Text(), nullable=True),
        sa.Column('store_images_json', sa.Text(), nullable=True),
        sa.Column('store_price', sa.Numeric(18, 4), nullable=True),
        sa.Column('store_featured', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('pos_enabled', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['category_id'], ['product_categories.id']),
        sa.ForeignKeyConstraint(['default_warehouse_id'], ['warehouses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_inventory_items_tenant_id', 'inventory_items', ['tenant_id'])
    op.create_index('ix_inventory_items_sku', 'inventory_items', ['sku'])
    op.create_index('ix_inventory_items_barcode', 'inventory_items', ['barcode'])

    # ── Serial Items (جوالات / إلكترونيات) ───────────────────────────
    op.create_table('serial_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('product_id', sa.String(), nullable=False),
        sa.Column('warehouse_id', sa.String(), nullable=True),
        sa.Column('serial_number', sa.String(200), nullable=False),
        sa.Column('condition',
            sa.Enum('new','used','refurbished', name='serialcondition'),
            nullable=False, server_default='new'),
        sa.Column('status',
            sa.Enum('in_stock','sold','reserved','damaged','returned', name='serialstatus'),
            nullable=False, server_default='in_stock'),
        sa.Column('cost_price', sa.Numeric(18, 4), nullable=False),
        sa.Column('sale_price', sa.Numeric(18, 4), nullable=True),
        sa.Column('purchase_bill_id', sa.String(), nullable=True),
        sa.Column('sale_invoice_id', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('purchased_at', sa.DateTime(), nullable=True),
        sa.Column('sold_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['inventory_items.id']),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_serial_items_product_id', 'serial_items', ['product_id'])
    op.create_index('ix_serial_items_serial_number', 'serial_items', ['serial_number'])
    op.create_index('ix_serial_items_product_status', 'serial_items', ['product_id', 'status'])

    # ── Batch Items (صيدليات / مواد غذائية) ──────────────────────────
    op.create_table('batch_items',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('product_id', sa.String(), nullable=False),
        sa.Column('warehouse_id', sa.String(), nullable=True),
        sa.Column('batch_number', sa.String(100), nullable=False),
        sa.Column('expiry_date', sa.DateTime(), nullable=True),
        sa.Column('manufacture_date', sa.DateTime(), nullable=True),
        sa.Column('quantity', sa.Numeric(18, 3), nullable=False, server_default='0'),
        sa.Column('cost_price', sa.Numeric(18, 4), nullable=False),
        sa.Column('purchase_bill_id', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['inventory_items.id']),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_batch_items_product_id', 'batch_items', ['product_id'])
    op.create_index('ix_batch_items_batch_number', 'batch_items', ['batch_number'])

    # ── Product Variants (ملابس / أحذية) ─────────────────────────────
    op.create_table('product_variants',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('product_id', sa.String(), nullable=False),
        sa.Column('size', sa.String(50), nullable=True),
        sa.Column('color', sa.String(100), nullable=True),
        sa.Column('other_attr', sa.String(100), nullable=True),
        sa.Column('sku_variant', sa.String(100), nullable=True),
        sa.Column('barcode_variant', sa.String(100), nullable=True),
        sa.Column('quantity', sa.Numeric(18, 3), nullable=False, server_default='0'),
        sa.Column('cost_price', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('sale_price', sa.Numeric(18, 4), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['inventory_items.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_product_variants_product_id', 'product_variants', ['product_id'])

    # ── Stock Movements (حركات المخزون) ──────────────────────────────
    op.create_table('stock_movements',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('product_id', sa.String(), nullable=False),
        sa.Column('warehouse_id', sa.String(), nullable=True),
        sa.Column('movement_type',
            sa.Enum('purchase','sale','return_in','return_out','adjustment','transfer','damage',
                    name='movementtype'),
            nullable=False),
        sa.Column('quantity', sa.Numeric(18, 3), nullable=False),
        sa.Column('unit_cost', sa.Numeric(18, 4), nullable=False, server_default='0'),
        sa.Column('serial_item_id', sa.String(), nullable=True),
        sa.Column('batch_item_id', sa.String(), nullable=True),
        sa.Column('variant_id', sa.String(), nullable=True),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('reference_id', sa.String(), nullable=True),
        sa.Column('to_warehouse_id', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['product_id'], ['inventory_items.id']),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id']),
        sa.ForeignKeyConstraint(['serial_item_id'], ['serial_items.id']),
        sa.ForeignKeyConstraint(['batch_item_id'], ['batch_items.id']),
        sa.ForeignKeyConstraint(['variant_id'], ['product_variants.id']),
        sa.ForeignKeyConstraint(['to_warehouse_id'], ['warehouses.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_stock_movements_tenant_id', 'stock_movements', ['tenant_id'])
    op.create_index('ix_stock_movements_product_id', 'stock_movements', ['product_id'])
    op.create_index('ix_stock_movements_tenant_date', 'stock_movements', ['tenant_id', 'created_at'])
    op.create_index('ix_stock_movements_product_type', 'stock_movements', ['product_id', 'movement_type'])


def downgrade() -> None:
    op.drop_index('ix_stock_movements_product_type', 'stock_movements')
    op.drop_index('ix_stock_movements_tenant_date', 'stock_movements')
    op.drop_index('ix_stock_movements_product_id', 'stock_movements')
    op.drop_index('ix_stock_movements_tenant_id', 'stock_movements')
    op.drop_table('stock_movements')
    op.drop_index('ix_product_variants_product_id', 'product_variants')
    op.drop_table('product_variants')
    op.drop_index('ix_batch_items_batch_number', 'batch_items')
    op.drop_index('ix_batch_items_product_id', 'batch_items')
    op.drop_table('batch_items')
    op.drop_index('ix_serial_items_product_status', 'serial_items')
    op.drop_index('ix_serial_items_serial_number', 'serial_items')
    op.drop_index('ix_serial_items_product_id', 'serial_items')
    op.drop_table('serial_items')
    op.drop_index('ix_inventory_items_barcode', 'inventory_items')
    op.drop_index('ix_inventory_items_sku', 'inventory_items')
    op.drop_index('ix_inventory_items_tenant_id', 'inventory_items')
    op.drop_table('inventory_items')
    op.drop_index('ix_product_categories_tenant_id', 'product_categories')
    op.drop_table('product_categories')
    op.drop_index('ix_warehouses_tenant_id', 'warehouses')
    op.drop_table('warehouses')
    op.drop_column('tenants', 'business_type')
