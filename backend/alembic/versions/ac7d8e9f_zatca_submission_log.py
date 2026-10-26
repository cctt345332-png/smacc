"""add ZATCA signed document fields and submission audit log

Revision ID: ac7d8e9f
Revises: ab6c7d8e
"""
from alembic import op
import sqlalchemy as sa

revision = "ac7d8e9f"
down_revision = "ab6c7d8e"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for table, columns in {
        "invoices": [
            ("zatca_invoice_hash", sa.String(128)),
            ("zatca_previous_invoice_hash", sa.String(128)),
            ("zatca_signed_xml", sa.Text()),
            ("zatca_submission_id", sa.String(100)),
        ],
        "credit_notes": [
            ("zatca_invoice_hash", sa.String(128)),
            ("zatca_signed_xml", sa.Text()),
            ("zatca_submission_id", sa.String(100)),
        ],
    }.items():
        for name, column_type in columns:
            op.add_column(table, sa.Column(name, column_type, nullable=True))

    op.create_table(
        "zatca_submissions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tenant_id", sa.String(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("document_type", sa.String(30), nullable=False),
        sa.Column("document_id", sa.String(), nullable=False),
        sa.Column("document_uuid", sa.String(36), nullable=False),
        sa.Column("invoice_hash", sa.String(128), nullable=False),
        sa.Column("previous_invoice_hash", sa.String(128), nullable=True),
        sa.Column("api_type", sa.String(20), nullable=False),
        sa.Column("environment", sa.String(20), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("request_xml", sa.Text(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(), nullable=True),
        sa.Column("responded_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_zatca_submissions_tenant_id", "zatca_submissions", ["tenant_id"])
    op.create_index("ix_zatca_submissions_document_id", "zatca_submissions", ["document_id"])
    op.create_index("ix_zatca_submissions_document_uuid", "zatca_submissions", ["document_uuid"])


def downgrade() -> None:
    op.drop_index("ix_zatca_submissions_document_uuid", table_name="zatca_submissions")
    op.drop_index("ix_zatca_submissions_document_id", table_name="zatca_submissions")
    op.drop_index("ix_zatca_submissions_tenant_id", table_name="zatca_submissions")
    op.drop_table("zatca_submissions")
    for table, names in {
        "credit_notes": ["zatca_submission_id", "zatca_signed_xml", "zatca_invoice_hash"],
        "invoices": ["zatca_submission_id", "zatca_signed_xml", "zatca_previous_invoice_hash", "zatca_invoice_hash"],
    }.items():
        for name in names:
            op.drop_column(table, name)
