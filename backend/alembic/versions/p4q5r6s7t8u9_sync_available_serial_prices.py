"""Sync available serial sale prices from their inventory item.

Revision ID: p4q5r6s7t8u9
Revises: n7o8p9q0r1s2
"""
from alembic import op

revision = "p4q5r6s7t8u9"
down_revision = "n7o8p9q0r1s2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # لا نغيّر السيريالات المباعة حتى تبقى تقارير الربح التاريخية صحيحة.
    op.execute(
        """
        UPDATE serial_items AS si
        SET sale_price = ii.sale_price
        FROM inventory_items AS ii
        WHERE si.product_id = ii.id
          AND si.status = 'in_stock'
          AND ii.sale_price IS NOT NULL
          AND ii.sale_price > 0
        """
    )


def downgrade() -> None:
    # لا يمكن استرجاع القيم القديمة بأمان بعد مزامنتها.
    pass
