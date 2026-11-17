"""Link maintenance tickets to the existing POS session."""
from alembic import op
import sqlalchemy as sa

revision = "i0j1k2l3m4n5"
down_revision = "h9i0j1k2l3m4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pos_maintenance_tickets", sa.Column("session_id", sa.String(), nullable=True))
    op.create_index("ix_pos_maintenance_tickets_session_id", "pos_maintenance_tickets", ["session_id"])
    op.create_foreign_key(
        "fk_pos_maintenance_tickets_session_id",
        "pos_maintenance_tickets",
        "pos_sessions",
        ["session_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_pos_maintenance_tickets_session_id", "pos_maintenance_tickets", type_="foreignkey")
    op.drop_index("ix_pos_maintenance_tickets_session_id", table_name="pos_maintenance_tickets")
    op.drop_column("pos_maintenance_tickets", "session_id")
