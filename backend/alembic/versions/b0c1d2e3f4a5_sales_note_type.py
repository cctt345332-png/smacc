"""add sales note type for ZATCA debit notes

Revision ID: b0c1d2e3f4a5
Revises: af1b2c3d
"""
from alembic import op
import sqlalchemy as sa

revision = "b0c1d2e3f4a5"
down_revision = "af1b2c3d"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "credit_notes",
        sa.Column("note_type", sa.String(length=20), nullable=False, server_default="credit"),
    )


def downgrade():
    op.drop_column("credit_notes", "note_type")
