"""purchase_serial_bulk — دعم السيريالات الجماعية في المشتريات والمرتجعات

Revision ID: z2a3b4c5d6e7
Revises: y1z2a3b4c5d6
Create Date: 2026-07-16

"""
from alembic import op
import sqlalchemy as sa

revision = 'z2a3b4c5d6e7'
down_revision = 'y1z2a3b4c5d6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # bill_lines — قائمة سيريالات جديدة (JSON)
    cols = [r[0] for r in conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns WHERE table_name='bill_lines'"
    ))]
    if 'new_serial_numbers_json' not in cols:
        op.add_column('bill_lines', sa.Column('new_serial_numbers_json', sa.Text(), nullable=True))

    # debit_note_lines — ربط سيريالات مُرجَعة (JSON) + بيانات الصنف
    dn_cols = [r[0] for r in conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns WHERE table_name='debit_note_lines'"
    ))]
    if 'inventory_item_id' not in dn_cols:
        op.add_column('debit_note_lines', sa.Column('inventory_item_id', sa.String(), nullable=True))
    if 'serial_ids_json' not in dn_cols:
        op.add_column('debit_note_lines', sa.Column('serial_ids_json', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('bill_lines', 'new_serial_numbers_json')
    op.drop_column('debit_note_lines', 'inventory_item_id')
    op.drop_column('debit_note_lines', 'serial_ids_json')
