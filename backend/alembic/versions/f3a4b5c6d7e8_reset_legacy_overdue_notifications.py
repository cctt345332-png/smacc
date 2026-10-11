"""reset legacy overdue notifications

Revision ID: f3a4b5c6d7e8
Revises: e1f2a3b4c5d7
"""
from typing import Sequence, Union

from alembic import op


revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, None] = "e1f2a3b4c5d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # هذه السجلات أنشأها الفحص القديم اعتماداً على due_date وpaid_amount.
    # نغلقها كمقروءة فقط، ثم ينشئ الفحص الموحد السجلات الصحيحة من FIFO.
    op.execute(
        """
        UPDATE notifications
        SET is_read = TRUE
        WHERE is_read = FALSE
          AND type::text IN ('SALES_OVERDUE_INVOICE', 'sales_overdue_invoice')
        """
    )


def downgrade() -> None:
    # لا يمكن عكس حالة القراءة دون إعادة إشعارات قديمة غير صحيحة.
    pass
