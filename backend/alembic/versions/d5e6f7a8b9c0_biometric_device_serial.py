"""Add serial number identity for ADMS biometric devices.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
"""
from alembic import op
import sqlalchemy as sa

revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("hr_biometric_devices", sa.Column("serial_number", sa.String(100), nullable=True))
    op.create_index("ix_hr_biometric_devices_serial_number", "hr_biometric_devices", ["serial_number"], unique=True)


def downgrade():
    op.drop_index("ix_hr_biometric_devices_serial_number", table_name="hr_biometric_devices")
    op.drop_column("hr_biometric_devices", "serial_number")
