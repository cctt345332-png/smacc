"""Allow representative expenses to be assigned to supervisors.

Revision ID: q9r0s1t2u3v4
Revises: p8q9r0s1t2u3
"""
from alembic import op
import sqlalchemy as sa


revision = "q9r0s1t2u3v4"
down_revision = "p8q9r0s1t2u3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("rep_expenses", "rep_id", existing_type=sa.String(), nullable=True)
    op.add_column("rep_expenses", sa.Column("supervisor_id", sa.String(), nullable=True))
    op.create_index("ix_rep_expenses_supervisor_id", "rep_expenses", ["supervisor_id"])
    op.create_foreign_key(
        "fk_rep_expenses_supervisor_id_supervisors",
        "rep_expenses",
        "supervisors",
        ["supervisor_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_rep_expenses_supervisor_id_supervisors", "rep_expenses", type_="foreignkey")
    op.drop_index("ix_rep_expenses_supervisor_id", table_name="rep_expenses")
    op.drop_column("rep_expenses", "supervisor_id")
    op.alter_column("rep_expenses", "rep_id", existing_type=sa.String(), nullable=False)
