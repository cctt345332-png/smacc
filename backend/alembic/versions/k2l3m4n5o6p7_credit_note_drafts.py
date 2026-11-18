"""add credit note draft status

Revision ID: k2l3m4n5o6p7
Revises: j1k2l3m4n5o6
"""
from alembic import op
import sqlalchemy as sa

revision = "k2l3m4n5o6p7"
down_revision = "j1k2l3m4n5o6"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "credit_notes",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="posted"),
    )
    op.create_index("ix_credit_notes_status", "credit_notes", ["status"], unique=False)


def downgrade():
    op.drop_index("ix_credit_notes_status", table_name="credit_notes")
    op.drop_column("credit_notes", "status")
