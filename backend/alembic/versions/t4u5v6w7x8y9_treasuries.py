"""add independent treasuries and link vouchers"""
from alembic import op
import sqlalchemy as sa

revision = "treasury_20261124"
down_revision = "s1t2u3v4w5x6"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "treasuries",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("name_ar", sa.String(200), nullable=False),
        sa.Column("name_en", sa.String(200), nullable=True),
        sa.Column("branch_name", sa.String(200), nullable=True),
        sa.Column("account_id", sa.String(), sa.ForeignKey("accounts.id"), nullable=False),
        sa.Column("opening_balance", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_treasuries_tenant_id", "treasuries", ["tenant_id"])
    op.create_index("ix_treasuries_account_id", "treasuries", ["account_id"])
    op.add_column("vouchers", sa.Column("treasury_id", sa.String(), sa.ForeignKey("treasuries.id"), nullable=True))
    op.create_index("ix_vouchers_treasury_id", "vouchers", ["treasury_id"])
    op.add_column("vouchers", sa.Column("to_treasury_id", sa.String(), sa.ForeignKey("treasuries.id"), nullable=True))
    op.create_index("ix_vouchers_to_treasury_id", "vouchers", ["to_treasury_id"])


def downgrade():
    op.drop_index("ix_vouchers_treasury_id", table_name="vouchers")
    op.drop_index("ix_vouchers_to_treasury_id", table_name="vouchers")
    op.drop_column("vouchers", "to_treasury_id")
    op.drop_column("vouchers", "treasury_id")
    op.drop_index("ix_treasuries_account_id", table_name="treasuries")
    op.drop_index("ix_treasuries_tenant_id", table_name="treasuries")
    op.drop_table("treasuries")
