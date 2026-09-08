"""add maintenance requests and status logs

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
"""
from alembic import op
import sqlalchemy as sa

revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    maintenance_status = sa.Enum(
        "new", "received", "inspecting", "waiting_customer", "in_repair",
        "waiting_part", "ready", "delivered", "closed", "rejected", "cancelled",
        name="maintenancestatus",
    )
    maintenance_resolution = sa.Enum(
        "repaired", "replaced", "no_repair", "inspection_only", "returned_unrepaired",
        name="maintenanceresolution",
    )
    lock_type = sa.Enum(
        "none", "screen_pin", "password", "pattern", "user_account", "other",
        name="locktype",
    )
    bind = op.get_bind()
    maintenance_status.create(bind, checkfirst=True)
    maintenance_resolution.create(bind, checkfirst=True)
    lock_type.create(bind, checkfirst=True)

    op.create_table(
        "maintenance_requests",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("request_number", sa.String(length=50), nullable=False),
        sa.Column("customer_id", sa.String(), nullable=False),
        sa.Column("rep_id", sa.String(), nullable=True),
        sa.Column("invoice_id", sa.String(), nullable=True),
        sa.Column("product_id", sa.String(), nullable=True),
        sa.Column("serial_item_id", sa.String(), nullable=True),
        sa.Column("status", maintenance_status, nullable=False),
        sa.Column("resolution", maintenance_resolution, nullable=True),
        sa.Column("device_name", sa.String(length=300), nullable=True),
        sa.Column("serial_number", sa.String(length=200), nullable=True),
        sa.Column("imei_1", sa.String(length=50), nullable=True),
        sa.Column("imei_2", sa.String(length=50), nullable=True),
        sa.Column("reported_problem", sa.Text(), nullable=False),
        sa.Column("device_condition", sa.Text(), nullable=True),
        sa.Column("accessories_received", sa.Text(), nullable=True),
        sa.Column("attachment_urls_json", sa.Text(), nullable=True),
        sa.Column("lock_type", lock_type, nullable=False),
        sa.Column("lock_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("lock_secret_provided", sa.Boolean(), nullable=False),
        sa.Column("lock_secret_returned", sa.Boolean(), nullable=False),
        sa.Column("inspection_notes", sa.Text(), nullable=True),
        sa.Column("repair_notes", sa.Text(), nullable=True),
        sa.Column("rejection_reason", sa.Text(), nullable=True),
        sa.Column("warranty_case", sa.Boolean(), nullable=False),
        sa.Column("estimated_cost", sa.Numeric(18, 2), nullable=False),
        sa.Column("approved_cost", sa.Numeric(18, 2), nullable=False),
        sa.Column("replacement_product_id", sa.String(), nullable=True),
        sa.Column("replacement_serial_item_id", sa.String(), nullable=True),
        sa.Column("replacement_serial_number", sa.String(length=200), nullable=True),
        sa.Column("replacement_reason", sa.Text(), nullable=True),
        sa.Column("replacement_approved", sa.Boolean(), nullable=False),
        sa.Column("created_by", sa.String(), nullable=False),
        sa.Column("assigned_to", sa.String(), nullable=True),
        sa.Column("received_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["rep_id"], ["sales_reps.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["serial_item_id"], ["serial_items.id"]),
        sa.ForeignKeyConstraint(["replacement_product_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["replacement_serial_item_id"], ["serial_items.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["assigned_to"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_maintenance_requests_tenant_id", "maintenance_requests", ["tenant_id"])
    op.create_index("ix_maintenance_requests_request_number", "maintenance_requests", ["request_number"])
    op.create_index("ix_maintenance_requests_customer_id", "maintenance_requests", ["customer_id"])
    op.create_index("ix_maintenance_requests_rep_id", "maintenance_requests", ["rep_id"])
    op.create_index("ix_maintenance_requests_invoice_id", "maintenance_requests", ["invoice_id"])
    op.create_index("ix_maintenance_requests_product_id", "maintenance_requests", ["product_id"])
    op.create_index("ix_maintenance_requests_serial_item_id", "maintenance_requests", ["serial_item_id"])
    op.create_index("ix_maintenance_requests_status", "maintenance_requests", ["status"])
    op.create_index("ix_maintenance_requests_serial_number", "maintenance_requests", ["serial_number"])
    op.create_index("ix_maintenance_requests_imei_1", "maintenance_requests", ["imei_1"])
    op.create_index("ix_maintenance_requests_imei_2", "maintenance_requests", ["imei_2"])
    op.create_index("ix_maintenance_tenant_status_created", "maintenance_requests", ["tenant_id", "status", "created_at"])

    op.create_table(
        "maintenance_status_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("request_id", sa.String(), nullable=False),
        sa.Column("from_status", sa.String(length=40), nullable=True),
        sa.Column("to_status", sa.String(length=40), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["request_id"], ["maintenance_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_maintenance_status_logs_tenant_id", "maintenance_status_logs", ["tenant_id"])
    op.create_index("ix_maintenance_status_logs_request_id", "maintenance_status_logs", ["request_id"])


def downgrade() -> None:
    op.drop_index("ix_maintenance_status_logs_request_id", table_name="maintenance_status_logs")
    op.drop_index("ix_maintenance_status_logs_tenant_id", table_name="maintenance_status_logs")
    op.drop_table("maintenance_status_logs")
    op.drop_index("ix_maintenance_tenant_status_created", table_name="maintenance_requests")
    for index in (
        "ix_maintenance_requests_imei_2", "ix_maintenance_requests_imei_1",
        "ix_maintenance_requests_serial_number", "ix_maintenance_requests_status",
        "ix_maintenance_requests_serial_item_id", "ix_maintenance_requests_product_id",
        "ix_maintenance_requests_invoice_id", "ix_maintenance_requests_rep_id",
        "ix_maintenance_requests_customer_id", "ix_maintenance_requests_request_number",
        "ix_maintenance_requests_tenant_id",
    ):
        op.drop_index(index, table_name="maintenance_requests")
    op.drop_table("maintenance_requests")
    bind = op.get_bind()
    sa.Enum(name="locktype").drop(bind, checkfirst=True)
    sa.Enum(name="maintenanceresolution").drop(bind, checkfirst=True)
    sa.Enum(name="maintenancestatus").drop(bind, checkfirst=True)
