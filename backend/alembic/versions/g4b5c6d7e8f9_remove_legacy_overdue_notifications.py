"""remove legacy overdue notification rows

Revision ID: g4b5c6d7e8f9
Revises: f3a4b5c6d7e8
"""
from typing import Sequence, Union

from alembic import op


revision: str = "g4b5c6d7e8f9"
down_revision: Union[str, None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # إشعارات التأخر القديمة كانت محسوبة بـ due_date/paid_amount،
    # وليست من مصدر FIFO الموحد. نحذفها حتى لا تبقى ظاهرة في الجرس.
    op.execute(
        """
        DELETE FROM notifications
        WHERE type::text IN ('SALES_OVERDUE_INVOICE', 'sales_overdue_invoice')
        """
    )


def downgrade() -> None:
    # لا نعيد سجلات قديمة محسوبة بمنطق غير موحد.
    pass
