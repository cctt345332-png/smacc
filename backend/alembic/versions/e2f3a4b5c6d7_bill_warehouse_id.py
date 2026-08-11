"""bill_warehouse_id — إضافة warehouse_id لجدول bills

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = 'e2f3a4b5c6d7'
down_revision = 'd1e2f3a4b5c6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    cols = [c["name"] for c in inspector.get_columns("bills")]
    if "warehouse_id" not in cols:
        op.add_column("bills", sa.Column(
            "warehouse_id", sa.String(),
            sa.ForeignKey("warehouses.id"),
            nullable=True
        ))
        op.create_index("ix_bills_warehouse_id", "bills", ["warehouse_id"])


def downgrade():
    op.drop_index("ix_bills_warehouse_id", "bills")
    op.drop_column("bills", "warehouse_id")
