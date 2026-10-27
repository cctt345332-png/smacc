"""store ZATCA compliance test steps

Revision ID: af1b2c3d
Revises: af0b1c2d
"""
from alembic import op
import sqlalchemy as sa

revision = "af1b2c3d"
down_revision = "af0b1c2d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("vat_settings", sa.Column("zatca_compliance_steps", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("vat_settings", "zatca_compliance_steps")
