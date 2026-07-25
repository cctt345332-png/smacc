"""extra_attrs_for_inventory_items

Revision ID: r2s3t4u5v6w7
Revises: q1r2s3t4u5v6
Create Date: 2026-05-05
"""
from alembic import op
import sqlalchemy as sa

revision = 'r2s3t4u5v6w7'
down_revision = 'q1r2s3t4u5v6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # حقل JSON لتخزين التخصيصات الإضافية لكل صنف
    # مثال: {"weight_unit": "kg", "origin": "السعودية", "ram": "8GB", "network": "5G"}
    op.add_column(
        'inventory_items',
        sa.Column('extra_attrs_json', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('inventory_items', 'extra_attrs_json')
