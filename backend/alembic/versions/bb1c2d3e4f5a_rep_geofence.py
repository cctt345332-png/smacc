"""rep_geofence — موقع الحضور وحدود منطقة عمل المندوب

Revision ID: bb1c2d3e4f5a
Revises: aa1b2c3d4e5f
Create Date: 2026-08-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = "bb1c2d3e4f5a"
down_revision = "aa1b2c3d4e5f"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    # موقع الحضور يضاف للحضور الموجود من دون تغيير سجلاته السابقة.
    if "rep_attendance" in tables:
        attendance_columns = {column["name"] for column in inspector.get_columns("rep_attendance")}
        if "check_in_latitude" not in attendance_columns:
            op.add_column("rep_attendance", sa.Column("check_in_latitude", sa.Numeric(10, 7), nullable=True))
        if "check_in_longitude" not in attendance_columns:
            op.add_column("rep_attendance", sa.Column("check_in_longitude", sa.Numeric(10, 7), nullable=True))
        if "check_in_accuracy" not in attendance_columns:
            op.add_column("rep_attendance", sa.Column("check_in_accuracy", sa.Numeric(8, 2), nullable=True))

    if "rep_geo_zones" not in tables:
        op.create_table(
            "rep_geo_zones",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=False),
            sa.Column("name", sa.String(length=200), nullable=False, server_default="منطقة عمل المندوب"),
            sa.Column("boundary_type", sa.String(length=20), nullable=False, server_default="circle"),
            sa.Column("center_latitude", sa.Numeric(10, 7), nullable=True),
            sa.Column("center_longitude", sa.Numeric(10, 7), nullable=True),
            sa.Column("radius_meters", sa.Numeric(10, 2), nullable=True),
            sa.Column("polygon_json", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id", "rep_id", name="uq_rep_geo_zone_per_rep"),
        )
        op.create_index("ix_rep_geo_zones_tenant_id", "rep_geo_zones", ["tenant_id"])
        op.create_index("ix_rep_geo_zones_rep_id", "rep_geo_zones", ["rep_id"])

    if "rep_geo_events" not in tables:
        op.create_table(
            "rep_geo_events",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
            sa.Column("rep_id", sa.String(), sa.ForeignKey("sales_reps.id"), nullable=False),
            sa.Column("zone_id", sa.String(), sa.ForeignKey("rep_geo_zones.id"), nullable=False),
            sa.Column("event_type", sa.String(length=20), nullable=False),
            sa.Column("is_initial", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("latitude", sa.Numeric(10, 7), nullable=False),
            sa.Column("longitude", sa.Numeric(10, 7), nullable=False),
            sa.Column("source_location_id", sa.String(), nullable=True),
            sa.Column("occurred_at", sa.DateTime(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_rep_geo_events_tenant_id", "rep_geo_events", ["tenant_id"])
        op.create_index("ix_rep_geo_events_rep_id", "rep_geo_events", ["rep_id"])
        op.create_index("ix_rep_geo_events_zone_id", "rep_geo_events", ["zone_id"])


def downgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    if "rep_geo_events" in tables:
        op.drop_index("ix_rep_geo_events_zone_id", table_name="rep_geo_events")
        op.drop_index("ix_rep_geo_events_rep_id", table_name="rep_geo_events")
        op.drop_index("ix_rep_geo_events_tenant_id", table_name="rep_geo_events")
        op.drop_table("rep_geo_events")
    if "rep_geo_zones" in tables:
        op.drop_index("ix_rep_geo_zones_rep_id", table_name="rep_geo_zones")
        op.drop_index("ix_rep_geo_zones_tenant_id", table_name="rep_geo_zones")
        op.drop_table("rep_geo_zones")
    if "rep_attendance" in tables:
        columns = {column["name"] for column in inspector.get_columns("rep_attendance")}
        if "check_in_accuracy" in columns:
            op.drop_column("rep_attendance", "check_in_accuracy")
        if "check_in_longitude" in columns:
            op.drop_column("rep_attendance", "check_in_longitude")
        if "check_in_latitude" in columns:
            op.drop_column("rep_attendance", "check_in_latitude")
