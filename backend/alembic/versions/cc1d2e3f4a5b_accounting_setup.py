"""accounting setup and operational account mapping

Revision ID: cc1d2e3f4a5b
Revises: bb1c2d3e4f5a
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision = "cc1d2e3f4a5b"
down_revision = "bb1c2d3e4f5a"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    # جداول مستقلة: لا تلمس الفواتير أو العملاء أو القيود التاريخية.
    if "accounting_setups" not in tables:
        op.create_table(
            "accounting_setups",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("chart_initialized_at", sa.DateTime(), nullable=True),
            sa.Column("chart_initialized_by", sa.String(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("auto_posting_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id", name="uq_accounting_setup_tenant"),
        )
        op.create_index("ix_accounting_setups_tenant_id", "accounting_setups", ["tenant_id"])

    if "accounting_account_mappings" not in tables:
        op.create_table(
            "accounting_account_mappings",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("mapping_key", sa.String(length=80), nullable=False),
            sa.Column("account_id", sa.String(), sa.ForeignKey("accounts.id"), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id", "mapping_key", name="uq_accounting_mapping_tenant_key"),
        )
        op.create_index("ix_accounting_account_mappings_tenant_id", "accounting_account_mappings", ["tenant_id"])
        op.create_index("ix_accounting_account_mappings_mapping_key", "accounting_account_mappings", ["mapping_key"])


def downgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    if "accounting_account_mappings" in tables:
        op.drop_index("ix_accounting_account_mappings_mapping_key", table_name="accounting_account_mappings")
        op.drop_index("ix_accounting_account_mappings_tenant_id", table_name="accounting_account_mappings")
        op.drop_table("accounting_account_mappings")

    if "accounting_setups" in tables:
        op.drop_index("ix_accounting_setups_tenant_id", table_name="accounting_setups")
        op.drop_table("accounting_setups")
