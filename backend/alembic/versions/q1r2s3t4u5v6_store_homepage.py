"""store_homepage_content

Revision ID: q1r2s3t4u5v6
Revises: p1q2r3s4t5u6
Create Date: 2026-05-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

revision = 'q1r2s3t4u5v6'
down_revision = 'p1q2r3s4t5u6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── إضافة حقول الصفحة الرئيسية للمتجر ──────────────────────────
    op.add_column('stores', sa.Column('homepage_config', sa.Text(), nullable=True))
    # homepage_config: JSON يحتوي على:
    # {
    #   "hero": { "title_ar", "title_en", "subtitle_ar", "subtitle_en", "image_url", "cta_text_ar", "cta_url" },
    #   "banners": [ { "image_url", "title_ar", "link_url", "sort_order" } ],
    #   "slider": [ { "image_url", "title_ar", "subtitle_ar", "link_url" } ],
    #   "featured_products": [ product_id, ... ],
    #   "offers": [ { "title_ar", "description_ar", "image_url", "discount_pct", "end_date" } ],
    #   "sections": [ { "type": "text|products|banner|offer", "title_ar", "content", "sort_order" } ],
    #   "show_categories": true,
    #   "show_featured": true,
    #   "show_new_arrivals": true,
    #   "announcement_bar": { "text_ar", "enabled", "color" }
    # }

    # ── إضافة حقول إضافية للمنتج ─────────────────────────────────────
    op.add_column('store_products', sa.Column('tags', sa.Text(), nullable=True))  # JSON array
    op.add_column('store_products', sa.Column('meta_title_ar', sa.String(300), nullable=True))
    op.add_column('store_products', sa.Column('meta_description_ar', sa.Text(), nullable=True))
    op.add_column('store_products', sa.Column('variants_json', sa.Text(), nullable=True))  # للمتغيرات

    # ── إضافة حقول للطلب ─────────────────────────────────────────────
    op.add_column('store_orders', sa.Column('confirmed_at', sa.DateTime(), nullable=True))
    op.add_column('store_orders', sa.Column('shipped_at', sa.DateTime(), nullable=True))
    op.add_column('store_orders', sa.Column('delivered_at', sa.DateTime(), nullable=True))
    op.add_column('store_orders', sa.Column('tracking_number', sa.String(100), nullable=True))
    op.add_column('store_orders', sa.Column('admin_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('stores', 'homepage_config')
    op.drop_column('store_products', 'tags')
    op.drop_column('store_products', 'meta_title_ar')
    op.drop_column('store_products', 'meta_description_ar')
    op.drop_column('store_products', 'variants_json')
    op.drop_column('store_orders', 'confirmed_at')
    op.drop_column('store_orders', 'shipped_at')
    op.drop_column('store_orders', 'delivered_at')
    op.drop_column('store_orders', 'tracking_number')
    op.drop_column('store_orders', 'admin_notes')
