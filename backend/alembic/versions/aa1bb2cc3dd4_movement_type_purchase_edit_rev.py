"""add purchase_edit_rev to movementtype enum

Revision ID: aa1bb2cc3dd4
Revises: z2a3b4c5d6e7
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa

revision = 'aa1bb2cc3dd4'
down_revision = 'e2f3a4b5c6d7'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # PostgreSQL فقط: أضف القيمة الجديدة للـ enum إذا لم تكن موجودة
    # نستخدم DO $$ لتجنب الخطأ إذا كانت القيمة موجودة مسبقاً
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'purchase_edit_rev'
                  AND enumtypid = (
                    SELECT oid FROM pg_type WHERE typname = 'movementtype'
                  )
            ) THEN
                ALTER TYPE movementtype ADD VALUE 'purchase_edit_rev';
            END IF;
        END$$;
    """))


def downgrade():
    # لا يمكن حذف قيمة من PostgreSQL enum بشكل مباشر — نتركها
    pass
