"""order_line_variant_fields

Revision ID: s3t4u5v6w7x8
Revises: r2s3t4u5v6w7
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa

revision = 's3t4u5v6w7x8'
down_revision = 'r2s3t4u5v6w7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # حقول المتغير في سطر الطلب
    # variant_id       → ID المتغير المحدد (للملابس)
    # variant_attrs_json → snapshot للمتغير وقت الطلب
    #   مثال: {"size": "L", "color": "أحمر", "sku_variant": "SKU-001"}
    # selected_attrs_json → خصائص مختارة من العميل (لون، سعة، إلخ)
    #   مثال mobile: {"color": "أسود", "storage": "128GB"}
    #   مثال pharmacy: {"batch_number": "B001", "expiry_date": "2026-12-31"}
    op.add_column('store_order_lines', sa.Column('variant_id', sa.String(36), nullable=True))
    op.add_column('store_order_lines', sa.Column('variant_attrs_json', sa.Text(), nullable=True))
    op.add_column('store_order_lines', sa.Column('selected_attrs_json', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('store_order_lines', 'variant_id')
    op.drop_column('store_order_lines', 'variant_attrs_json')
    op.drop_column('store_order_lines', 'selected_attrs_json')
