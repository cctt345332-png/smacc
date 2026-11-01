"""Repair quantity item warehouse stock records.

Revision ID: c8d9e0f1a2b3
Revises: f4a5b6c7d8e9
"""
from alembic import op


revision = "c8d9e0f1a2b3"
down_revision = "f4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Older quantity items could have quantity_on_hand without a corresponding
    # inventory_stock row, making them invisible in warehouses and POS.
    op.execute(
        """
        INSERT INTO inventory_stock (
            id, tenant_id, item_id, warehouse_id, quantity, reserved_qty,
            reorder_point, updated_at
        )
        SELECT
            md5(i.id || '_quantity_stock_repair') AS id,
            i.tenant_id,
            i.id,
            COALESCE(
                CASE
                    WHEN w_item.id IS NOT NULL AND w_item.is_active = true
                    THEN i.default_warehouse_id
                    ELSE NULL
                END,
                w_default.id
            ) AS warehouse_id,
            i.quantity_on_hand,
            0,
            i.reorder_point,
            NOW()
        FROM inventory_items i
        LEFT JOIN warehouses w_item
            ON w_item.id = i.default_warehouse_id
           AND w_item.tenant_id = i.tenant_id
        LEFT JOIN LATERAL (
            SELECT w.id
            FROM warehouses w
            WHERE w.tenant_id = i.tenant_id
              AND w.is_active = true
            ORDER BY w.is_default DESC, w.created_at ASC
            LIMIT 1
        ) w_default ON true
        WHERE i.tracking_type = 'quantity'
          AND i.quantity_on_hand > 0
          AND COALESCE(
                CASE
                    WHEN w_item.id IS NOT NULL AND w_item.is_active = true
                    THEN i.default_warehouse_id
                    ELSE NULL
                END,
                w_default.id
              ) IS NOT NULL
          AND NOT EXISTS (
              SELECT 1
              FROM inventory_stock s
              WHERE s.item_id = i.id
          )
        ON CONFLICT (item_id, warehouse_id) DO NOTHING
        """
    )


def downgrade() -> None:
    # Deliberately do not remove repaired stock rows; they contain real inventory.
    pass
