"""product_option_groups_and_options

Revision ID: t4u5v6w7x8y9
Revises: s3t4u5v6w7x8
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa

revision = 't4u5v6w7x8y9'
down_revision = 's3t4u5v6w7x8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── جدول محاور التخصيص ──────────────────────────────────────────
    # مثال: "اللون"، "السعة"، "المقاس"
    op.create_table(
        'product_option_groups',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('product_id', sa.String(36), sa.ForeignKey('inventory_items.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name_ar', sa.String(100), nullable=False),   # "اللون" / "السعة" / "المقاس"
        sa.Column('name_en', sa.String(100), nullable=True),
        sa.Column('type', sa.String(20), nullable=False, server_default='text'),
        # text | color | image | number
        sa.Column('is_required', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )

    # ── جدول قيم التخصيص ────────────────────────────────────────────
    # مثال: "أسود"، "128GB"، "L"
    op.create_table(
        'product_options',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('group_id', sa.String(36), sa.ForeignKey('product_option_groups.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('value', sa.String(200), nullable=False),     # "أسود" / "128GB" / "L"
        sa.Column('color_hex', sa.String(7), nullable=True),    # "#000000" للنوع color
        sa.Column('image_url', sa.Text(), nullable=True),       # للنوع image
        sa.Column('price_modifier', sa.Numeric(18, 2), nullable=False, server_default='0'),
        # +200 يعني يُضاف للسعر الأساسي
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
    )

    # ── تعديل جدول ProductVariant — إضافة options_json ──────────────
    # options_json: snapshot للخيارات المختارة
    # مثال: {"اللون": "أسود", "السعة": "128GB"}
    op.add_column(
        'product_variants',
        sa.Column('options_json', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('product_variants', 'options_json')
    op.drop_table('product_options')
    op.drop_table('product_option_groups')
