"""Add optional POS sale price to inventory items.

Revision ID: pos_sale_price_20261126
Revises: maintenance_billing_20261125
"""
from alembic import op
import sqlalchemy as sa

revision = "pos_sale_price_20261126"
down_revision = "maintenance_billing_20261125"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "inventory_items",
        sa.Column("pos_sale_price", sa.Numeric(18, 4), nullable=True),
    )


def downgrade():
    op.drop_column("inventory_items", "pos_sale_price")
