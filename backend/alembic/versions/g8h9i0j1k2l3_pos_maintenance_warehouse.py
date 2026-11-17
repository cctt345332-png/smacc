"""add isolated maintenance warehouse to POS terminals

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2_migrate_legacy_hr_withdrawals
Create Date: 2026-11-17
"""
from alembic import op
import sqlalchemy as sa

revision = "g8h9i0j1k2l3"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pos_terminals",
        sa.Column("maintenance_warehouse_id", sa.String(), nullable=True),
    )
    op.create_index(
        "ix_pos_terminals_maintenance_warehouse_id",
        "pos_terminals",
        ["maintenance_warehouse_id"],
    )
    op.create_foreign_key(
        "fk_pos_terminals_maintenance_warehouse_id",
        "pos_terminals",
        "warehouses",
        ["maintenance_warehouse_id"],
        ["id"],
    )


def downgrade():
    op.drop_constraint(
        "fk_pos_terminals_maintenance_warehouse_id",
        "pos_terminals",
        type_="foreignkey",
    )
    op.drop_index("ix_pos_terminals_maintenance_warehouse_id", "pos_terminals")
    op.drop_column("pos_terminals", "maintenance_warehouse_id")
