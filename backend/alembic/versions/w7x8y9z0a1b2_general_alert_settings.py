"""general_alert_settings — توسيع التنبيهات لكل الأقسام

Revision ID: w7x8y9z0a1b2
Revises: v6w7x8y9z0a1
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'w7x8y9z0a1b2'
down_revision = 'v6w7x8y9z0a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # جدول إعدادات التنبيهات العامة
    op.create_table(
        'alert_settings',
        sa.Column('id',         sa.String(), primary_key=True),
        sa.Column('tenant_id',  sa.String(), sa.ForeignKey('tenants.id'), unique=True, nullable=False),
        # الأصول
        sa.Column('asset_warranty_alert',              sa.Boolean(), server_default='true'),
        sa.Column('asset_warranty_days',               sa.Integer(), server_default='30'),
        sa.Column('asset_full_depreciation_alert',     sa.Boolean(), server_default='true'),
        sa.Column('asset_depreciation_due_alert',      sa.Boolean(), server_default='true'),
        sa.Column('asset_depreciation_due_days',       sa.Integer(), server_default='35'),
        sa.Column('asset_high_depreciation_alert',     sa.Boolean(), server_default='true'),
        sa.Column('asset_high_depreciation_threshold', sa.Integer(), server_default='90'),
        # المخزون
        sa.Column('inventory_low_stock_alert',         sa.Boolean(), server_default='true'),
        sa.Column('inventory_expiry_alert',            sa.Boolean(), server_default='true'),
        sa.Column('inventory_expiry_days',             sa.Integer(), server_default='30'),
        # المبيعات
        sa.Column('sales_overdue_alert',               sa.Boolean(), server_default='true'),
        sa.Column('sales_overdue_days',                sa.Integer(), server_default='7'),
        sa.Column('sales_credit_limit_alert',          sa.Boolean(), server_default='true'),
        # المشتريات
        sa.Column('purchases_overdue_alert',           sa.Boolean(), server_default='true'),
        sa.Column('purchases_overdue_days',            sa.Integer(), server_default='7'),
        # HR
        sa.Column('hr_leave_request_alert',            sa.Boolean(), server_default='true'),
        sa.Column('hr_contract_expiry_alert',          sa.Boolean(), server_default='true'),
        sa.Column('hr_contract_expiry_days',           sa.Integer(), server_default='30'),
        # المحاسبة
        sa.Column('vat_due_alert',                     sa.Boolean(), server_default='true'),
        sa.Column('vat_due_days',                      sa.Integer(), server_default='7'),
        sa.Column('updated_at',                        sa.DateTime(), nullable=False),
    )

    # إضافة أنواع التنبيهات الجديدة للجدول الموجود
    # (الجدول notifications يستخدم String للـ type فلا يحتاج تعديل)


def downgrade() -> None:
    op.drop_table('alert_settings')
