"""pos_business_type

Revision ID: m3n4o5p6q7r8
Revises: a0b1c2d3e4f5
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = 'm3n4o5p6q7r8'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # أضف الـ columns فقط إذا ما كانت موجودة
    conn.execute(sa.text("""
        ALTER TABLE pos_terminals
        ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) NOT NULL DEFAULT 'general'
    """))
    conn.execute(sa.text("""
        ALTER TABLE pos_terminals
        ADD COLUMN IF NOT EXISTS allow_purchase BOOLEAN NOT NULL DEFAULT false
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE pos_terminals DROP COLUMN IF EXISTS allow_purchase"))
    conn.execute(sa.text("ALTER TABLE pos_terminals DROP COLUMN IF EXISTS business_type"))
