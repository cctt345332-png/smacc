"""add employee identity attachment fields
Revision ID: v0w1x2y3
Revises: u9v0w1x2
"""
from alembic import op
import sqlalchemy as sa

revision = "v0w1x2y3"
down_revision = "u9v0w1x2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("hr_employees", sa.Column("national_id_file_name", sa.String(length=255), nullable=True))
    op.add_column("hr_employees", sa.Column("national_id_content_type", sa.String(length=100), nullable=True))
    op.add_column("hr_employees", sa.Column("national_id_file_data", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("hr_employees", "national_id_file_data")
    op.drop_column("hr_employees", "national_id_content_type")
    op.drop_column("hr_employees", "national_id_file_name")
