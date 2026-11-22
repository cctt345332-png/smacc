"""Add complete maintenance intake fields to POS tickets.

Revision ID: r0s1t2u3v4w5
Revises: q9r0s1t2u3v4
"""
from alembic import op
import sqlalchemy as sa

revision = "r0s1t2u3v4w5"
down_revision = "q9r0s1t2u3v4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = [
        ("customer_email", sa.String(length=200)),
        ("customer_address", sa.String(length=500)),
        ("device_color", sa.String(length=100)),
        ("device_capacity", sa.String(length=100)),
        ("purchase_date", sa.Date()),
        ("lock_type", sa.String(length=30)),
        ("lock_secret_encrypted", sa.Text()),
        ("lock_secret_provided", sa.Boolean(), False),
        ("problem_type", sa.String(length=100)),
        ("symptoms_json", sa.Text()),
        ("attachment_urls_json", sa.Text()),
    ]
    for name, column_type, *default in columns:
        kwargs = {"nullable": True}
        if default:
            kwargs["server_default"] = sa.false()
            kwargs["nullable"] = False
        op.add_column("pos_maintenance_tickets", sa.Column(name, column_type, **kwargs))


def downgrade() -> None:
    for name in [
        "attachment_urls_json", "symptoms_json", "problem_type", "lock_secret_provided",
        "lock_secret_encrypted", "lock_type", "purchase_date", "device_capacity",
        "device_color", "customer_address", "customer_email",
    ]:
        op.drop_column("pos_maintenance_tickets", name)
