"""rename legacy opening balance counterpart account

Revision ID: a7b8c9d0e1f2
Revises: z2a3b4c5d6e7
"""
from alembic import op

revision = "a7b8c9d0e1f2"
down_revision = "z2a3b4c5d6e7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE accounts
        SET name_ar = 'أرصدة مرحلة من النظام السابق',
            name_en = 'Opening balances carried forward'
        WHERE code = '0311'
          AND name_ar = 'رأس المال المدفوع'
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE accounts
        SET name_ar = 'رأس المال المدفوع',
            name_en = 'Paid-in Capital'
        WHERE code = '0311'
          AND name_ar = 'أرصدة مرحلة من النظام السابق'
        """
    )
