"""add secure ZATCA phase 2 integration foundation

Revision ID: i6j7k8l9m0
Revises: h5i6j7k8l9m0
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "i6j7k8l9m0"
down_revision: Union[str, None] = "h5i6j7k8l9m0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    columns = [
        sa.Column("zatca_branch_name", sa.String(length=200), nullable=True),
        sa.Column("zatca_activity", sa.String(length=300), nullable=True),
        sa.Column("zatca_invoice_type_map", sa.String(length=20), nullable=True),
        sa.Column("zatca_onboarding_status", sa.String(length=40), nullable=False, server_default="not_started"),
        sa.Column("zatca_csr", sa.Text(), nullable=True),
        sa.Column("zatca_private_key_encrypted", sa.Text(), nullable=True),
        sa.Column("zatca_compliance_token_encrypted", sa.Text(), nullable=True),
        sa.Column("zatca_compliance_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("zatca_production_token_encrypted", sa.Text(), nullable=True),
        sa.Column("zatca_production_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("zatca_compliance_request_id", sa.String(length=100), nullable=True),
        sa.Column("zatca_certificate_expiry", sa.DateTime(), nullable=True),
        sa.Column("zatca_last_error", sa.Text(), nullable=True),
    ]
    for column in columns:
        op.add_column("vat_settings", column)


def downgrade() -> None:
    for name in [
        "zatca_last_error", "zatca_certificate_expiry", "zatca_compliance_request_id",
        "zatca_production_secret_encrypted", "zatca_production_token_encrypted",
        "zatca_compliance_secret_encrypted", "zatca_compliance_token_encrypted",
        "zatca_private_key_encrypted", "zatca_csr", "zatca_onboarding_status",
        "zatca_invoice_type_map", "zatca_activity", "zatca_branch_name",
    ]:
        op.drop_column("vat_settings", name)
