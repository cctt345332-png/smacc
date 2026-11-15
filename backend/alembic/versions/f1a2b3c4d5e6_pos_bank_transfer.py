"""Add bank transfer payment account to POS terminals and sessions."""
from alembic import op
import sqlalchemy as sa

revision = "f1a2b3c4d5e6"
down_revision = "e0f1a2b3c4d5"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("pos_terminals", sa.Column("bank_transfer_account_id", sa.String(), nullable=True))
    op.create_foreign_key("fk_pos_terminals_bank_transfer_account", "pos_terminals", "accounts", ["bank_transfer_account_id"], ["id"])
    op.add_column("pos_sessions", sa.Column("total_bank_transfer", sa.Numeric(18, 2), nullable=False, server_default="0"))

def downgrade():
    op.drop_column("pos_sessions", "total_bank_transfer")
    op.drop_constraint("fk_pos_terminals_bank_transfer_account", "pos_terminals", type_="foreignkey")
    op.drop_column("pos_terminals", "bank_transfer_account_id")
