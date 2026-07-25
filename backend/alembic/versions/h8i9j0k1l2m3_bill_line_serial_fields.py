"""bill_line_serial_fields

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa

revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bill_lines', sa.Column('new_serial_number', sa.String(100), nullable=True))
    op.add_column('bill_lines', sa.Column('new_serial_condition', sa.String(20), nullable=True))
    op.add_column('bill_lines', sa.Column('new_serial_sale_price', sa.Numeric(18, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('bill_lines', 'new_serial_sale_price')
    op.drop_column('bill_lines', 'new_serial_condition')
    op.drop_column('bill_lines', 'new_serial_number')
