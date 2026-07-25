"""pos_line_tracking_fields

Revision ID: n1o2p3q4r5s6
Revises: m3n4o5p6q7r8
Create Date: 2026-05-03

إضافة حقول التتبع لأسطر معاملات POS:
- serial_item_id  → ربط السيريال المباع
- variant_id      → ربط المتغير (مقاس/لون)
- batch_id        → ربط التشغيلة (صيدلية)
- warehouse_id    → المستودع الافتراضي للجهاز
"""
from alembic import op
import sqlalchemy as sa

revision = 'n1o2p3q4r5s6'
down_revision = 'm3n4o5p6q7r8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── أسطر معاملات POS — حقول التتبع ──────────────────────────────
    op.add_column('pos_transaction_lines',
        sa.Column('serial_item_id', sa.String(), nullable=True))
    op.add_column('pos_transaction_lines',
        sa.Column('variant_id', sa.String(), nullable=True))
    op.add_column('pos_transaction_lines',
        sa.Column('batch_id', sa.String(), nullable=True))

    # ── الجهاز — مستودع افتراضي ──────────────────────────────────────
    op.add_column('pos_terminals',
        sa.Column('warehouse_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('pos_terminals', 'warehouse_id')
    op.drop_column('pos_transaction_lines', 'batch_id')
    op.drop_column('pos_transaction_lines', 'variant_id')
    op.drop_column('pos_transaction_lines', 'serial_item_id')
