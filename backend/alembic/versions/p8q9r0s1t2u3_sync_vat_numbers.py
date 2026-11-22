"""Sync tenant VAT numbers into VAT settings.

Revision ID: p8q9r0s1t2u3
Revises: o6p7q8r9s0t1
"""
from uuid import uuid4

from alembic import op
from sqlalchemy import text


revision = "p8q9r0s1t2u3"
down_revision = "o6p7q8r9s0t1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    tenants = connection.execute(
        text("SELECT id, vat_number FROM tenants WHERE vat_number IS NOT NULL AND btrim(vat_number) <> ''")
    ).mappings().all()
    for tenant in tenants:
        vat_number = tenant["vat_number"].strip()
        setting = connection.execute(
            text("SELECT id, vat_number FROM vat_settings WHERE tenant_id = :tenant_id"),
            {"tenant_id": tenant["id"]},
        ).mappings().first()
        if setting is None:
            connection.execute(
                text("INSERT INTO vat_settings (id, tenant_id, vat_number, vat_rate, zatca_env, is_zatca_enabled, updated_at) "
                     "VALUES (:id, :tenant_id, :vat_number, 15, 'sandbox', true, CURRENT_TIMESTAMP)"),
                {"id": str(uuid4()), "tenant_id": tenant["id"], "vat_number": vat_number},
            )
        elif not (setting["vat_number"] or "").strip():
            connection.execute(
                text("UPDATE vat_settings SET vat_number = :vat_number, updated_at = CURRENT_TIMESTAMP WHERE id = :id"),
                {"id": setting["id"], "vat_number": vat_number},
            )


def downgrade() -> None:
    # لا نمسح أرقامًا صحيحة؛ قد تكون عُدّلت لاحقًا من إعدادات زاتكا.
    pass
