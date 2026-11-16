from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.hr import service
from app.modules.hr import biometric_service

router = APIRouter(prefix="/hr", tags=["hr"])


@router.get("/biometric/devices")
async def list_biometric_devices(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await biometric_service.list_devices(db, tenant_id)


@router.post("/biometric/devices", status_code=201)
async def create_biometric_device(data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await biometric_service.create_device(db, user["tenant_id"], data)


@router.patch("/biometric/devices/{device_id}")
async def update_biometric_device(device_id: str, data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await biometric_service.update_device(db, user["tenant_id"], device_id, data)


@router.get("/biometric/links")
async def list_biometric_links(device_id: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await biometric_service.list_links(db, tenant_id, device_id)


@router.post("/biometric/links", status_code=201)
async def save_biometric_link(data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await biometric_service.save_link(db, user["tenant_id"], data)


@router.post("/biometric/devices/{device_id}/logs")
async def ingest_biometric_logs(device_id: str, data: dict, x_device_key: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    logs = data.get("logs") if isinstance(data, dict) else data
    return await biometric_service.ingest_logs_by_device_key(db, device_id, logs or [], x_device_key)


@router.get("/biometric/logs")
async def list_biometric_logs(device_id: Optional[str] = None, unprocessed_only: bool = False, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await biometric_service.list_logs(db, tenant_id, device_id, unprocessed_only)


@router.post("/biometric/process")
async def process_biometric_logs(user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await biometric_service.process_logs(db, user["tenant_id"])


# ─── Summary ─────────────────────────────────────────────────────────
@router.get("/summary")
async def hr_summary(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_hr_summary(db, tenant_id)


# ─── Departments ─────────────────────────────────────────────────────
@router.get("/departments")
async def list_departments(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_departments(db, tenant_id)


@router.post("/departments", status_code=201)
async def create_department(data: dict, user=Depends(require_role(["manager","hr"])), db: AsyncSession = Depends(get_db)):
    return await service.create_department(db, user["tenant_id"], data)


@router.patch("/departments/{dept_id}")
async def update_department(dept_id: str, data: dict, user=Depends(require_role(["manager","hr"])), db: AsyncSession = Depends(get_db)):
    return await service.update_department(db, user["tenant_id"], dept_id, data)


# ─── Employees ───────────────────────────────────────────────────────
@router.get("/employees")
async def list_employees(
    search: Optional[str] = None,
    department_id: Optional[str] = None,
    status: Optional[str] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_employees(db, tenant_id, search, department_id, status)


@router.get("/employees/{employee_id}")
async def get_employee(employee_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_employee(db, tenant_id, employee_id)


@router.post("/employees", status_code=201)
async def create_employee(data: dict, user=Depends(require_role(["manager","hr"])), db: AsyncSession = Depends(get_db)):
    return await service.create_employee(db, user["tenant_id"], data)


@router.patch("/employees/{employee_id}")
async def update_employee(employee_id: str, data: dict, user=Depends(require_role(["manager","hr"])), db: AsyncSession = Depends(get_db)):
    return await service.update_employee(db, user["tenant_id"], employee_id, data)


@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str, user=Depends(require_role(["manager","hr"])), db: AsyncSession = Depends(get_db)):
    return await service.delete_employee(db, user["tenant_id"], employee_id)


# ─── HR settings ─────────────────────────────────────────────────────
@router.get("/settings")
async def get_hr_settings(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_hr_settings(db, tenant_id)


@router.patch("/settings")
async def update_hr_settings(data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.update_hr_settings(db, user["tenant_id"], data)


@router.get("/advances")
async def list_advances(status: Optional[str] = None, employee_id: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_advances(db, tenant_id, status, employee_id)


@router.post("/advances", status_code=201)
async def create_advance(data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.create_advance(db, user["tenant_id"], user["user_id"], data)


@router.post("/advances/{advance_id}/approve")
async def approve_advance(advance_id: str, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.approve_advance(db, user["tenant_id"], advance_id, user["user_id"])


@router.post("/advances/{advance_id}/reject")
async def reject_advance(advance_id: str, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.reject_advance(db, user["tenant_id"], advance_id, user["user_id"])


@router.patch("/advances/{advance_id}")
async def update_advance(advance_id: str, data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.update_advance(db, user["tenant_id"], advance_id, data)


@router.delete("/advances/{advance_id}")
async def delete_advance(advance_id: str, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.delete_advance(db, user["tenant_id"], advance_id)


@router.get("/withdrawals")
async def list_withdrawals(
    employee_id: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None,
    status: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    return await service.get_withdrawals(db, tenant_id, employee_id, month, year, status)


@router.post("/withdrawals", status_code=201)
async def create_withdrawal(data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.create_withdrawal(db, user["tenant_id"], user["user_id"], data)


@router.post("/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.review_withdrawal(db, user["tenant_id"], withdrawal_id, user["user_id"], True)


@router.post("/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(withdrawal_id: str, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.review_withdrawal(db, user["tenant_id"], withdrawal_id, user["user_id"], False)


@router.patch("/withdrawals/{withdrawal_id}")
async def update_withdrawal(withdrawal_id: str, data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.update_withdrawal(db, user["tenant_id"], withdrawal_id, data)


@router.delete("/withdrawals/{withdrawal_id}")
async def delete_withdrawal(withdrawal_id: str, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.delete_withdrawal(db, user["tenant_id"], withdrawal_id)


@router.get("/salary-settlements")
async def list_salary_settlements(
    month: int, year: int, employee_id: Optional[str] = None,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    return await service.get_salary_settlements(db, tenant_id, month, year, employee_id)


@router.get("/salary-settlements/report")
async def salary_settlement_report(
    month: int, year: int, employee_id: Optional[str] = None,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    return await service.get_salary_settlement_report(db, tenant_id, month, year, employee_id)


@router.post("/salary-settlements", status_code=201)
async def create_salary_settlement(
    data: dict, user=Depends(require_role(["manager", "hr", "accountant"])), db: AsyncSession = Depends(get_db),
):
    try:
        employee_id = str(data.get("employee_id"))
        month = int(data.get("month")); year = int(data.get("year"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(400, "بيانات الموظف والشهر والسنة مطلوبة") from exc
    if month < 1 or month > 12 or year < 2000:
        raise HTTPException(400, "الشهر أو السنة غير صحيحة")
    return await service.create_salary_settlement(db, user["tenant_id"], user["user_id"], employee_id, month, year)


@router.post("/salary-settlements/{settlement_id}/payments", status_code=201)
async def record_salary_settlement_payment(
    settlement_id: str, data: dict,
    user=Depends(require_role(["manager", "hr", "accountant"])), db: AsyncSession = Depends(get_db),
):
    return await service.record_salary_settlement_payment(db, user["tenant_id"], user["user_id"], settlement_id, data)


@router.delete("/salary-settlement-payments/{payment_id}")
async def delete_salary_settlement_payment(payment_id: str, user=Depends(require_role(["manager", "hr", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.delete_salary_settlement_payment(db, user["tenant_id"], payment_id)


@router.get("/deductions")
async def list_deductions(status: Optional[str] = None, employee_id: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_deductions(db, tenant_id, status, employee_id)


@router.post("/deductions", status_code=201)
async def create_deduction(data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.create_deduction(db, user["tenant_id"], user["user_id"], data)


@router.patch("/deductions/{deduction_id}")
async def update_deduction(deduction_id: str, data: dict, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.update_deduction(db, user["tenant_id"], deduction_id, data)


@router.delete("/deductions/{deduction_id}")
async def delete_deduction(deduction_id: str, user=Depends(require_role(["manager", "hr"])), db: AsyncSession = Depends(get_db)):
    return await service.delete_deduction(db, user["tenant_id"], deduction_id)


@router.get("/deductions/report")
async def deduction_report(month: int, year: int, employee_id: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_deduction_report(db, tenant_id, month, year, employee_id)


@router.post("/deductions/{deduction_id}/approve")
async def approve_deduction(deduction_id: str, user=Depends(require_role(["manager", "hr", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.review_deduction(db, user["tenant_id"], deduction_id, user["user_id"], True)


@router.post("/deductions/{deduction_id}/reject")
async def reject_deduction(deduction_id: str, user=Depends(require_role(["manager", "hr", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.review_deduction(db, user["tenant_id"], deduction_id, user["user_id"], False)


# ─── Employee expenses, profile and reports ───────────────────────────
@router.get("/expenses")
async def list_employee_expenses(status: Optional[str] = None, employee_id: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_employee_expenses(db, tenant_id, status, employee_id)

@router.post("/expenses", status_code=201)
async def create_employee_expense(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_employee_expense(db, user["tenant_id"], user["user_id"], data)

@router.post("/expenses/{expense_id}/approve")
async def approve_employee_expense(expense_id: str, user=Depends(require_role(["manager", "hr", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.review_employee_expense(db, user["tenant_id"], expense_id, user["user_id"], True)

@router.post("/expenses/{expense_id}/reject")
async def reject_employee_expense(expense_id: str, user=Depends(require_role(["manager", "hr", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.review_employee_expense(db, user["tenant_id"], expense_id, user["user_id"], False)

@router.get("/employees/{employee_id}/profile")
async def employee_profile(employee_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_employee_profile(db, tenant_id, employee_id)

@router.get("/reports/financial")
async def hr_financial_report(month: int, year: int, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_hr_financial_report(db, tenant_id, month, year)


@router.get("/reports/statements")
async def hr_employee_statements(employee_id: Optional[str] = None, from_date: Optional[date] = None, to_date: Optional[date] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_employee_statements(db, tenant_id, employee_id, from_date, to_date)


# ─── Attendance ──────────────────────────────────────────────────────
@router.get("/attendance")
async def list_attendance(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    employee_id: Optional[str] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_attendance(db, tenant_id, date_from, date_to, employee_id)


@router.post("/attendance", status_code=201)
async def record_attendance(data: dict, user=Depends(require_role(["manager","hr","cashier"])), db: AsyncSession = Depends(get_db)):
    return await service.record_attendance(db, user["tenant_id"], data)


# ─── Leave Requests ──────────────────────────────────────────────────
@router.get("/leaves")
async def list_leaves(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_leave_requests(db, tenant_id, status, employee_id)


@router.post("/leaves", status_code=201)
async def create_leave(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """أي موظف يقدر يطلب إجازة"""
    return await service.create_leave_request(db, user["tenant_id"], data)


@router.post("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, user=Depends(require_role(["manager","hr"])), db: AsyncSession = Depends(get_db)):
    return await service.approve_leave(db, user["tenant_id"], leave_id, user["user_id"])


@router.post("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, user=Depends(require_role(["manager","hr"])), db: AsyncSession = Depends(get_db)):
    return await service.reject_leave(db, user["tenant_id"], leave_id, user["user_id"])


# ─── Payroll ─────────────────────────────────────────────────────────
@router.get("/payroll")
async def list_payroll(
    month: Optional[int] = None,
    year: Optional[int] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_payroll(db, tenant_id, month, year)


@router.post("/payroll/generate", status_code=201)
async def generate_payroll(
    month: int,
    year: int,
    user=Depends(require_role(["manager","hr","accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """توليد مسير الرواتب لشهر محدد"""
    return await service.generate_payroll(db, user["tenant_id"], user["user_id"], month, year)


@router.post("/payroll/confirm")
async def confirm_payroll(
    month: int,
    year: int,
    user=Depends(require_role(["manager","accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """تأكيد صرف الرواتب"""
    return await service.confirm_payroll(db, user["tenant_id"], month, year)


@router.delete("/payroll")
async def delete_payroll(
    month: int,
    year: int,
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """حذف مسير غير مدفوع مع عكس قيد الاستحقاق إن وجد."""
    return await service.delete_payroll_period(db, user["tenant_id"], user["user_id"], month, year)


@router.post("/payroll/pay")
async def pay_payroll(
    month: int,
    year: int,
    data: dict = {},
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """دفع المسير فعليًا من الصندوق أو البنك."""
    return await service.pay_payroll(
        db, user["tenant_id"], user["user_id"], month, year,
        data.get("payment_method", "cash"), data.get("bank_account_id"),
        data.get("allocations"),
    )


@router.patch("/payroll/{payroll_id}")
async def update_payroll_record(
    payroll_id: str,
    data: dict,
    user=Depends(require_role(["manager", "hr", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """تعديل مكونات سطر الراتب قبل الاعتماد."""
    return await service.update_payroll_record(db, user["tenant_id"], payroll_id, data)


# ─── GOSI ────────────────────────────────────────────────────────────
@router.get("/gosi")
async def gosi_report(
    month: int,
    year: int,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_gosi_report(db, tenant_id, month, year)
