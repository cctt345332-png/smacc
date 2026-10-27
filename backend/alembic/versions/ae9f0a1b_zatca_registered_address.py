"""Add registered address to ZATCA settings.

Revision ID: ae9f0a1b
Revises: ad8e9f0a
"""
from alembic import op
import sqlalchemy as sa

revision = "ae9f0a1b"
down_revision = "ad8e9f0a"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("vat_settings", sa.Column("zatca_registered_address", sa.String(length=300), nullable=True))


def downgrade():
    op.drop_column("vat_settings", "zatca_registered_address")
