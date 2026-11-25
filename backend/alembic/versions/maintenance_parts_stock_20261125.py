"""Track reservation, issue and return for maintenance parts.
Revision ID: maintenance_parts_stock_20261125
Revises: maintenance_inspection_20261125
"""
from alembic import op
import sqlalchemy as sa

revision = "maintenance_parts_stock_20261125"
down_revision = "maintenance_inspection_20261125"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("maintenance_inspection_parts", sa.Column("warehouse_id", sa.String(), nullable=True))
    op.add_column("maintenance_inspection_parts", sa.Column("issued_by", sa.String(), nullable=True))
    op.add_column("maintenance_inspection_parts", sa.Column("issued_at", sa.DateTime(), nullable=True))
    op.add_column("maintenance_inspection_parts", sa.Column("returned_by", sa.String(), nullable=True))
    op.add_column("maintenance_inspection_parts", sa.Column("returned_at", sa.DateTime(), nullable=True))
    op.create_foreign_key("fk_maintenance_parts_warehouse", "maintenance_inspection_parts", "warehouses", ["warehouse_id"], ["id"])
    op.create_foreign_key("fk_maintenance_parts_issued_by", "maintenance_inspection_parts", "users", ["issued_by"], ["id"])
    op.create_foreign_key("fk_maintenance_parts_returned_by", "maintenance_inspection_parts", "users", ["returned_by"], ["id"])
    op.create_index("ix_maintenance_inspection_parts_warehouse_id", "maintenance_inspection_parts", ["warehouse_id"])


def downgrade():
    op.drop_index("ix_maintenance_inspection_parts_warehouse_id", table_name="maintenance_inspection_parts")
    op.drop_constraint("fk_maintenance_parts_returned_by", "maintenance_inspection_parts", type_="foreignkey")
    op.drop_constraint("fk_maintenance_parts_issued_by", "maintenance_inspection_parts", type_="foreignkey")
    op.drop_constraint("fk_maintenance_parts_warehouse", "maintenance_inspection_parts", type_="foreignkey")
    for name in ["returned_at", "returned_by", "issued_at", "issued_by", "warehouse_id"]:
        op.drop_column("maintenance_inspection_parts", name)
