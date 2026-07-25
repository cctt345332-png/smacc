"""sales_reps_module

Revision ID: y1z2a3b4c5d6
Revises: x1y2z3a4b5c6
Create Date: 2026-07-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'y1z2a3b4c5d6'
down_revision = 'x1y2z3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sales_reps',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('warehouse_id', sa.String(), sa.ForeignKey('warehouses.id'), nullable=False),
        sa.Column('rep_code', sa.String(50), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('zone', sa.String(200), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_sales_reps_user_id'),
    )
    op.create_index('ix_sales_reps_tenant_id', 'sales_reps', ['tenant_id'])
    op.create_index('ix_sales_reps_user_id', 'sales_reps', ['user_id'])
    op.create_index('ix_sales_reps_warehouse_id', 'sales_reps', ['warehouse_id'])
    op.create_index('ix_sales_reps_rep_code', 'sales_reps', ['rep_code'])

    # إضافة rep_id على الفواتير لربط الفاتورة بالمندوب
    op.add_column('invoices', sa.Column('rep_id', sa.String(), sa.ForeignKey('sales_reps.id'), nullable=True))
    op.create_index('ix_invoices_rep_id', 'invoices', ['rep_id'])

    # إضافة rep_id على سندات القبض
    op.add_column('payments', sa.Column('rep_id', sa.String(), sa.ForeignKey('sales_reps.id'), nullable=True))


def downgrade():
    op.drop_index('ix_invoices_rep_id', 'invoices')
    op.drop_column('invoices', 'rep_id')
    op.drop_column('payments', 'rep_id')
    op.drop_index('ix_sales_reps_rep_code', 'sales_reps')
    op.drop_index('ix_sales_reps_warehouse_id', 'sales_reps')
    op.drop_index('ix_sales_reps_user_id', 'sales_reps')
    op.drop_index('ix_sales_reps_tenant_id', 'sales_reps')
    op.drop_table('sales_reps')
