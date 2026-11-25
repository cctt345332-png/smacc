"""Create isolated maintenance cases workflow.
Revision ID: maintenance_cases_20261125
Revises: treasury_20261124
"""
from alembic import op
import sqlalchemy as sa

revision = "maintenance_cases_20261125"
down_revision = "treasury_20261124"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("maintenance_cases",
        sa.Column("id", sa.String(), nullable=False), sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("case_number", sa.String(length=50), nullable=False), sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("source", sa.String(length=30), nullable=False), sa.Column("terminal_id", sa.String(), nullable=True),
        sa.Column("customer_id", sa.String(), nullable=True), sa.Column("rep_id", sa.String(), nullable=True),
        sa.Column("device_name", sa.String(length=300), nullable=False), sa.Column("device_model", sa.String(length=200), nullable=True),
        sa.Column("device_serial", sa.String(length=200), nullable=True), sa.Column("customer_name", sa.String(length=200), nullable=False),
        sa.Column("customer_phone", sa.String(length=50), nullable=False), sa.Column("purchase_date", sa.Date(), nullable=True),
        sa.Column("reported_problem", sa.Text(), nullable=False), sa.Column("device_condition", sa.Text(), nullable=True),
        sa.Column("received_accessories", sa.Text(), nullable=True), sa.Column("attachment_urls_json", sa.Text(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=False), sa.Column("received_by", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]), sa.ForeignKeyConstraint(["terminal_id"], ["pos_terminals.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]), sa.ForeignKeyConstraint(["rep_id"], ["sales_reps.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]), sa.ForeignKeyConstraint(["received_by"], ["users.id"]), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_maintenance_cases_tenant_id", "maintenance_cases", ["tenant_id"])
    op.create_index("ix_maintenance_cases_case_number", "maintenance_cases", ["case_number"])
    op.create_index("ix_maintenance_cases_status", "maintenance_cases", ["status"])
    op.create_index("ix_maintenance_cases_tenant_status_created", "maintenance_cases", ["tenant_id", "status", "created_at"])
    op.create_table("maintenance_case_status_logs",
        sa.Column("id", sa.String(), nullable=False), sa.Column("tenant_id", sa.String(), nullable=False),
        sa.Column("case_id", sa.String(), nullable=False), sa.Column("from_status", sa.String(length=40), nullable=True),
        sa.Column("to_status", sa.String(length=40), nullable=False), sa.Column("note", sa.Text(), nullable=True),
        sa.Column("changed_by", sa.String(), nullable=False), sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]), sa.ForeignKeyConstraint(["case_id"], ["maintenance_cases.id"], ondelete="CASCADE"), sa.ForeignKeyConstraint(["changed_by"], ["users.id"]), sa.PrimaryKeyConstraint("id"))
    op.create_index("ix_maintenance_case_status_logs_tenant_id", "maintenance_case_status_logs", ["tenant_id"])
    op.create_index("ix_maintenance_case_status_logs_case_id", "maintenance_case_status_logs", ["case_id"])
    op.create_index("ix_maintenance_case_status_logs_created_at", "maintenance_case_status_logs", ["created_at"])
    op.create_index("ix_maintenance_case_status_logs_case_created", "maintenance_case_status_logs", ["case_id", "created_at"])


def downgrade():
    op.drop_index("ix_maintenance_case_status_logs_case_created", table_name="maintenance_case_status_logs")
    op.drop_index("ix_maintenance_case_status_logs_created_at", table_name="maintenance_case_status_logs")
    op.drop_index("ix_maintenance_case_status_logs_case_id", table_name="maintenance_case_status_logs")
    op.drop_index("ix_maintenance_case_status_logs_tenant_id", table_name="maintenance_case_status_logs")
    op.drop_table("maintenance_case_status_logs")
    op.drop_index("ix_maintenance_cases_tenant_status_created", table_name="maintenance_cases")
    op.drop_index("ix_maintenance_cases_status", table_name="maintenance_cases")
    op.drop_index("ix_maintenance_cases_case_number", table_name="maintenance_cases")
    op.drop_index("ix_maintenance_cases_tenant_id", table_name="maintenance_cases")
    op.drop_table("maintenance_cases")
