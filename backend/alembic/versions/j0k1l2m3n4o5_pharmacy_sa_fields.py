"""pharmacy_sa_fields

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-04-20

"""
from alembic import op
import sqlalchemy as sa

revision = 'j0k1l2m3n4o5'
down_revision = 'i9j0k1l2m3n4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('inventory_items', sa.Column('generic_name', sa.String(300), nullable=True))
    op.add_column('inventory_items', sa.Column('country_of_origin', sa.String(100), nullable=True))
    op.add_column('inventory_items', sa.Column('import_license', sa.String(100), nullable=True))
    op.add_column('inventory_items', sa.Column('gs1_code', sa.String(50), nullable=True))
    op.add_column('inventory_items', sa.Column('nphies_code', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('inventory_items', 'nphies_code')
    op.drop_column('inventory_items', 'gs1_code')
    op.drop_column('inventory_items', 'import_license')
    op.drop_column('inventory_items', 'country_of_origin')
    op.drop_column('inventory_items', 'generic_name')
