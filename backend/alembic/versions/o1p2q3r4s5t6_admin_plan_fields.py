"""admin_plan_fields

Revision ID: o1p2q3r4s5t6
Revises: n1o2p3q4r5s6
Create Date: 2026-05-03

إضافة حقول الخطة والمدير العام:
- tenants.plan          → خطة الاشتراك (trial/starter/professional/enterprise)
- tenants.plan_expires_at → تاريخ انتهاء الخطة
- tenants.business_type → موجود بالفعل، نتأكد من القيمة الافتراضية
- users.role            → نضيف قيمة super_admin
"""
from alembic import op
import sqlalchemy as sa

revision = 'o1p2q3r4s5t6'
down_revision = 'n1o2p3q4r5s6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # خطة الاشتراك
    op.add_column('tenants', sa.Column(
        'plan', sa.String(50), nullable=True, server_default='trial'
    ))
    # تاريخ انتهاء الخطة
    op.add_column('tenants', sa.Column(
        'plan_expires_at', sa.DateTime(), nullable=True
    ))
    # ملاحظات المدير
    op.add_column('tenants', sa.Column(
        'admin_notes', sa.Text(), nullable=True
    ))


def downgrade() -> None:
    op.drop_column('tenants', 'admin_notes')
    op.drop_column('tenants', 'plan_expires_at')
    op.drop_column('tenants', 'plan')
