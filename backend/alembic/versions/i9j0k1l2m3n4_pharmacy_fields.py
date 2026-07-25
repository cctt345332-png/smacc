"""pharmacy_fields

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa

revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('inventory_items', sa.Column('manufacturer', sa.String(200), nullable=True))
    op.add_column('inventory_items', sa.Column('sfda_number', sa.String(50), nullable=True))
    op.add_column('inventory_items', sa.Column('dosage_form', sa.String(50), nullable=True))
    op.add_column('inventory_items', sa.Column('concentration', sa.String(100), nullable=True))
    op.add_column('inventory_items', sa.Column('requires_prescription', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('inventory_items', 'requires_prescription')
    op.drop_column('inventory_items', 'concentration')
    op.drop_column('inventory_items', 'dosage_form')
    op.drop_column('inventory_items', 'sfda_number')
    op.drop_column('inventory_items', 'manufacturer')
