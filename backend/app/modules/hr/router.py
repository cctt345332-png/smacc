from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import date

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.hr import service

router = APIRouter(prefix="/hr", tags=["hr"])


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


# ─── GOSI ────────────────────────────────────────────────────────────
@router.get("/gosi")
async def gosi_report(
    month: int,
    year: int,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_gosi_report(db, tenant_id, month, year)
