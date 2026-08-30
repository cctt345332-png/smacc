"""Add customer account branch to sales reps.

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
"""
from alembic import op
import sqlalchemy as sa

revision = "e3f4a5b6c7d8"
down_revision = "d2e3f4a5b6c7"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    columns = [r[0] for r in conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns WHERE table_name='sales_reps'"
    ))]
    if "customer_account_id" not in columns:
        op.add_column(
            "sales_reps",
            sa.Column("customer_account_id", sa.String(), nullable=True),
        )
    indexes = [r[0] for r in conn.execute(sa.text(
        "SELECT indexname FROM pg_indexes WHERE tablename='sales_reps'"
    ))]
    if "ix_sales_reps_customer_account_id" not in indexes:
        op.create_index(
            "ix_sales_reps_customer_account_id", "sales_reps", ["customer_account_id"]
        )
    constraints = [r[0] for r in conn.execute(sa.text(
        "SELECT constraint_name FROM information_schema.table_constraints WHERE table_name='sales_reps'"
    ))]
    if "fk_sales_reps_customer_account_id" not in constraints:
        op.create_foreign_key(
            "fk_sales_reps_customer_account_id", "sales_reps", "accounts",
            ["customer_account_id"], ["id"], ondelete="SET NULL"
        )


def downgrade():
    op.drop_constraint("fk_sales_reps_customer_account_id", "sales_reps", type_="foreignkey")
    op.drop_index("ix_sales_reps_customer_account_id", table_name="sales_reps")
    op.drop_column("sales_reps", "customer_account_id")
