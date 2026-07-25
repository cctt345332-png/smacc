"""treasury_module

Revision ID: 3aef580d9287
Revises: efb60162af1b
Create Date: 2026-04-19 17:52:57.708222

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '3aef580d9287'
down_revision: Union[str, None] = 'efb60162af1b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# paymentmethod enum already exists — reuse it
existing_paymentmethod = postgresql.ENUM(
    'CASH', 'BANK_TRANSFER', 'CHEQUE', 'MADA', 'STC_PAY', 'CREDIT_CARD',
    name='paymentmethod', create_type=False
)


def upgrade() -> None:
    op.create_table('vouchers',
    sa.Column('id', sa.String(), nullable=False),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('voucher_number', sa.String(length=50), nullable=False),
    sa.Column('voucher_type', sa.Enum('RECEIPT', 'PAYMENT', 'EXPENSE', 'TRANSFER', name='vouchertype'), nullable=False),
    sa.Column('status', sa.Enum('DRAFT', 'POSTED', 'CANCELLED', name='voucherstatus'), nullable=False),
    sa.Column('voucher_date', sa.DateTime(), nullable=False),
    sa.Column('amount', sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column('currency_code', sa.String(length=3), nullable=False),
    sa.Column('payment_method', existing_paymentmethod, nullable=False),
    sa.Column('bank_account_id', sa.String(), nullable=True),
    sa.Column('cheque_number', sa.String(length=50), nullable=True),
    sa.Column('cheque_date', sa.DateTime(), nullable=True),
    sa.Column('party_type', sa.String(length=20), nullable=True),
    sa.Column('party_id', sa.String(), nullable=True),
    sa.Column('party_name', sa.String(length=300), nullable=True),
    sa.Column('invoice_id', sa.String(), nullable=True),
    sa.Column('purchase_id', sa.String(), nullable=True),
    sa.Column('asset_id', sa.String(), nullable=True),
    sa.Column('expense_category', sa.Enum('RENT', 'UTILITIES', 'SALARIES', 'MAINTENANCE', 'TRANSPORT', 'MARKETING', 'OFFICE', 'INSURANCE', 'GOVERNMENT', 'OTHER', name='expensecategory'), nullable=True),
    sa.Column('debit_account_id', sa.String(), nullable=True),
    sa.Column('credit_account_id', sa.String(), nullable=True),
    sa.Column('cost_center_id', sa.String(), nullable=True),
    sa.Column('fiscal_year_id', sa.String(), nullable=True),
    sa.Column('journal_entry_id', sa.String(), nullable=True),
    sa.Column('description_ar', sa.String(length=500), nullable=False),
    sa.Column('description_en', sa.String(length=500), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('reference', sa.String(length=100), nullable=True),
    sa.Column('vat_amount', sa.Numeric(precision=18, scale=2), nullable=False),
    sa.Column('vat_account_id', sa.String(), nullable=True),
    sa.Column('to_bank_account_id', sa.String(), nullable=True),
    sa.Column('created_by', sa.String(), nullable=False),
    sa.Column('posted_by', sa.String(), nullable=True),
    sa.Column('posted_at', sa.DateTime(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['asset_id'], ['assets.id'], ),
    sa.ForeignKeyConstraint(['bank_account_id'], ['bank_accounts.id'], ),
    sa.ForeignKeyConstraint(['cost_center_id'], ['cost_centers.id'], ),
    sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
    sa.ForeignKeyConstraint(['credit_account_id'], ['accounts.id'], ),
    sa.ForeignKeyConstraint(['debit_account_id'], ['accounts.id'], ),
    sa.ForeignKeyConstraint(['fiscal_year_id'], ['fiscal_years.id'], ),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
    sa.ForeignKeyConstraint(['to_bank_account_id'], ['bank_accounts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vouchers_tenant_id'), 'vouchers', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_vouchers_voucher_number'), 'vouchers', ['voucher_number'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vouchers_voucher_number'), table_name='vouchers')
    op.drop_index(op.f('ix_vouchers_tenant_id'), table_name='vouchers')
    op.drop_table('vouchers')
