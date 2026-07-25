"""terminal assigned user

Revision ID: x1y2z3a4b5c6
Revises: w7x8y9z0a1b2
Create Date: 2026-05-11
"""
from alembic import op
import sqlalchemy as sa

revision = 'x1y2z3a4b5c6'
down_revision = 'w7x8y9z0a1b2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('pos_terminals',
        sa.Column('assigned_user_id', sa.String(), nullable=True)
    )
    op.create_index('ix_pos_terminals_assigned_user_id', 'pos_terminals', ['assigned_user_id'])


def downgrade():
    op.drop_index('ix_pos_terminals_assigned_user_id', 'pos_terminals')
    op.drop_column('pos_terminals', 'assigned_user_id')
