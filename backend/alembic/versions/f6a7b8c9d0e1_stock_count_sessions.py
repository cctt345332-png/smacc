"""stock_count_sessions

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-04-20 05:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('stock_count_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('item_id', sa.String(), nullable=False),
        sa.Column('warehouse_id', sa.String(), nullable=False),
        sa.Column('previous_qty', sa.Numeric(18, 3), nullable=False),
        sa.Column('counted_qty', sa.Numeric(18, 3), nullable=False),
        sa.Column('diff_qty', sa.Numeric(18, 3), nullable=False),
        sa.Column('diff_value', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('counted_by', sa.String(), nullable=True),
        sa.Column('counted_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id']),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id']),
        sa.ForeignKeyConstraint(['counted_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_stock_count_sessions_tenant_id', 'stock_count_sessions', ['tenant_id'])
    op.create_index('ix_stock_count_sessions_item_id', 'stock_count_sessions', ['item_id'])
    op.create_index('ix_stock_count_sessions_counted_at', 'stock_count_sessions', ['counted_at'])


def downgrade():
    op.drop_index('ix_stock_count_sessions_counted_at', 'stock_count_sessions')
    op.drop_index('ix_stock_count_sessions_item_id', 'stock_count_sessions')
    op.drop_index('ix_stock_count_sessions_tenant_id', 'stock_count_sessions')
    op.drop_table('stock_count_sessions')
