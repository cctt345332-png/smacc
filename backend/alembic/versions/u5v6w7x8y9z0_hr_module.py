"""hr_module

Revision ID: u5v6w7x8y9z0
Revises: t4u5v6w7x8y9
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'u5v6w7x8y9z0'
down_revision = 't4u5v6w7x8y9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── الأقسام ──────────────────────────────────────────────────────
    op.create_table(
        'hr_departments',
        sa.Column('id',         sa.String(),    primary_key=True),
        sa.Column('tenant_id',  sa.String(),    sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('name_ar',    sa.String(200), nullable=False),
        sa.Column('name_en',    sa.String(200), nullable=True),
        sa.Column('manager_id', sa.String(),    nullable=True),
        sa.Column('budget',     sa.Numeric(18, 2), default=0),
        sa.Column('is_active',  sa.Boolean(),   default=True),
        sa.Column('created_at', sa.DateTime(),  nullable=False),
    )

    # ── الموظفون ──────────────────────────────────────────────────────
    op.create_table(
        'hr_employees',
        sa.Column('id',                  sa.String(),    primary_key=True),
        sa.Column('tenant_id',           sa.String(),    sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('employee_number',     sa.String(50),  nullable=False, index=True),
        sa.Column('department_id',       sa.String(),    sa.ForeignKey('hr_departments.id'), nullable=True),
        sa.Column('user_id',             sa.String(),    sa.ForeignKey('users.id'), nullable=True),
        # البيانات الشخصية
        sa.Column('full_name_ar',        sa.String(300), nullable=False),
        sa.Column('full_name_en',        sa.String(300), nullable=True),
        sa.Column('national_id',         sa.String(20),  nullable=True),
        sa.Column('gender',              sa.String(10),  nullable=False, server_default='male'),
        sa.Column('birth_date',          sa.Date(),      nullable=True),
        sa.Column('nationality',         sa.String(50),  nullable=False, server_default='SA'),
        sa.Column('phone',               sa.String(20),  nullable=True),
        sa.Column('email',               sa.String(200), nullable=True),
        # بيانات الوظيفة
        sa.Column('job_title_ar',        sa.String(200), nullable=False),
        sa.Column('job_title_en',        sa.String(200), nullable=True),
        sa.Column('contract_type',       sa.String(20),  nullable=False, server_default='full_time'),
        sa.Column('hire_date',           sa.Date(),      nullable=False),
        sa.Column('end_date',            sa.Date(),      nullable=True),
        sa.Column('status',              sa.String(20),  nullable=False, server_default='active'),
        # الراتب
        sa.Column('basic_salary',        sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('housing_allowance',   sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('transport_allowance', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('other_allowances',    sa.Numeric(18, 2), nullable=False, server_default='0'),
        # GOSI
        sa.Column('gosi_eligible',       sa.Boolean(),   nullable=False, server_default='true'),
        sa.Column('gosi_number',         sa.String(50),  nullable=True),
        # الإجازة
        sa.Column('annual_leave_days',   sa.Integer(),   nullable=False, server_default='21'),
        sa.Column('leave_balance',       sa.Numeric(8, 2), nullable=False, server_default='21'),
        sa.Column('notes',               sa.Text(),      nullable=True),
        sa.Column('is_active',           sa.Boolean(),   nullable=False, server_default='true'),
        sa.Column('created_at',          sa.DateTime(),  nullable=False),
        sa.Column('updated_at',          sa.DateTime(),  nullable=False),
    )

    # ربط manager_id بعد إنشاء الجدول
    op.create_foreign_key(
        'fk_dept_manager', 'hr_departments', 'hr_employees',
        ['manager_id'], ['id']
    )

    # ── الحضور والانصراف ──────────────────────────────────────────────
    op.create_table(
        'hr_attendance',
        sa.Column('id',          sa.String(),   primary_key=True),
        sa.Column('tenant_id',   sa.String(),   sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('employee_id', sa.String(),   sa.ForeignKey('hr_employees.id'), nullable=False, index=True),
        sa.Column('date',        sa.Date(),     nullable=False, index=True),
        sa.Column('check_in',    sa.DateTime(), nullable=True),
        sa.Column('check_out',   sa.DateTime(), nullable=True),
        sa.Column('status',      sa.String(20), nullable=False, server_default='present'),
        sa.Column('notes',       sa.Text(),     nullable=True),
        sa.Column('created_at',  sa.DateTime(), nullable=False),
    )

    # ── طلبات الإجازة ─────────────────────────────────────────────────
    op.create_table(
        'hr_leave_requests',
        sa.Column('id',          sa.String(),   primary_key=True),
        sa.Column('tenant_id',   sa.String(),   sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('employee_id', sa.String(),   sa.ForeignKey('hr_employees.id'), nullable=False, index=True),
        sa.Column('leave_type',  sa.String(20), nullable=False),
        sa.Column('from_date',   sa.Date(),     nullable=False),
        sa.Column('to_date',     sa.Date(),     nullable=False),
        sa.Column('days',        sa.Integer(),  nullable=False),
        sa.Column('reason',      sa.Text(),     nullable=True),
        sa.Column('status',      sa.String(20), nullable=False, server_default='pending'),
        sa.Column('approved_by', sa.String(),   sa.ForeignKey('users.id'), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at',  sa.DateTime(), nullable=False),
    )

    # ── مسير الرواتب ──────────────────────────────────────────────────
    op.create_table(
        'hr_payroll',
        sa.Column('id',                  sa.String(),       primary_key=True),
        sa.Column('tenant_id',           sa.String(),       sa.ForeignKey('tenants.id'), nullable=False, index=True),
        sa.Column('employee_id',         sa.String(),       sa.ForeignKey('hr_employees.id'), nullable=False, index=True),
        sa.Column('month',               sa.Integer(),      nullable=False),
        sa.Column('year',                sa.Integer(),      nullable=False),
        sa.Column('basic_salary',        sa.Numeric(18, 2), nullable=False),
        sa.Column('housing_allowance',   sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('transport_allowance', sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('other_allowances',    sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('overtime_amount',     sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('gosi_employee',       sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('absence_deduction',   sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('other_deductions',    sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('gross_salary',        sa.Numeric(18, 2), nullable=False),
        sa.Column('total_deductions',    sa.Numeric(18, 2), nullable=False),
        sa.Column('net_salary',          sa.Numeric(18, 2), nullable=False),
        sa.Column('gosi_employer',       sa.Numeric(18, 2), nullable=False, server_default='0'),
        sa.Column('status',              sa.String(20),     nullable=False, server_default='draft'),
        sa.Column('journal_entry_id',    sa.String(),       nullable=True),
        sa.Column('notes',               sa.Text(),         nullable=True),
        sa.Column('created_by',          sa.String(),       sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at',          sa.DateTime(),     nullable=False),
    )

    # indexes
    op.create_index('ix_hr_payroll_month_year', 'hr_payroll', ['tenant_id', 'year', 'month'])


def downgrade() -> None:
    op.drop_table('hr_payroll')
    op.drop_table('hr_leave_requests')
    op.drop_table('hr_attendance')
    op.drop_constraint('fk_dept_manager', 'hr_departments', type_='foreignkey')
    op.drop_table('hr_employees')
    op.drop_table('hr_departments')
