"""migrate legacy one-off advances into monthly withdrawals

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
"""
from alembic import op
import sqlalchemy as sa

revision = "f7a8b9c0d1e2"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade():
    # السجل القديم الذي كان إجماليه مساويًا لقسطه كان في الواقع سحبية واحدة.
    # السلف السنوية ذات القسط الأقل من الإجمالي تبقى في جدول السلف كما هي.
    op.execute(sa.text("""
        INSERT INTO hr_employee_withdrawals (
            id, tenant_id, employee_id, withdrawal_date, salary_month, salary_year,
            amount, reason, status, settlement_id, approved_by, approved_at,
            created_by, created_at
        )
        SELECT
            md5('legacy-withdrawal:' || a.id),
            a.tenant_id,
            a.employee_id,
            COALESCE(a.created_at::date, make_date(a.start_year, a.start_month, 1)),
            a.start_month,
            a.start_year,
            a.total_amount,
            COALESCE(a.reason, 'سحبية قديمة من السجل السابق'),
            'approved',
            NULL,
            a.approved_by,
            a.approved_at,
            a.created_by,
            COALESCE(a.created_at, CURRENT_TIMESTAMP)
        FROM hr_employee_advances a
        WHERE a.status <> 'rejected'
          AND a.total_amount = a.monthly_installment
          AND NOT EXISTS (
              SELECT 1 FROM hr_employee_withdrawals w
              WHERE w.id = md5('legacy-withdrawal:' || a.id)
          )
    """))


def downgrade():
    op.execute(sa.text("""
        DELETE FROM hr_employee_withdrawals
        WHERE id IN (
            SELECT md5('legacy-withdrawal:' || id)
            FROM hr_employee_advances
            WHERE total_amount = monthly_installment
        )
    """))
