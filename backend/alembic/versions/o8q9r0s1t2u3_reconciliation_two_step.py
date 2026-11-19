"""allow issuing reconciliation statement before customer confirmation"""
from alembic import op
import sqlalchemy as sa

revision = "o8q9r0s1t2u3"
down_revision = "n7p8q9r0s1t2"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("customer_balance_reconciliations", "acknowledged_balance", existing_type=sa.Numeric(18, 2), nullable=True, server_default=None)
    op.alter_column("customer_balance_reconciliations", "difference", existing_type=sa.Numeric(18, 2), nullable=True, server_default=None)
    op.alter_column("customer_balance_reconciliations", "status", existing_type=sa.String(20), server_default="issued")


def downgrade():
    op.alter_column("customer_balance_reconciliations", "acknowledged_balance", existing_type=sa.Numeric(18, 2), nullable=False, server_default="0")
    op.alter_column("customer_balance_reconciliations", "difference", existing_type=sa.Numeric(18, 2), nullable=False, server_default="0")
    op.alter_column("customer_balance_reconciliations", "status", existing_type=sa.String(20), server_default="confirmed")
