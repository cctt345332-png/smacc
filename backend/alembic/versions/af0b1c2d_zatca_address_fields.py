"""Add structured registered address fields to VAT settings.
Revision ID: af0b1c2d
Revises: ae9f0a1b
"""
from alembic import op
import sqlalchemy as sa
revision = "af0b1c2d"
down_revision = "ae9f0a1b"
branch_labels = None
depends_on = None

def upgrade():
    for name, typ in [("zatca_address_building", sa.String(20)), ("zatca_address_street", sa.String(300)), ("zatca_address_district", sa.String(100)), ("zatca_address_city", sa.String(100)), ("zatca_address_postal", sa.String(10)), ("zatca_address_additional", sa.String(10)), ("zatca_address_country", sa.String(3))]:
        op.add_column("vat_settings", sa.Column(name, typ, nullable=True))

def downgrade():
    for name in ["zatca_address_country", "zatca_address_additional", "zatca_address_postal", "zatca_address_city", "zatca_address_district", "zatca_address_street", "zatca_address_building"]:
        op.drop_column("vat_settings", name)
