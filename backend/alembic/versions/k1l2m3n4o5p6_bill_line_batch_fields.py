"""bill_line_batch_fields

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-04-21

"""
from alembic import op
import sqlalchemy as sa

revision = 'k1l2m3n4o5p6'
down_revision = 'j0k1l2m3n4o5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('bill_lines', sa.Column('batch_number', sa.String(100), nullable=True))
    op.add_column('bill_lines', sa.Column('batch_expiry_date', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('bill_lines', 'batch_expiry_date')
    op.drop_column('bill_lines', 'batch_number')
