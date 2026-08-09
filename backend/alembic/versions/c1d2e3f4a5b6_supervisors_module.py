"""supervisors_module — جداول المشرفين وربطهم بالمناديب

Revision ID: c1d2e3f4a5b6
Revises: a1b2c3d4e5f6
Create Date: 2026-08-09

"""
from alembic import op
import sqlalchemy as sa

revision = 'c1d2e3f4a5b6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. جدول المشرفين ─────────────────────────────────────────────
    op.create_table(
        'supervisors',
        sa.Column('id',         sa.String(),    nullable=False),
        sa.Column('tenant_id',  sa.String(),    sa.ForeignKey('tenants.id'), nullable=False),
        sa.Column('user_id',    sa.String(),    sa.ForeignKey('users.id'),   nullable=False),
        sa.Column('name',       sa.String(200), nullable=False),
        sa.Column('email',      sa.String(200), nullable=False),
        sa.Column('phone',      sa.String(20),  nullable=True),
        sa.Column('is_active',  sa.Boolean(),   nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(),  nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_supervisors_user_id'),
    )
    op.create_index('ix_supervisors_tenant_id', 'supervisors', ['tenant_id'])
    op.create_index('ix_supervisors_user_id',   'supervisors', ['user_id'])

    # ── 2. جدول ربط المشرف بالمناديب (many-to-many) ──────────────────
    op.create_table(
        'supervisor_reps',
        sa.Column('id',            sa.String(),  nullable=False),
        sa.Column('supervisor_id', sa.String(),  sa.ForeignKey('supervisors.id'), nullable=False),
        sa.Column('rep_id',        sa.String(),  sa.ForeignKey('sales_reps.id'),  nullable=False),
        sa.Column('tenant_id',     sa.String(),  sa.ForeignKey('tenants.id'),     nullable=False),
        sa.Column('created_at',    sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_supervisor_reps_supervisor_id', 'supervisor_reps', ['supervisor_id'])
    op.create_index('ix_supervisor_reps_rep_id',        'supervisor_reps', ['rep_id'])
    op.create_index('ix_supervisor_reps_tenant_id',     'supervisor_reps', ['tenant_id'])


def downgrade():
    op.drop_index('ix_supervisor_reps_tenant_id',     'supervisor_reps')
    op.drop_index('ix_supervisor_reps_rep_id',        'supervisor_reps')
    op.drop_index('ix_supervisor_reps_supervisor_id', 'supervisor_reps')
    op.drop_table('supervisor_reps')

    op.drop_index('ix_supervisors_user_id',   'supervisors')
    op.drop_index('ix_supervisors_tenant_id', 'supervisors')
    op.drop_table('supervisors')
