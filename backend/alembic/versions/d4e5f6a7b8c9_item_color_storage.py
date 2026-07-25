"""item_color_storage

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-20 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    # اللون والسعة على المنتج الرئيسي
    op.add_column('inventory_items', sa.Column('color', sa.String(50), nullable=True))
    op.add_column('inventory_items', sa.Column('storage', sa.String(50), nullable=True))
    # نشيلهم من serial_items (كانوا مضافين بالـ migration السابق)
    try:
        op.drop_column('serial_items', 'color')
        op.drop_column('serial_items', 'storage')
    except Exception:
        pass  # ربما لم تُضف أصلاً


def downgrade():
    op.drop_column('inventory_items', 'storage')
    op.drop_column('inventory_items', 'color')
