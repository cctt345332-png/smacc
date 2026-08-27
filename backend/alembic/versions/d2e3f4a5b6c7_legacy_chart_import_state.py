"""track custom legacy chart import and customer accounts

Revision ID: d2e3f4a5b6c7
Revises: cc1d2e3f4a5b
Create Date: 2026-08-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector


revision = "d2e3f4a5b6c7"
down_revision = "cc1d2e3f4a5b"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = set(inspector.get_table_names())

    # حالة وصفية فقط: لا تنشئ أو تعدل فواتير أو قيود أو أرصدة.
    if "accounting_setups" in tables:
        setup_columns = {column["name"] for column in inspector.get_columns("accounting_setups")}
        with op.batch_alter_table("accounting_setups") as batch:
            if "legacy_chart_imported_at" not in setup_columns:
                batch.add_column(sa.Column("legacy_chart_imported_at", sa.DateTime(), nullable=True))
            if "legacy_chart_imported_by" not in setup_columns:
                batch.add_column(sa.Column("legacy_chart_imported_by", sa.String(), nullable=True))
                batch.create_foreign_key(
                    "fk_accounting_setups_legacy_chart_imported_by_users",
                    "users",
                    ["legacy_chart_imported_by"],
                    ["id"],
                )

    # العلامة الافتراضية False؛ لا تصنف أي حساب قائم تلقائيًا كحساب عميل.
    if "accounts" in tables:
        account_columns = {column["name"] for column in inspector.get_columns("accounts")}
        if "is_customer_account" not in account_columns:
            with op.batch_alter_table("accounts") as batch:
                batch.add_column(
                    sa.Column(
                        "is_customer_account",
                        sa.Boolean(),
                        nullable=False,
                        server_default=sa.text("false"),
                    )
                )
                batch.create_index("ix_accounts_is_customer_account", ["is_customer_account"])


def downgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = set(inspector.get_table_names())

    if "accounts" in tables:
        account_columns = {column["name"] for column in inspector.get_columns("accounts")}
        if "is_customer_account" in account_columns:
            with op.batch_alter_table("accounts") as batch:
                batch.drop_index("ix_accounts_is_customer_account")
                batch.drop_column("is_customer_account")

    if "accounting_setups" in tables:
        setup_columns = {column["name"] for column in inspector.get_columns("accounting_setups")}
        with op.batch_alter_table("accounting_setups") as batch:
            if "legacy_chart_imported_by" in setup_columns:
                batch.drop_constraint("fk_accounting_setups_legacy_chart_imported_by_users", type_="foreignkey")
                batch.drop_column("legacy_chart_imported_by")
            if "legacy_chart_imported_at" in setup_columns:
                batch.drop_column("legacy_chart_imported_at")
