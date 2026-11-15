"""Add biometric devices, employee links, shifts and raw attendance logs.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
"""
from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7a8b9"
down_revision = "b3c4d5e6f7a8"
branch_labels = None

def upgrade():
    op.create_table(
        "hr_work_shifts",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("name_ar", sa.String(120), nullable=False),
        sa.Column("name_en", sa.String(120), nullable=True),
        sa.Column("start_time", sa.String(5), nullable=False, server_default="09:00"),
        sa.Column("end_time", sa.String(5), nullable=False, server_default="17:00"),
        sa.Column("grace_minutes", sa.Integer(), nullable=False, server_default="15"),
        sa.Column("working_days", sa.String(30), nullable=False, server_default="0,1,2,3,4"),
        sa.Column("is_overnight", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "hr_biometric_devices",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("device_type", sa.String(40), nullable=False, server_default="generic"),
        sa.Column("connection_mode", sa.String(20), nullable=False, server_default="agent"),
        sa.Column("host", sa.String(255), nullable=True),
        sa.Column("port", sa.Integer(), nullable=True),
        sa.Column("branch_id", sa.String(), nullable=True),
        sa.Column("api_key_hash", sa.String(128), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_sync_at", sa.DateTime(), nullable=True),
        sa.Column("last_sync_status", sa.String(30), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "hr_biometric_employee_links",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("device_id", sa.String(), sa.ForeignKey("hr_biometric_devices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("employee_id", sa.String(), sa.ForeignKey("hr_employees.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("device_user_id", sa.String(80), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("device_id", "device_user_id", name="uq_bio_device_user"),
    )
    op.create_table(
        "hr_biometric_logs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False, index=True),
        sa.Column("device_id", sa.String(), sa.ForeignKey("hr_biometric_devices.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("device_user_id", sa.String(80), nullable=False, index=True),
        sa.Column("occurred_at", sa.DateTime(), nullable=False, index=True),
        sa.Column("event_type", sa.String(30), nullable=True),
        sa.Column("external_id", sa.String(160), nullable=True, unique=True),
        sa.Column("raw_payload", sa.Text(), nullable=True),
        sa.Column("processed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

def downgrade():
    op.drop_table("hr_biometric_logs")
    op.drop_table("hr_biometric_employee_links")
    op.drop_table("hr_biometric_devices")
    op.drop_table("hr_work_shifts")
