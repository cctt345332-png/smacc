"""rep_locations_table — إنشاء جدول مواقع المناديب والمشرفين

Revision ID: d1e2f3a4b5c6
Revises: c1d2e3f4a5b6
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.engine.reflection import Inspector

revision = 'd1e2f3a4b5c6'
down_revision = 'c1d2e3f4a5b6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = Inspector.from_engine(bind)
    tables = inspector.get_table_names()

    # ── إنشاء الجدول إذا لم يكن موجوداً ─────────────────────────────
    if 'rep_locations' not in tables:
        op.create_table(
            'rep_locations',
            sa.Column('id',            sa.String(),       nullable=False),
            sa.Column('tenant_id',     sa.String(),       sa.ForeignKey('tenants.id'), nullable=False),
            # بدون ForeignKey على rep_id — يخزن ID المندوب أو المشرف
            sa.Column('rep_id',        sa.String(),       nullable=False),
            sa.Column('latitude',      sa.Numeric(10, 7), nullable=False),
            sa.Column('longitude',     sa.Numeric(10, 7), nullable=False),
            sa.Column('accuracy',      sa.Numeric(8, 2),  nullable=True),
            sa.Column('speed',         sa.Numeric(8, 2),  nullable=True),
            sa.Column('heading',       sa.Numeric(6, 2),  nullable=True),
            sa.Column('battery_level', sa.Integer(),      nullable=True),
            sa.Column('is_moving',     sa.Boolean(),      nullable=False, server_default='false'),
            sa.Column('recorded_at',   sa.DateTime(),     nullable=False),
            sa.Column('created_at',    sa.DateTime(),     nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_rep_locations_rep_id',    'rep_locations', ['rep_id'])
        op.create_index('ix_rep_locations_tenant_id', 'rep_locations', ['tenant_id'])
    else:
        # الجدول موجود — تحقق إذا في FK قديم على rep_id وأزله
        try:
            fks = inspector.get_foreign_keys('rep_locations')
            for fk in fks:
                if 'sales_reps' in (fk.get('referred_table') or ''):
                    op.drop_constraint(fk['name'], 'rep_locations', type_='foreignkey')
        except Exception:
            pass


def downgrade():
    op.drop_index('ix_rep_locations_tenant_id', 'rep_locations')
    op.drop_index('ix_rep_locations_rep_id',    'rep_locations')
    op.drop_table('rep_locations')
