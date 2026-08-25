"""rep_attendance — سجلات الحضور اليومية للمناديب

Revision ID: aa1b2c3d4e5f
Revises: c5d6e7f8a9b0
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "aa1b2c3d4e5f"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    if "rep_attendance" not in tables:
        op.create_table(
            "rep_attendance",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=False),
            sa.Column("attendance_date", sa.Date(), nullable=False),
            sa.Column("check_in_at", sa.DateTime(), nullable=False),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="present"),
            sa.Column("source", sa.String(length=30), nullable=False, server_default="rep_dashboard"),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id", "rep_id", "attendance_date", name="uq_rep_attendance_daily"),
        )
        op.create_index("ix_rep_attendance_tenant_id", "rep_attendance", ["tenant_id"])
        op.create_index("ix_rep_attendance_rep_id", "rep_attendance", ["rep_id"])
        op.create_index("ix_rep_attendance_date", "rep_attendance", ["attendance_date"])


def downgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    if "rep_attendance" in inspector.get_table_names():
        op.drop_index("ix_rep_attendance_date", table_name="rep_attendance")
        op.drop_index("ix_rep_attendance_rep_id", table_name="rep_attendance")
        op.drop_index("ix_rep_attendance_tenant_id", table_name="rep_attendance")
        op.drop_table("rep_attendance")
