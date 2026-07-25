"""variant_id_lines

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-04-21

"""
from alembic import op
import sqlalchemy as sa

revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('invoice_lines', sa.Column('variant_id', sa.String(), nullable=True))
    op.add_column('bill_lines', sa.Column('variant_id', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('bill_lines', 'variant_id')
    op.drop_column('invoice_lines', 'variant_id')
