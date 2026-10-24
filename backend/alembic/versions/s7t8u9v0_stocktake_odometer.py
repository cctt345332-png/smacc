"""إلزام قراءة عداد مركبة المندوب بعد إكمال الجرد"""
from alembic import op
import sqlalchemy as sa

revision = "s7t8u9v0"
down_revision = "r6s7t8u9v0"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("mandatory_stocktake_lines", sa.Column("odometer", sa.Integer(), nullable=True))
    op.add_column("mandatory_stocktake_lines", sa.Column("odometer_recorded_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("mandatory_stocktake_lines", "odometer_recorded_at")
    op.drop_column("mandatory_stocktake_lines", "odometer")
