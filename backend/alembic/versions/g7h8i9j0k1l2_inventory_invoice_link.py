"""inventory_invoice_link

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-20 06:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'g7h8i9j0k1l2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade():
    # ربط سطور الفاتورة بالمخزون
    op.add_column('invoice_lines', sa.Column('inventory_item_id', sa.String(), nullable=True))
    op.add_column('invoice_lines', sa.Column('serial_item_id', sa.String(), nullable=True))
    # ربط سطور الفاتورة الواردة بالمخزون
    op.add_column('bill_lines', sa.Column('inventory_item_id', sa.String(), nullable=True))
    op.add_column('bill_lines', sa.Column('serial_item_id', sa.String(), nullable=True))


def downgrade():
    op.drop_column('bill_lines', 'serial_item_id')
    op.drop_column('bill_lines', 'inventory_item_id')
    op.drop_column('invoice_lines', 'serial_item_id')
    op.drop_column('invoice_lines', 'inventory_item_id')
