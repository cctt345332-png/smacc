"""reps system v2 — توسيع sales_reps + invoices workflow

Revision ID: a1b2c3d4e5f6
Revises: z2a3b4c5d6e7
Create Date: 2026-07-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'a1b2c3d4e5f6'
down_revision = 'z2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. توسيع جدول sales_reps ─────────────────────────────────────
    op.add_column('sales_reps', sa.Column('vehicle_plate',   sa.String(20),      nullable=True))
    op.add_column('sales_reps', sa.Column('vehicle_type',    sa.String(100),     nullable=True))
    op.add_column('sales_reps', sa.Column('vehicle_color',   sa.String(50),      nullable=True))
    op.add_column('sales_reps', sa.Column('id_number',       sa.String(20),      nullable=True))
    op.add_column('sales_reps', sa.Column('id_expiry',       sa.Date(),          nullable=True))
    op.add_column('sales_reps', sa.Column('license_expiry',  sa.Date(),          nullable=True))
    op.add_column('sales_reps', sa.Column('target_monthly',  sa.Numeric(18, 2),  nullable=True, server_default='0'))
    op.add_column('sales_reps', sa.Column('commission_pct',  sa.Numeric(5, 2),   nullable=True, server_default='0'))

    # ── 2. توسيع InvoiceStatus enum ──────────────────────────────────
    # PostgreSQL يحتاج ALTER TYPE لإضافة قيم جديدة
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'submitted'")
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'approved'")
    op.execute("ALTER TYPE invoicestatus ADD VALUE IF NOT EXISTS 'rejected'")

    # ── 3. توسيع جدول invoices ───────────────────────────────────────
    # طريقة الدفع على الفاتورة (مختلفة عن Payment)
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoicepaymentmethod') THEN
                CREATE TYPE invoicepaymentmethod AS ENUM
                    ('cash', 'credit', 'cheque', 'transfer');
            END IF;
        END $$;
    """)

    op.add_column('invoices', sa.Column(
        'invoice_payment_method',
        sa.Enum('cash', 'credit', 'cheque', 'transfer', name='invoicepaymentmethod'),
        nullable=True
    ))
    op.add_column('invoices', sa.Column('credit_days',      sa.Integer(),        nullable=True))
    op.add_column('invoices', sa.Column('cheque_number',    sa.String(50),       nullable=True))
    op.add_column('invoices', sa.Column('cheque_date',      sa.Date(),           nullable=True))
    op.add_column('invoices', sa.Column('bank_name',        sa.String(100),      nullable=True))
    op.add_column('invoices', sa.Column('submitted_at',     sa.DateTime(),       nullable=True))
    op.add_column('invoices', sa.Column('reviewed_by',      sa.String(),         nullable=True))
    op.add_column('invoices', sa.Column('reviewed_at',      sa.DateTime(),       nullable=True))
    op.add_column('invoices', sa.Column('rejection_note',   sa.Text(),           nullable=True))


def downgrade():
    # invoices
    for col in ['invoice_payment_method', 'credit_days', 'cheque_number',
                'cheque_date', 'bank_name', 'submitted_at',
                'reviewed_by', 'reviewed_at', 'rejection_note']:
        op.drop_column('invoices', col)

    # sales_reps
    for col in ['vehicle_plate', 'vehicle_type', 'vehicle_color',
                'id_number', 'id_expiry', 'license_expiry',
                'target_monthly', 'commission_pct']:
        op.drop_column('sales_reps', col)
