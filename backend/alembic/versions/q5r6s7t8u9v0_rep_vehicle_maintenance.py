"""إدارة مركبات المناديب والصيانة الدورية"""
from alembic import op
import sqlalchemy as sa

revision = "q5r6s7t8u9v0"
down_revision = "p4q5r6s7t8u9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "rep_vehicles",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=False, unique=True),
        sa.Column("plate_number", sa.String(30), nullable=True),
        sa.Column("vehicle_type", sa.String(100), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("color", sa.String(50), nullable=True),
        sa.Column("current_odometer", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("odometer_updated_at", sa.DateTime(), nullable=True),
        sa.Column("oil_interval_km", sa.Integer(), nullable=False, server_default="5000"),
        sa.Column("oil_interval_days", sa.Integer(), nullable=False, server_default="180"),
        sa.Column("next_oil_due_km", sa.Integer(), nullable=True),
        sa.Column("next_oil_due_date", sa.Date(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_rep_vehicles_tenant_active", "rep_vehicles", ["tenant_id", "is_active"])
    op.create_index("ix_rep_vehicles_tenant_id", "rep_vehicles", ["tenant_id"])
    op.create_index("ix_rep_vehicles_rep_id", "rep_vehicles", ["rep_id"])
    op.create_index("ix_rep_vehicles_plate_number", "rep_vehicles", ["plate_number"])

    op.create_table(
        "vehicle_maintenance_records",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("vehicle_id", sa.String(), sa.ForeignKey("rep_vehicles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=False),
        sa.Column("service_type", sa.String(50), nullable=False, server_default="oil_change"),
        sa.Column("service_date", sa.Date(), nullable=False),
        sa.Column("odometer", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("oil_type", sa.String(100), nullable=True),
        sa.Column("vendor_name", sa.String(200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("next_due_km", sa.Integer(), nullable=True),
        sa.Column("next_due_date", sa.Date(), nullable=True),
        sa.Column("created_by", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_index("ix_vehicle_maintenance_tenant_vehicle_date", "vehicle_maintenance_records", ["tenant_id", "vehicle_id", "service_date"])
    op.create_index("ix_vehicle_maintenance_records_tenant_id", "vehicle_maintenance_records", ["tenant_id"])
    op.create_index("ix_vehicle_maintenance_records_vehicle_id", "vehicle_maintenance_records", ["vehicle_id"])
    op.create_index("ix_vehicle_maintenance_records_rep_id", "vehicle_maintenance_records", ["rep_id"])

    # إنشاء بطاقة صيانة للمركبات الموجودة مسبقًا في بطاقة المندوب.
    op.execute(sa.text("""
        INSERT INTO rep_vehicles (id, tenant_id, rep_id, plate_number, vehicle_type, color)
        SELECT md5(random()::text || clock_timestamp()::text || sr.id), sr.tenant_id,
               sr.id, sr.vehicle_plate, sr.vehicle_type, sr.vehicle_color
        FROM sales_reps sr
        WHERE NOT EXISTS (SELECT 1 FROM rep_vehicles rv WHERE rv.rep_id = sr.id)
    """))


def downgrade():
    op.drop_table("vehicle_maintenance_records")
    op.drop_table("rep_vehicles")
