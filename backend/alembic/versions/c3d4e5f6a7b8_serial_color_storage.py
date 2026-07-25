"""serial_color_storage

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-20 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('serial_items', sa.Column('color', sa.String(50), nullable=True))
    op.add_column('serial_items', sa.Column('storage', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('serial_items', 'storage')
    op.drop_column('serial_items', 'color')
