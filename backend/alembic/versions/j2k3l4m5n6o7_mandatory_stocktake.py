"""mandatory weekly stocktake for representatives
Revision ID: j2k3l4m5n6o7
Revises: i6j7k8l9m0
"""
from alembic import op
import sqlalchemy as sa

revision = "j2k3l4m5n6o7"
down_revision = "i6j7k8l9m0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mandatory_stocktake_configs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("weekday", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("start_time", sa.String(length=5), nullable=False, server_default="11:00"),
        sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Riyadh"),
        sa.Column("reminder_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("updated_by", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id"),
    )
    op.create_index("ix_mandatory_stocktake_configs_tenant_id", "mandatory_stocktake_configs", ["tenant_id"])

    op.create_table(
        "mandatory_stocktake_runs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("scheduled_at", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("submitted_by", sa.String(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewed_by", sa.String(), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["submitted_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "scheduled_at", name="uq_mandatory_stocktake_run_tenant_scheduled"),
    )
    op.create_index("ix_mandatory_stocktake_runs_tenant_id", "mandatory_stocktake_runs", ["tenant_id"])
    op.create_index("ix_mandatory_stocktake_runs_scheduled_at", "mandatory_stocktake_runs", ["scheduled_at"])
    op.create_index("ix_mandatory_stocktake_runs_status", "mandatory_stocktake_runs", ["status"])

    op.create_table(
        "mandatory_stocktake_lines",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("run_id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("rep_id", sa.String(), nullable=False),
        sa.Column("item_id", sa.String(), nullable=False),
        sa.Column("warehouse_id", sa.String(), nullable=False),
        sa.Column("tracking_type", sa.String(length=20), nullable=False),
        sa.Column("system_qty", sa.Numeric(18, 3), nullable=False, server_default="0"),
        sa.Column("counted_qty", sa.Numeric(18, 3), nullable=True),
        sa.Column("diff_qty", sa.Numeric(18, 3), nullable=True),
        sa.Column("expected_serials_json", sa.Text(), nullable=True),
        sa.Column("counted_serials_json", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("counted_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["run_id"], ["mandatory_stocktake_runs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["rep_id"], ["sales_reps.id"]),
        sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("run_id", "item_id", "warehouse_id", name="uq_mandatory_stocktake_line_item_warehouse"),
    )
    op.create_index("ix_mandatory_stocktake_lines_run_id", "mandatory_stocktake_lines", ["run_id"])
    op.create_index("ix_mandatory_stocktake_lines_tenant_id", "mandatory_stocktake_lines", ["tenant_id"])
    op.create_index("ix_mandatory_stocktake_lines_rep_id", "mandatory_stocktake_lines", ["rep_id"])
    op.create_index("ix_mandatory_stocktake_lines_item_id", "mandatory_stocktake_lines", ["item_id"])
    op.create_index("ix_mandatory_stocktake_lines_warehouse_id", "mandatory_stocktake_lines", ["warehouse_id"])


def downgrade() -> None:
    op.drop_table("mandatory_stocktake_lines")
    op.drop_table("mandatory_stocktake_runs")
    op.drop_table("mandatory_stocktake_configs")
