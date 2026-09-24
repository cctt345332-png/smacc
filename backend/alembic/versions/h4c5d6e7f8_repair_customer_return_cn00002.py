"""repair customer return CN-00002 as non-tax return

Revision ID: h4c5d6e7f8
Revises: g3b4c5d6e7f8
"""
from alembic import op
import sqlalchemy as sa

revision = "h4c5d6e7f8"
down_revision = "g3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # Only touch this exact return number, and only when it still carries VAT.
    bind.execute(sa.text("""
        CREATE TEMP TABLE _cn_repair ON COMMIT DROP AS
        SELECT cn.id, cn.journal_entry_id, cn.subtotal, cn.vat_amount, cn.total,
               c.ar_account_id
        FROM credit_notes cn
        LEFT JOIN customers c ON c.id = cn.customer_id
        WHERE cn.credit_note_number = 'CN-00002' AND cn.vat_amount > 0
    """))
    bind.execute(sa.text("""
        UPDATE credit_note_lines l
        SET vat_rate = 0, vat_amount = 0, total = l.subtotal
        FROM _cn_repair r
        WHERE l.credit_note_id = r.id
    """))
    bind.execute(sa.text("""
        UPDATE credit_notes cn
        SET vat_amount = 0, total = cn.subtotal
        FROM _cn_repair r
        WHERE cn.id = r.id
    """))
    bind.execute(sa.text("""
        DELETE FROM journal_entry_lines jel
        USING _cn_repair r
        WHERE jel.entry_id = r.journal_entry_id
          AND jel.debit = r.vat_amount
          AND jel.credit = 0
          AND r.vat_amount > 0
    """))
    bind.execute(sa.text("""
        UPDATE journal_entry_lines jel
        SET credit = r.subtotal
        FROM _cn_repair r
        WHERE jel.entry_id = r.journal_entry_id
          AND jel.account_id = r.ar_account_id
          AND jel.credit = r.total
    """))
    bind.execute(sa.text("""
        UPDATE journal_entries je
        SET total_debit = r.subtotal, total_credit = r.subtotal
        FROM _cn_repair r
        WHERE je.id = r.journal_entry_id
    """))


def downgrade() -> None:
    # This targeted correction is intentionally not reversed automatically;
    # restoring VAT would recreate an incorrect accounting document.
    pass
