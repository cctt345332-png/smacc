"""Link POS terminals to treasuries and record custody cash transfers.
Revision ID: pos_treasury_settlement_20261128
Revises: pos_sale_price_20261126
"""
from alembic import op
import sqlalchemy as sa

revision = "pos_treasury_settlement_20261128"
down_revision = "pos_sale_price_20261126"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("pos_terminals", sa.Column("treasury_id", sa.String(), nullable=True))
    op.create_index("ix_pos_terminals_treasury_id", "pos_terminals", ["treasury_id"], unique=False)
    op.create_foreign_key("fk_pos_terminals_treasury_id", "pos_terminals", "treasuries", ["treasury_id"], ["id"])
    op.add_column("custody_settlements", sa.Column("source_treasury_id", sa.String(), nullable=True))
    op.add_column("custody_settlements", sa.Column("destination_treasury_id", sa.String(), nullable=True))
    op.add_column("custody_settlements", sa.Column("transfer_voucher_id", sa.String(), nullable=True))
    op.create_index("ix_custody_settlements_transfer_voucher_id", "custody_settlements", ["transfer_voucher_id"], unique=False)
    op.add_column("custody_settlements", sa.Column("retained_amount", sa.Numeric(18, 2), nullable=False, server_default="0"))
    op.create_foreign_key("fk_custody_settlements_source_treasury", "custody_settlements", "treasuries", ["source_treasury_id"], ["id"])
    op.create_foreign_key("fk_custody_settlements_destination_treasury", "custody_settlements", "treasuries", ["destination_treasury_id"], ["id"])

def downgrade():
    op.drop_constraint("fk_custody_settlements_destination_treasury", "custody_settlements", type_="foreignkey")
    op.drop_constraint("fk_custody_settlements_source_treasury", "custody_settlements", type_="foreignkey")
    op.drop_column("custody_settlements", "retained_amount")
    op.drop_index("ix_custody_settlements_transfer_voucher_id", table_name="custody_settlements")
    op.drop_column("custody_settlements", "transfer_voucher_id")
    op.drop_column("custody_settlements", "destination_treasury_id")
    op.drop_column("custody_settlements", "source_treasury_id")
    op.drop_constraint("fk_pos_terminals_treasury_id", "pos_terminals", type_="foreignkey")
    op.drop_index("ix_pos_terminals_treasury_id", table_name="pos_terminals")
    op.drop_column("pos_terminals", "treasury_id")
