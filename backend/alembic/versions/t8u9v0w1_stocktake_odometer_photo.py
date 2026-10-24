"""حفظ صورة قراءة عداد المركبة مع الجرد"""
from alembic import op
import sqlalchemy as sa

revision = "t8u9v0w1"
down_revision = "s7t8u9v0"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mandatory_stocktake_odometers",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("run_id", sa.String(), sa.ForeignKey("mandatory_stocktake_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=False),
        sa.Column("odometer", sa.Integer(), nullable=False),
        sa.Column("photo_data", sa.Text(), nullable=False),
        sa.Column("photo_name", sa.String(200), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("run_id", "rep_id", name="uq_mandatory_stocktake_odometer_run_rep"),
    )
    op.create_index("ix_mandatory_stocktake_odometers_tenant_id", "mandatory_stocktake_odometers", ["tenant_id"])
    op.create_index("ix_mandatory_stocktake_odometers_run_id", "mandatory_stocktake_odometers", ["run_id"])
    op.create_index("ix_mandatory_stocktake_odometers_rep_id", "mandatory_stocktake_odometers", ["rep_id"])


def downgrade():
    op.drop_table("mandatory_stocktake_odometers")
