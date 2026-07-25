"""pos_module - create pos tables

Revision ID: a0b1c2d3e4f5
Revises: l2m3n4o5p6q7
Create Date: 2026-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = 'a0b1c2d3e4f5'
down_revision = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── POSTerminal ──────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS pos_terminals (
            id VARCHAR PRIMARY KEY,
            tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
            name VARCHAR(200) NOT NULL,
            branch_name VARCHAR(200),
            business_type VARCHAR(50) NOT NULL DEFAULT 'general',
            warehouse_id VARCHAR REFERENCES warehouses(id),
            assigned_user_id VARCHAR REFERENCES users(id),
            cash_account_id VARCHAR,
            sales_account_id VARCHAR,
            vat_account_id VARCHAR,
            bank_account_id VARCHAR,
            fiscal_year_id VARCHAR,
            receipt_header TEXT,
            receipt_footer TEXT,
            print_receipt BOOLEAN NOT NULL DEFAULT true,
            allow_discount BOOLEAN NOT NULL DEFAULT true,
            max_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 10,
            allow_purchase BOOLEAN NOT NULL DEFAULT false,
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_terminals_tenant_id ON pos_terminals(tenant_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_terminals_assigned_user_id ON pos_terminals(assigned_user_id)"))

    # ── POSSession ───────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS pos_sessions (
            id VARCHAR PRIMARY KEY,
            tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
            terminal_id VARCHAR NOT NULL REFERENCES pos_terminals(id),
            cashier_id VARCHAR NOT NULL REFERENCES users(id),
            opening_cash NUMERIC(18,2) NOT NULL DEFAULT 0,
            closing_cash NUMERIC(18,2),
            expected_cash NUMERIC(18,2),
            total_sales NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_cash NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_card NUMERIC(18,2) NOT NULL DEFAULT 0,
            total_vat NUMERIC(18,2) NOT NULL DEFAULT 0,
            transaction_count INTEGER NOT NULL DEFAULT 0,
            status VARCHAR(20) NOT NULL DEFAULT 'open',
            opened_at TIMESTAMP NOT NULL DEFAULT NOW(),
            closed_at TIMESTAMP,
            notes TEXT
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_sessions_tenant_id ON pos_sessions(tenant_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_sessions_terminal_id ON pos_sessions(terminal_id)"))

    # ── POSTransaction ───────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS pos_transactions (
            id VARCHAR PRIMARY KEY,
            tenant_id VARCHAR NOT NULL REFERENCES tenants(id),
            session_id VARCHAR NOT NULL REFERENCES pos_sessions(id),
            transaction_number VARCHAR(50) NOT NULL,
            invoice_id VARCHAR,
            journal_entry_id VARCHAR,
            customer_id VARCHAR,
            customer_name VARCHAR(300),
            customer_phone VARCHAR(20),
            subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
            discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            vat_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            total NUMERIC(18,2) NOT NULL DEFAULT 0,
            payment_method VARCHAR(20) NOT NULL DEFAULT 'cash',
            cash_tendered NUMERIC(18,2),
            change_amount NUMERIC(18,2),
            card_amount NUMERIC(18,2),
            qr_code TEXT,
            uuid VARCHAR(36),
            status VARCHAR(20) NOT NULL DEFAULT 'completed',
            created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_transactions_tenant_id ON pos_transactions(tenant_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_transactions_session_id ON pos_transactions(session_id)"))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_transactions_number ON pos_transactions(transaction_number)"))

    # ── POSTransactionLine ───────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS pos_transaction_lines (
            id VARCHAR PRIMARY KEY,
            transaction_id VARCHAR NOT NULL REFERENCES pos_transactions(id),
            inventory_item_id VARCHAR,
            product_name_ar VARCHAR(300) NOT NULL,
            barcode VARCHAR(100),
            serial_item_id VARCHAR,
            variant_id VARCHAR,
            batch_id VARCHAR,
            quantity NUMERIC(18,3) NOT NULL,
            unit_price NUMERIC(18,2) NOT NULL,
            discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
            discount_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            vat_rate NUMERIC(5,2) NOT NULL DEFAULT 15,
            vat_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
            total NUMERIC(18,2) NOT NULL
        )
    """))
    conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_pos_transaction_lines_transaction_id ON pos_transaction_lines(transaction_id)"))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS pos_transaction_lines"))
    conn.execute(sa.text("DROP TABLE IF EXISTS pos_transactions"))
    conn.execute(sa.text("DROP TABLE IF EXISTS pos_sessions"))
    conn.execute(sa.text("DROP TABLE IF EXISTS pos_terminals"))
