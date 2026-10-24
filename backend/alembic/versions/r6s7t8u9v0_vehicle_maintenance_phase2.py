"""توسعة صيانة مركبات المناديب — المرحلة الثانية"""
from alembic import op
import sqlalchemy as sa

revision = "r6s7t8u9v0"
down_revision = "q5r6s7t8u9v0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("rep_vehicles", sa.Column("tire_interval_km", sa.Integer(), nullable=False, server_default="40000"))
    op.add_column("rep_vehicles", sa.Column("battery_interval_days", sa.Integer(), nullable=False, server_default="730"))
    op.add_column("rep_vehicles", sa.Column("brake_interval_km", sa.Integer(), nullable=False, server_default="30000"))
    op.add_column("rep_vehicles", sa.Column("next_tire_due_km", sa.Integer(), nullable=True))
    op.add_column("rep_vehicles", sa.Column("next_battery_due_date", sa.Date(), nullable=True))
    op.add_column("rep_vehicles", sa.Column("next_brake_due_km", sa.Integer(), nullable=True))
    op.add_column("vehicle_maintenance_records", sa.Column("approval_status", sa.String(30), nullable=False, server_default="pending"))
    op.add_column("vehicle_maintenance_records", sa.Column("rejection_reason", sa.Text(), nullable=True))
    op.add_column("vehicle_maintenance_records", sa.Column("approved_by", sa.String(), sa.ForeignKey("users.id"), nullable=True))
    op.add_column("vehicle_maintenance_records", sa.Column("approved_at", sa.DateTime(), nullable=True))
    op.add_column("vehicle_maintenance_records", sa.Column("journal_entry_id", sa.String(), sa.ForeignKey("journal_entries.id"), nullable=True))
    op.create_index("ix_vehicle_maintenance_records_approval_status", "vehicle_maintenance_records", ["approval_status"])


def downgrade():
    op.drop_index("ix_vehicle_maintenance_records_approval_status", table_name="vehicle_maintenance_records")
    op.drop_column("vehicle_maintenance_records", "journal_entry_id")
    op.drop_column("vehicle_maintenance_records", "approved_at")
    op.drop_column("vehicle_maintenance_records", "approved_by")
    op.drop_column("vehicle_maintenance_records", "rejection_reason")
    op.drop_column("vehicle_maintenance_records", "approval_status")
    op.drop_column("rep_vehicles", "next_brake_due_km")
    op.drop_column("rep_vehicles", "next_battery_due_date")
    op.drop_column("rep_vehicles", "next_tire_due_km")
    op.drop_column("rep_vehicles", "brake_interval_km")
    op.drop_column("rep_vehicles", "battery_interval_days")
    op.drop_column("rep_vehicles", "tire_interval_km")
