"""add customer location coordinates

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
"""
from alembic import op
import sqlalchemy as sa

revision = "d0e1f2a3b4c5"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("customers")}
    if "latitude" not in columns:
        op.add_column("customers", sa.Column("latitude", sa.Numeric(10, 7), nullable=True))
    if "longitude" not in columns:
        op.add_column("customers", sa.Column("longitude", sa.Numeric(10, 7), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("customers")}
    if "longitude" in columns:
        op.drop_column("customers", "longitude")
    if "latitude" in columns:
        op.drop_column("customers", "latitude")
