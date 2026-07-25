"""
HR Service — منطق الأعمال للموارد البشرية
"""
import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.hr import (
    Department, Employee, AttendanceRecord,
    LeaveRequest, PayrollRecord,
    EmployeeStatus, LeaveStatus,
)

GOSI_EMPLOYER_RATE = Decimal("0.09")
GOSI_EMPLOYEE_RATE = Decimal("0.09")


# ─── Departments ─────────────────────────────────────────────────────

async def get_departments(db: AsyncSession, tenant_id: str) -> list[Department]:
    r = await db.execute(
        select(Department)
        .where(Department.tenant_id == tenant_id, Department.is_active == True)
        .order_by(Department.name_ar)
    )
    return r.scalars().all()


async def create_department(db: AsyncSession, tenant_id: str, data: dict) -> Department:
    dept = Department(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        name_ar=data["name_ar"],
        name_en=data.get("name_en"),
        manager_id=data.get("manager_id"),
        budget=Decimal(str(data.get("budget", 0))),
        created_at=datetime.utcnow(),
    )
    db.add(dept)
    await db.commit()
    await db.refresh(dept)
    return dept


async def update_department(db: AsyncSession, tenant_id: str, dept_id: str, data: dict) -> Department:
    r = await db.execute(select(Department).where(Department.id == dept_id, Department.tenant_id == tenant_id))
    dept = r.scalar_one_or_none()
    if not dept:
        raise HTTPException(404, "القسم غير موجود")
    for k, v in data.items():
        if hasattr(dept, k):
            setattr(dept, k, v)
    await db.commit()
    await db.refresh(dept)
    return dept


# ─── Employees ───────────────────────────────────────────────────────

async def get_employees(
    db: AsyncSession, tenant_id: str,
    search: Optional[str] = None,
    department_id: Optional[str] = None,
    status: Optional[str] = None,
) -> list[Employee]:
    q = select(Employee).where(Employee.tenant_id == tenant_id)
    if search:
        q = q.where(
            Employee.full_name_ar.ilike(f"%{search}%") |
            Employee.employee_number.ilike(f"%{search}%") |
            Employee.job_title_ar.ilike(f"%{search}%")
        )
    if department_id:
        q = q.where(Employee.department_id == department_id)
    if status:
        q = q.where(Employee.status == status)
    q = q.options(selectinload(Employee.department)).order_by(Employee.full_name_ar)
    r = await db.execute(q)
    return r.scalars().all()


async def get_employee(db: AsyncSession, tenant_id: str, employee_id: str) -> Employee:
    r = await db.execute(
        select(Employee)
        .options(selectinload(Employee.department))
        .where(Employee.id == employee_id, Employee.tenant_id == tenant_id)
    )
    emp = r.scalar_one_or_none()
    if not emp:
        raise HTTPException(404, "الموظف غير موجود")
    return emp


async def create_employee(db: AsyncSession, tenant_id: str, data: dict) -> Employee:
    # توليد رقم وظيفي تلقائي
    count = (await db.execute(
        select(func.count()).where(Employee.tenant_id == tenant_id)
    )).scalar() or 0
    emp_number = data.get("employee_number") or f"EMP-{str(count + 1).zfill(3)}"

    emp = Employee(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        employee_number=emp_number,
        department_id=data.get("department_id"),
        full_name_ar=data["full_name_ar"],
        full_name_en=data.get("full_name_en"),
        national_id=data.get("national_id"),
        gender=data.get("gender", "male"),
        birth_date=data.get("birth_date"),
        nationality=data.get("nationality", "SA"),
        phone=data.get("phone"),
        email=data.get("email"),
        job_title_ar=data["job_title_ar"],
        job_title_en=data.get("job_title_en"),
        contract_type=data.get("contract_type", "full_time"),
        hire_date=data.get("hire_date", date.today()),
        basic_salary=Decimal(str(data.get("basic_salary", 0))),
        housing_allowance=Decimal(str(data.get("housing_allowance", 0))),
        transport_allowance=Decimal(str(data.get("transport_allowance", 0))),
        other_allowances=Decimal(str(data.get("other_allowances", 0))),
        gosi_eligible=data.get("gosi_eligible", True),
        annual_leave_days=data.get("annual_leave_days", 21),
        leave_balance=Decimal(str(data.get("annual_leave_days", 21))),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(emp)
    await db.commit()
    await db.refresh(emp)
    return emp


async def update_employee(db: AsyncSession, tenant_id: str, employee_id: str, data: dict) -> Employee:
    emp = await get_employee(db, tenant_id, employee_id)
    for k, v in data.items():
        if hasattr(emp, k) and k not in ("id", "tenant_id", "created_at"):
            setattr(emp, k, v)
    emp.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(emp)
    return emp


# ─── Attendance ──────────────────────────────────────────────────────

async def get_attendance(
    db: AsyncSession, tenant_id: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    employee_id: Optional[str] = None,
) -> list[AttendanceRecord]:
    q = select(AttendanceRecord).where(AttendanceRecord.tenant_id == tenant_id)
    if date_from:
        q = q.where(AttendanceRecord.date >= date_from)
    if date_to:
        q = q.where(AttendanceRecord.date <= date_to)
    if employee_id:
        q = q.where(AttendanceRecord.employee_id == employee_id)
    q = q.options(selectinload(AttendanceRecord.employee)).order_by(AttendanceRecord.date.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def record_attendance(db: AsyncSession, tenant_id: str, data: dict) -> AttendanceRecord:
    rec = AttendanceRecord(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        employee_id=data["employee_id"],
        date=data.get("date", date.today()),
        check_in=data.get("check_in"),
        check_out=data.get("check_out"),
        status=data.get("status", "present"),
        notes=data.get("notes"),
        created_at=datetime.utcnow(),
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return rec


# ─── Leave Requests ──────────────────────────────────────────────────

async def get_leave_requests(
    db: AsyncSession, tenant_id: str,
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
) -> list[LeaveRequest]:
    q = select(LeaveRequest).where(LeaveRequest.tenant_id == tenant_id)
    if status:
        q = q.where(LeaveRequest.status == status)
    if employee_id:
        q = q.where(LeaveRequest.employee_id == employee_id)
    q = q.options(selectinload(LeaveRequest.employee)).order_by(LeaveRequest.created_at.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def create_leave_request(db: AsyncSession, tenant_id: str, data: dict) -> LeaveRequest:
    req = LeaveRequest(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        employee_id=data["employee_id"],
        leave_type=data["leave_type"],
        from_date=data["from_date"],
        to_date=data["to_date"],
        days=data["days"],
        reason=data.get("reason"),
        created_at=datetime.utcnow(),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


async def approve_leave(db: AsyncSession, tenant_id: str, leave_id: str, user_id: str) -> LeaveRequest:
    r = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id, LeaveRequest.tenant_id == tenant_id))
    req = r.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "الطلب غير موجود")
    if req.status != "pending":
        raise HTTPException(400, "الطلب ليس في حالة انتظار")
    req.status = "approved"
    req.approved_by = user_id
    req.approved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(req)
    return req


async def reject_leave(db: AsyncSession, tenant_id: str, leave_id: str, user_id: str) -> LeaveRequest:
    r = await db.execute(select(LeaveRequest).where(LeaveRequest.id == leave_id, LeaveRequest.tenant_id == tenant_id))
    req = r.scalar_one_or_none()
    if not req:
        raise HTTPException(404, "الطلب غير موجود")
    if req.status != "pending":
        raise HTTPException(400, "الطلب ليس في حالة انتظار")
    req.status = "rejected"
    req.approved_by = user_id
    req.approved_at = datetime.utcnow()
    await db.commit()
    await db.refresh(req)
    return req


# ─── Payroll ─────────────────────────────────────────────────────────

async def get_payroll(
    db: AsyncSession, tenant_id: str,
    month: Optional[int] = None,
    year: Optional[int] = None,
) -> list[PayrollRecord]:
    q = select(PayrollRecord).where(PayrollRecord.tenant_id == tenant_id)
    if month:
        q = q.where(PayrollRecord.month == month)
    if year:
        q = q.where(PayrollRecord.year == year)
    q = q.options(selectinload(PayrollRecord.employee)).order_by(PayrollRecord.created_at.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def generate_payroll(db: AsyncSession, tenant_id: str, user_id: str, month: int, year: int) -> list[PayrollRecord]:
    """توليد مسير الرواتب لشهر محدد لجميع الموظفين النشطين"""
    # التحقق من عدم وجود مسير لنفس الشهر
    existing = (await db.execute(
        select(func.count()).where(
            PayrollRecord.tenant_id == tenant_id,
            PayrollRecord.month == month,
            PayrollRecord.year == year,
        )
    )).scalar()
    if existing:
        raise HTTPException(400, f"مسير رواتب {month}/{year} موجود بالفعل")

    employees = await get_employees(db, tenant_id, status="active")
    records = []

    for emp in employees:
        gross = emp.basic_salary + emp.housing_allowance + emp.transport_allowance + emp.other_allowances
        gosi_emp = (emp.basic_salary * GOSI_EMPLOYEE_RATE) if emp.gosi_eligible else Decimal("0")
        gosi_er  = (emp.basic_salary * GOSI_EMPLOYER_RATE) if emp.gosi_eligible else Decimal("0")
        total_deductions = gosi_emp
        net = gross - total_deductions

        rec = PayrollRecord(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            employee_id=emp.id,
            month=month,
            year=year,
            basic_salary=emp.basic_salary,
            housing_allowance=emp.housing_allowance,
            transport_allowance=emp.transport_allowance,
            other_allowances=emp.other_allowances,
            overtime_amount=Decimal("0"),
            gosi_employee=gosi_emp,
            absence_deduction=Decimal("0"),
            other_deductions=Decimal("0"),
            gross_salary=gross,
            total_deductions=total_deductions,
            net_salary=net,
            gosi_employer=gosi_er,
            status="draft",
            created_by=user_id,
            created_at=datetime.utcnow(),
        )
        db.add(rec)
        records.append(rec)

    await db.commit()
    return records


async def confirm_payroll(db: AsyncSession, tenant_id: str, month: int, year: int) -> dict:
    """تأكيد صرف الرواتب"""
    r = await db.execute(
        select(PayrollRecord).where(
            PayrollRecord.tenant_id == tenant_id,
            PayrollRecord.month == month,
            PayrollRecord.year == year,
            PayrollRecord.status == "draft",
        )
    )
    records = r.scalars().all()
    for rec in records:
        rec.status = "paid"
    await db.commit()
    return {"paid": len(records), "month": month, "year": year}


# ─── GOSI Report ─────────────────────────────────────────────────────

async def get_gosi_report(db: AsyncSession, tenant_id: str, month: int, year: int) -> dict:
    r = await db.execute(
        select(PayrollRecord)
        .options(selectinload(PayrollRecord.employee))
        .where(
            PayrollRecord.tenant_id == tenant_id,
            PayrollRecord.month == month,
            PayrollRecord.year == year,
        )
    )
    records = r.scalars().all()

    lines = []
    total_employer = Decimal("0")
    total_employee = Decimal("0")

    for rec in records:
        if rec.employee and rec.employee.gosi_eligible:
            total_employer += rec.gosi_employer
            total_employee += rec.gosi_employee
            lines.append({
                "employee_id":    rec.employee_id,
                "employee_name":  rec.employee.full_name_ar if rec.employee else "",
                "basic_salary":   float(rec.basic_salary),
                "employer_share": float(rec.gosi_employer),
                "employee_share": float(rec.gosi_employee),
                "total":          float(rec.gosi_employer + rec.gosi_employee),
            })

    return {
        "month": month,
        "year": year,
        "lines": lines,
        "total_employer": float(total_employer),
        "total_employee": float(total_employee),
        "grand_total": float(total_employer + total_employee),
        "employer_rate": float(GOSI_EMPLOYER_RATE * 100),
        "employee_rate": float(GOSI_EMPLOYEE_RATE * 100),
    }


# ─── HR Summary ──────────────────────────────────────────────────────

async def get_hr_summary(db: AsyncSession, tenant_id: str) -> dict:
    total_employees = (await db.execute(
        select(func.count()).where(Employee.tenant_id == tenant_id, Employee.is_active == True)
    )).scalar() or 0

    active_employees = (await db.execute(
        select(func.count()).where(
            Employee.tenant_id == tenant_id,
            Employee.status == "active",
        )
    )).scalar() or 0

    pending_leaves = (await db.execute(
        select(func.count()).where(
            LeaveRequest.tenant_id == tenant_id,
            LeaveRequest.status == "pending",
        )
    )).scalar() or 0

    today = date.today()
    present_today = (await db.execute(
        select(func.count()).where(
            AttendanceRecord.tenant_id == tenant_id,
            AttendanceRecord.date == today,
            AttendanceRecord.status == "present",
        )
    )).scalar() or 0

    return {
        "total_employees": total_employees,
        "active_employees": active_employees,
        "pending_leaves": pending_leaves,
        "present_today": present_today,
    }
