"""
HR Service — منطق الأعمال للموارد البشرية
"""
import uuid
from datetime import datetime, date, timedelta, time
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.models.hr import (
    Department, Employee, AttendanceRecord,
    LeaveRequest, PayrollRecord,
    HRSettings, EmployeeAdvance, EmployeeExpense, PayrollPayment,
    EmployeeStatus, LeaveStatus,
)

GOSI_EMPLOYER_RATE = Decimal("0.09")
GOSI_EMPLOYEE_RATE = Decimal("0.09")


def _optional_text(value):
    """تحويل النص الفارغ القادم من نموذج الويب إلى NULL."""
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _parse_date(value, field_name: str, default: date | None = None) -> date | None:
    if value in (None, ""):
        return default
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError as exc:
        raise HTTPException(400, f"قيمة {field_name} غير صحيحة") from exc


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


async def get_hr_settings(db: AsyncSession, tenant_id: str) -> HRSettings:
    settings = await db.scalar(select(HRSettings).where(HRSettings.tenant_id == tenant_id))
    if settings:
        return settings
    settings = HRSettings(id=str(uuid.uuid4()), tenant_id=tenant_id, created_at=datetime.utcnow(), updated_at=datetime.utcnow())
    db.add(settings)
    await db.commit()
    await db.refresh(settings)
    return settings


async def update_hr_settings(db: AsyncSession, tenant_id: str, data: dict) -> HRSettings:
    settings = await get_hr_settings(db, tenant_id)
    start = str(data.get("work_start_time", settings.work_start_time))
    end = str(data.get("work_end_time", settings.work_end_time))
    try:
        time.fromisoformat(start)
        time.fromisoformat(end)
    except ValueError as exc:
        raise HTTPException(400, "صيغة وقت الدوام غير صحيحة") from exc
    grace = int(data.get("grace_minutes", settings.grace_minutes))
    multiplier = Decimal(str(data.get("overtime_multiplier", settings.overtime_multiplier)))
    if grace < 0 or grace > 180 or multiplier < 1 or multiplier > 5:
        raise HTTPException(400, "قيم إعدادات الدوام خارج النطاق المسموح")
    settings.work_start_time = start[:5]
    settings.work_end_time = end[:5]
    settings.grace_minutes = grace
    settings.overtime_multiplier = multiplier
    settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(settings)
    return settings


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
    department_id = _optional_text(data.get("department_id"))
    if department_id:
        department = await db.scalar(
            select(Department).where(
                Department.id == department_id,
                Department.tenant_id == tenant_id,
                Department.is_active == True,
            )
        )
        if not department:
            raise HTTPException(400, "القسم المحدد غير موجود في الشركة")
    hire_date = _parse_date(data.get("hire_date"), "تاريخ التعيين", date.today())
    birth_date = _parse_date(data.get("birth_date"), "تاريخ الميلاد")

    identity_data = data.get("national_id_file_data")
    identity_type = _optional_text(data.get("national_id_content_type"))
    identity_name = _optional_text(data.get("national_id_file_name"))
    if identity_data:
        if len(str(identity_data)) > 7_000_000:
            raise HTTPException(400, "حجم ملف الهوية يتجاوز 5 ميجابايت")
        allowed_identity_types = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
        if identity_type not in allowed_identity_types:
            raise HTTPException(400, "صيغة ملف الهوية غير مدعومة. استخدم JPG أو PNG أو WEBP أو PDF")
    emp = Employee(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        employee_number=emp_number,
        department_id=department_id,
        full_name_ar=data["full_name_ar"],
        full_name_en=_optional_text(data.get("full_name_en")),
        national_id=_optional_text(data.get("national_id")),
        national_id_file_name=identity_name,
        national_id_content_type=identity_type,
        national_id_file_data=identity_data,
        gender=data.get("gender", "male"),
        birth_date=birth_date,
        nationality=data.get("nationality", "SA"),
        phone=_optional_text(data.get("phone")),
        email=_optional_text(data.get("email")),
        job_title_ar=data["job_title_ar"],
        job_title_en=_optional_text(data.get("job_title_en")),
        contract_type=data.get("contract_type", "full_time"),
        hire_date=hire_date,
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
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(409, "تعذر حفظ الموظف: الرقم الوظيفي مستخدم أو توجد بيانات مرتبطة غير صحيحة") from exc
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


async def delete_employee(db: AsyncSession, tenant_id: str, employee_id: str) -> dict:
    emp = await get_employee(db, tenant_id, employee_id)
    linked = [
        (PayrollRecord, PayrollRecord.employee_id, "مسيرات رواتب"),
        (EmployeeAdvance, EmployeeAdvance.employee_id, "سلف أو سحبيات"),
        (EmployeeExpense, EmployeeExpense.employee_id, "مصروفات"),
        (AttendanceRecord, AttendanceRecord.employee_id, "سجلات حضور"),
        (LeaveRequest, LeaveRequest.employee_id, "طلبات إجازات"),
    ]
    found = []
    for model, field, label in linked:
        count = (await db.execute(select(func.count()).where(model.tenant_id == tenant_id, field == employee_id))).scalar() or 0
        if count:
            found.append(f"{label} ({count})")
    if found:
        raise HTTPException(409, "لا يمكن حذف الموظف لوجود سجلات مرتبطة: " + "، ".join(found) + ". يمكنك إيقافه بدل الحذف.")
    await db.delete(emp)
    await db.commit()
    return {"deleted": True, "id": employee_id}


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
    employee = await db.scalar(select(Employee).where(Employee.id == req.employee_id, Employee.tenant_id == tenant_id))
    if not employee:
        raise HTTPException(404, "الموظف غير موجود")
    if req.leave_type == "annual" and Decimal(str(employee.leave_balance or 0)) < Decimal(str(req.days)):
        raise HTTPException(409, f"رصيد الإجازة غير كافٍ. المتبقي: {employee.leave_balance} يوم")
    req.status = "approved"
    req.approved_by = user_id
    req.approved_at = datetime.utcnow()
    if req.leave_type == "annual":
        employee.leave_balance = Decimal(str(employee.leave_balance or 0)) - Decimal(str(req.days))
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


# ─── Employee advances ───────────────────────────────────────────────
async def get_advances(db: AsyncSession, tenant_id: str, status: str | None = None, employee_id: str | None = None):
    q = select(EmployeeAdvance).where(EmployeeAdvance.tenant_id == tenant_id).options(selectinload(EmployeeAdvance.employee)).order_by(EmployeeAdvance.created_at.desc())
    if status:
        q = q.where(EmployeeAdvance.status == status)
    if employee_id:
        q = q.where(EmployeeAdvance.employee_id == employee_id)
    return (await db.execute(q)).scalars().all()


async def create_advance(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> EmployeeAdvance:
    employee_id = data.get("employee_id")
    employee = await db.scalar(select(Employee).where(Employee.id == employee_id, Employee.tenant_id == tenant_id, Employee.is_active.is_(True)))
    if not employee:
        raise HTTPException(404, "الموظف غير موجود أو غير نشط")
    total = Decimal(str(data.get("total_amount", 0)))
    installment = Decimal(str(data.get("monthly_installment", 0)))
    if total <= 0 or installment <= 0 or installment > total:
        raise HTTPException(400, "قيمة السلفة والقسط غير صحيحة")
    start_month, start_year = int(data.get("start_month")), int(data.get("start_year"))
    if start_month < 1 or start_month > 12:
        raise HTTPException(400, "شهر بداية السداد غير صحيح")
    advance = EmployeeAdvance(id=str(uuid.uuid4()), tenant_id=tenant_id, employee_id=employee_id,
        total_amount=total, monthly_installment=installment, paid_amount=Decimal("0"),
        start_month=start_month, start_year=start_year, status="pending", reason=data.get("reason"),
        created_by=user_id, created_at=datetime.utcnow())
    db.add(advance)
    await db.commit(); await db.refresh(advance)
    return advance


async def approve_advance(db: AsyncSession, tenant_id: str, advance_id: str, user_id: str) -> EmployeeAdvance:
    advance = await db.scalar(select(EmployeeAdvance).where(EmployeeAdvance.id == advance_id, EmployeeAdvance.tenant_id == tenant_id))
    if not advance: raise HTTPException(404, "السلفة غير موجودة")
    if advance.status != "pending": raise HTTPException(400, "السلفة ليست بانتظار الاعتماد")
    advance.status = "active"; advance.approved_by = user_id; advance.approved_at = datetime.utcnow()
    await db.commit(); await db.refresh(advance); return advance


async def reject_advance(db: AsyncSession, tenant_id: str, advance_id: str, user_id: str) -> EmployeeAdvance:
    advance = await db.scalar(select(EmployeeAdvance).where(EmployeeAdvance.id == advance_id, EmployeeAdvance.tenant_id == tenant_id))
    if not advance: raise HTTPException(404, "السلفة غير موجودة")
    if advance.status != "pending": raise HTTPException(400, "السلفة ليست بانتظار الاعتماد")
    advance.status = "rejected"; advance.approved_by = user_id; advance.approved_at = datetime.utcnow()
    await db.commit(); await db.refresh(advance); return advance


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
    month_start = date(year, month, 1)
    month_end = date(year + (month == 12), 1 if month == 12 else month + 1, 1) - timedelta(days=1)
    settings = await get_hr_settings(db, tenant_id)
    work_start = time.fromisoformat(settings.work_start_time)
    work_end = time.fromisoformat(settings.work_end_time)
    grace_delta = timedelta(minutes=settings.grace_minutes)

    for emp in employees:
        gross = emp.basic_salary + emp.housing_allowance + emp.transport_allowance + emp.other_allowances
        # الشركة تتحمل التأمينات حسب سياسة الشركة؛ لا تُخصم من الموظف.
        gosi_emp = Decimal("0")
        gosi_er  = (emp.basic_salary * GOSI_EMPLOYER_RATE) if emp.gosi_eligible else Decimal("0")
        attendance_rows = (await db.execute(select(AttendanceRecord).where(
            AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.employee_id == emp.id,
            AttendanceRecord.date >= month_start, AttendanceRecord.date <= month_end,
        ))).scalars().all()
        absent_days = sum(1 for row in attendance_rows if row.status == "absent")
        overtime_hours = Decimal("0")
        late_minutes = 0
        for row in attendance_rows:
            if row.check_in:
                scheduled_start = datetime.combine(row.date, work_start)
                grace_deadline = scheduled_start + grace_delta
                if row.check_in > grace_deadline:
                    late_minutes += int((row.check_in - grace_deadline).total_seconds() // 60)
            if row.check_out:
                scheduled_end = datetime.combine(row.date, work_end)
                if row.check_out > scheduled_end:
                    overtime_hours += Decimal(str((row.check_out - scheduled_end).total_seconds() / 3600)).quantize(Decimal("0.01"))
        unpaid_leaves = (await db.execute(select(LeaveRequest).where(
            LeaveRequest.tenant_id == tenant_id, LeaveRequest.employee_id == emp.id,
            LeaveRequest.status == "approved", LeaveRequest.leave_type == "unpaid",
            LeaveRequest.from_date <= month_end, LeaveRequest.to_date >= month_start,
        ))).scalars().all()
        unpaid_leave_days = sum(
            ((min(req.to_date, month_end) - max(req.from_date, month_start)).days + 1)
            for req in unpaid_leaves
        )
        absence_days = Decimal(str(absent_days + unpaid_leave_days))
        absence_deduction = (gross / Decimal("30") * absence_days).quantize(Decimal("0.01"))
        hourly_rate = (gross / Decimal("30") / Decimal("8")) if gross else Decimal("0")
        overtime_amount = (hourly_rate * settings.overtime_multiplier * overtime_hours).quantize(Decimal("0.01"))
        late_deduction = (hourly_rate * Decimal(late_minutes) / Decimal("60")).quantize(Decimal("0.01"))
        advances = (await db.execute(select(EmployeeAdvance).where(
            EmployeeAdvance.tenant_id == tenant_id, EmployeeAdvance.employee_id == emp.id,
            EmployeeAdvance.status == "active",
            ((EmployeeAdvance.start_year < year) | ((EmployeeAdvance.start_year == year) & (EmployeeAdvance.start_month <= month))),
            EmployeeAdvance.paid_amount < EmployeeAdvance.total_amount,
        ))).scalars().all()
        advance_deduction = sum((min(Decimal(str(a.monthly_installment)), Decimal(str(a.total_amount - a.paid_amount))) for a in advances), Decimal("0"))
        total_deductions = gosi_emp + absence_deduction + late_deduction + advance_deduction
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
            overtime_amount=overtime_amount,
            gosi_employee=gosi_emp,
            absence_deduction=absence_deduction,
            other_deductions=late_deduction,
            advance_deduction=advance_deduction,
            gross_salary=gross,
            total_deductions=total_deductions,
            net_salary=net,
            gosi_employer=gosi_er,
            status="draft",
            created_by=user_id,
            created_at=datetime.utcnow(),
            notes=(f"تلقائي: غياب/إجازة غير مدفوعة {absence_days} يوم، تأخير {late_minutes} دقيقة، إضافي {overtime_hours} ساعة"
                   + (f"، قسط سلف {advance_deduction} ر.س" if advance_deduction else ""))
                   if absence_days or late_minutes or overtime_hours or advance_deduction else None,
        )
        db.add(rec)
        records.append(rec)
        for advance in advances:
            advance.paid_amount = min(advance.total_amount, advance.paid_amount + min(advance.monthly_installment, advance.total_amount - advance.paid_amount))
            if advance.paid_amount >= advance.total_amount:
                advance.status = "completed"

    await db.commit()
    return records


async def update_payroll_record(db: AsyncSession, tenant_id: str, payroll_id: str, data: dict) -> PayrollRecord:
    """تعديل البدلات والخصومات قبل اعتماد سطر الراتب."""
    rec = (await db.execute(
        select(PayrollRecord).where(
            PayrollRecord.id == payroll_id,
            PayrollRecord.tenant_id == tenant_id,
        )
    )).scalar_one_or_none()
    if not rec:
        raise HTTPException(404, "سطر الراتب غير موجود")
    if rec.status != "draft" or rec.journal_entry_id:
        raise HTTPException(409, "لا يمكن تعديل راتب تم اعتماده أو ترحيله")

    editable = (
        "basic_salary", "housing_allowance", "transport_allowance",
        "other_allowances", "overtime_amount", "absence_deduction", "other_deductions", "advance_deduction",
    )
    for field in editable:
        if field in data:
            try:
                value = Decimal(str(data[field]))
            except Exception as exc:
                raise HTTPException(400, f"قيمة {field} غير صحيحة") from exc
            if value < 0:
                raise HTTPException(400, "لا يمكن إدخال مبلغ سالب في مكونات الراتب")
            setattr(rec, field, value)

    rec.gross_salary = (
        rec.basic_salary + rec.housing_allowance + rec.transport_allowance
        + rec.other_allowances + rec.overtime_amount
    )
    rec.total_deductions = rec.gosi_employee + rec.absence_deduction + rec.other_deductions + rec.advance_deduction
    rec.net_salary = rec.gross_salary - rec.total_deductions
    rec.notes = data.get("notes", rec.notes)
    await db.commit()
    await db.refresh(rec)
    return rec


async def confirm_payroll(db: AsyncSession, tenant_id: str, month: int, year: int) -> dict:
    """تأكيد مسير الرواتب وإنشاء قيده المحاسبي مرة واحدة فقط."""
    from app.models.accounting import (
        Account, FiscalYear, FiscalYearStatus,
        JournalEntry, JournalEntryLine, JournalEntryStatus,
    )
    from app.modules.accounting.service import get_operational_account, _next_entry_number

    r = await db.execute(
        select(PayrollRecord).where(
            PayrollRecord.tenant_id == tenant_id,
            PayrollRecord.month == month,
            PayrollRecord.year == year,
            PayrollRecord.status == "draft",
        )
    )
    records = r.scalars().all()
    if not records:
        raise HTTPException(400, "لا توجد رواتب مسودة لهذا الشهر")
    if any(rec.journal_entry_id for rec in records):
        raise HTTPException(409, "تم إنشاء قيد هذا المسير مسبقًا ولا يجوز تكراره")

    payroll_expense = await get_operational_account(db, tenant_id, "payroll_expense")
    payroll_payable = await get_operational_account(db, tenant_id, "payroll_payable")
    gosi_payable = await get_operational_account(db, tenant_id, "accrued_expenses")
    gosi_expense = (await db.execute(
        select(Account).where(
            Account.tenant_id == tenant_id,
            Account.is_active.is_(True),
            Account.is_posting.is_(True),
            (Account.code.in_(["0522", "522000"]) | Account.name_ar.like("%التأمينات الاجتماعية%")),
        ).order_by(Account.code)
    )).scalars().first()
    if not gosi_expense:
        raise HTTPException(409, "حساب التأمينات الاجتماعية غير مهيأ في شجرة الحسابات")

    first_day = date(year, month, 1)
    fiscal_year = (await db.execute(
        select(FiscalYear).where(
            FiscalYear.tenant_id == tenant_id,
            FiscalYear.status == FiscalYearStatus.OPEN,
            FiscalYear.start_date <= first_day,
            FiscalYear.end_date >= first_day,
        ).order_by(FiscalYear.is_default.desc(), FiscalYear.start_date.desc())
    )).scalars().first()
    if not fiscal_year:
        raise HTTPException(409, "لا توجد سنة مالية مفتوحة لشهر مسير الرواتب")

    total_gross = sum((Decimal(str(rec.gross_salary or 0)) for rec in records), Decimal("0"))
    total_employee_gosi = sum((Decimal(str(rec.gosi_employee or 0)) for rec in records), Decimal("0"))
    total_employer_gosi = sum((Decimal(str(rec.gosi_employer or 0)) for rec in records), Decimal("0"))
    total_net = sum((Decimal(str(rec.net_salary or 0)) for rec in records), Decimal("0"))
    total_debit = total_gross + total_employer_gosi
    total_credit = total_net + total_employee_gosi + total_employer_gosi
    if total_debit != total_credit:
        raise HTTPException(409, "مكونات مسير الرواتب غير متوازنة محاسبيًا")

    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        entry_number=await _next_entry_number(db, tenant_id),
        entry_date=datetime(year, month, 1), fiscal_year_id=fiscal_year.id,
        description_ar=f"قيد مسير رواتب {month}/{year}",
        description_en=f"Payroll journal {month}/{year}",
        status=JournalEntryStatus.POSTED, source="payroll",
        reference=f"PAYROLL-{year}-{month:02d}",
        total_debit=total_debit, total_credit=total_credit,
        created_by=records[0].created_by, posted_by=records[0].created_by,
        posted_at=datetime.utcnow(),
    )
    db.add(entry)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id, account_id=payroll_expense.id,
        description=f"رواتب وبدلات {month}/{year}", debit=total_gross, credit=0, line_order=0,
    ))
    if total_employer_gosi:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id, account_id=gosi_expense.id,
            description=f"حصة صاحب العمل من التأمينات {month}/{year}",
            debit=total_employer_gosi, credit=0, line_order=1,
        ))
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id, account_id=payroll_payable.id,
        description=f"رواتب مستحقة صافي {month}/{year}", debit=0, credit=total_net, line_order=2,
    ))
    if total_employee_gosi + total_employer_gosi:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id, account_id=gosi_payable.id,
            description=f"تأمينات مستحقة {month}/{year}",
            debit=0, credit=total_employee_gosi + total_employer_gosi, line_order=3,
        ))
    for rec in records:
        rec.status = "approved"
        rec.journal_entry_id = entry.id
    await db.commit()
    return {
        "paid": len(records), "month": month, "year": year,
        "journal_entry_id": entry.id, "journal_entry_number": entry.entry_number,
        "total_net": float(total_net),
    }



async def pay_payroll(
    db: AsyncSession, tenant_id: str, user_id: str, month: int, year: int,
    payment_method: str = "cash", bank_account_id: str | None = None, allocations: list[dict] | None = None,
) -> dict:
    """دفع مسير معتمد فعليًا من الصندوق أو البنك وإنشاء قيد مستقل."""
    from app.models.accounting import Account, FiscalYear, FiscalYearStatus, JournalEntry, JournalEntryLine, JournalEntryStatus, BankAccount
    from app.modules.accounting.service import get_operational_account, _next_entry_number

    rows = (await db.execute(select(PayrollRecord).where(
        PayrollRecord.tenant_id == tenant_id, PayrollRecord.month == month, PayrollRecord.year == year,
    ))).scalars().all()
    if not rows:
        raise HTTPException(404, "لا يوجد مسير رواتب لهذا الشهر")
    if any(rec.status == "draft" for rec in rows):
        raise HTTPException(409, "يجب اعتماد مسير الرواتب أولًا")
    eligible = {rec.id: rec for rec in rows if rec.status in ("approved", "partial") and Decimal(str(rec.paid_amount or 0)) < Decimal(str(rec.net_salary or 0))}
    if not eligible:
        raise HTTPException(409, "لا توجد رواتب متبقية للدفع")
    if allocations:
        selected = {}
        for item in allocations:
            rid = str(item.get("payroll_id")); value = Decimal(str(item.get("amount", 0)))
            if rid not in eligible or value <= 0: raise HTTPException(400, "بيانات دفعة الموظف غير صحيحة")
            selected[rid] = selected.get(rid, Decimal("0")) + value
    else:
        selected = {rid: Decimal(str(rec.net_salary or 0)) - Decimal(str(rec.paid_amount or 0)) for rid, rec in eligible.items()}
    for rid, value in selected.items():
        remaining = Decimal(str(eligible[rid].net_salary or 0)) - Decimal(str(eligible[rid].paid_amount or 0))
        if value > remaining: raise HTTPException(400, "مبلغ الدفع أكبر من المتبقي للموظف")
    accrual_ids = {rec.journal_entry_id for rec in rows if rec.journal_entry_id}
    if not accrual_ids:
        raise HTTPException(409, "مسير الرواتب غير مرحّل محاسبيًا")

    amount = sum(selected.values(), Decimal("0"))
    method = (payment_method or "cash").lower()
    source_account = None
    if method in ("bank", "bank_transfer") and bank_account_id:
        bank = await db.get(BankAccount, bank_account_id)
        if not bank or bank.tenant_id != tenant_id or not bank.gl_account_id:
            raise HTTPException(400, "الحساب البنكي غير صالح")
        source_account = await db.get(Account, bank.gl_account_id)
    else:
        mapping = "default_bank" if method in ("bank", "bank_transfer") else "default_cash"
        source_account = await get_operational_account(db, tenant_id, mapping)
    payable = await get_operational_account(db, tenant_id, "payroll_payable")
    if not source_account or not source_account.is_active or not source_account.is_posting:
        raise HTTPException(409, "حساب الدفع غير صالح أو غير قابل للقيد")

    payment_date = datetime.utcnow()
    fiscal_year = (await db.execute(select(FiscalYear).where(
        FiscalYear.tenant_id == tenant_id, FiscalYear.status == FiscalYearStatus.OPEN,
        FiscalYear.start_date <= payment_date.date(), FiscalYear.end_date >= payment_date.date(),
    ).order_by(FiscalYear.is_default.desc(), FiscalYear.start_date.desc()))).scalars().first()
    if not fiscal_year:
        raise HTTPException(409, "لا توجد سنة مالية مفتوحة لتاريخ الدفع")

    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id, entry_number=await _next_entry_number(db, tenant_id),
        entry_date=payment_date, fiscal_year_id=fiscal_year.id,
        description_ar=f"دفع رواتب {month}/{year} - {"بنك" if method in ("bank", "bank_transfer") else "صندوق"}",
        description_en=f"Payroll payment {month}/{year}", status=JournalEntryStatus.POSTED,
        source="payroll_payment", reference=f"PAYROLL-PAY-{year}-{month:02d}",
        total_debit=amount, total_credit=amount, created_by=user_id, posted_by=user_id, posted_at=payment_date,
    )
    db.add(entry)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id, account_id=payable.id,
        description=f"سداد صافي رواتب {month}/{year}", debit=amount, credit=0, line_order=0,
    ))
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id, account_id=source_account.id,
        description=f"دفع رواتب من {"البنك" if method in ("bank", "bank_transfer") else "الصندوق"}", debit=0, credit=amount, line_order=1,
    ))
    for rid, value in selected.items():
        db.add(PayrollPayment(
            id=str(uuid.uuid4()), tenant_id=tenant_id, payroll_id=rid, amount=value,
            payment_method=method, journal_entry_id=entry.id, paid_by=user_id,
            paid_at=payment_date,
        ))
    for rid, value in selected.items():
        rec = eligible[rid]
        rec.paid_amount = Decimal(str(rec.paid_amount or 0)) + value
        rec.status = "paid" if rec.paid_amount >= Decimal(str(rec.net_salary or 0)) else "partial"
    await db.commit()
    return {
        "paid": len(selected), "month": month, "year": year, "amount": float(amount),
        "payment_method": method, "journal_entry_id": entry.id, "journal_entry_number": entry.entry_number,
    }

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


# ─── Employee expenses and profile ───────────────────────────────────
async def get_employee_expenses(db, tenant_id, status=None, employee_id=None):
    q = select(EmployeeExpense).where(EmployeeExpense.tenant_id == tenant_id).options(selectinload(EmployeeExpense.employee)).order_by(EmployeeExpense.expense_date.desc(), EmployeeExpense.created_at.desc())
    if status: q = q.where(EmployeeExpense.status == status)
    if employee_id: q = q.where(EmployeeExpense.employee_id == employee_id)
    return (await db.execute(q)).scalars().all()

async def create_employee_expense(db, tenant_id, user_id, data):
    employee = await db.scalar(select(Employee).where(Employee.id == data.get("employee_id"), Employee.tenant_id == tenant_id))
    if not employee: raise HTTPException(404, "الموظف غير موجود")
    amount = Decimal(str(data.get("amount", 0)))
    if amount <= 0: raise HTTPException(400, "قيمة المصروف يجب أن تكون أكبر من صفر")
    expense = EmployeeExpense(id=str(uuid.uuid4()), tenant_id=tenant_id, employee_id=employee.id,
        expense_date=_parse_date(data.get("expense_date"), "تاريخ المصروف", date.today()), category=str(data.get("category") or "عام"),
        description=_optional_text(data.get("description")), amount=amount, status="pending",
        receipt_file_name=data.get("receipt_file_name"), receipt_content_type=data.get("receipt_content_type"),
        receipt_file_data=data.get("receipt_file_data"), created_by=user_id, created_at=datetime.utcnow())
    db.add(expense); await db.commit(); await db.refresh(expense); return expense

async def review_employee_expense(db, tenant_id, expense_id, user_id, approved):
    expense = await db.scalar(select(EmployeeExpense).where(EmployeeExpense.id == expense_id, EmployeeExpense.tenant_id == tenant_id))
    if not expense: raise HTTPException(404, "المصروف غير موجود")
    if expense.status != "pending": raise HTTPException(400, "تمت مراجعة المصروف مسبقًا")
    expense.status = "approved" if approved else "rejected"; expense.approved_by = user_id; expense.approved_at = datetime.utcnow()
    if approved:
        from app.models.accounting import Account, FiscalYear, FiscalYearStatus, JournalEntry, JournalEntryLine, JournalEntryStatus
        from app.modules.accounting.service import get_operational_account, _next_entry_number
        expense_account = await get_operational_account(db, tenant_id, "operating_expenses")
        cash_account = await get_operational_account(db, tenant_id, "default_cash")
        now = datetime.utcnow()
        fiscal = (await db.execute(select(FiscalYear).where(FiscalYear.tenant_id == tenant_id, FiscalYear.status == FiscalYearStatus.OPEN, FiscalYear.start_date <= now.date(), FiscalYear.end_date >= now.date()).order_by(FiscalYear.is_default.desc(), FiscalYear.start_date.desc()))).scalars().first()
        if not expense_account or not cash_account or not fiscal:
            raise HTTPException(409, "حساب المصروف أو الصندوق أو السنة المالية غير مهيأ")
        entry = JournalEntry(id=str(uuid.uuid4()), tenant_id=tenant_id, entry_number=await _next_entry_number(db, tenant_id), entry_date=now, fiscal_year_id=fiscal.id, description_ar=f"مصروف موظف - {expense.category}", description_en=f"Employee expense - {expense.category}", status=JournalEntryStatus.POSTED, source="hr_employee_expense", reference=expense.id, total_debit=expense.amount, total_credit=expense.amount, created_by=user_id, posted_by=user_id, posted_at=now)
        db.add(entry)
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=expense_account.id, description=f"مصروف موظف {expense.category}", debit=expense.amount, credit=0, line_order=0))
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=cash_account.id, description="دفع مصروف موظف من الصندوق", debit=0, credit=expense.amount, line_order=1))
        expense.journal_entry_id = entry.id
    await db.commit(); await db.refresh(expense); return expense

async def get_employee_profile(db, tenant_id, employee_id):
    employee = await db.scalar(select(Employee).where(Employee.id == employee_id, Employee.tenant_id == tenant_id).options(selectinload(Employee.department)))
    if not employee: raise HTTPException(404, "الموظف غير موجود")
    payroll = (await db.execute(select(PayrollRecord).where(PayrollRecord.tenant_id == tenant_id, PayrollRecord.employee_id == employee_id).order_by(PayrollRecord.year.desc(), PayrollRecord.month.desc()).limit(24))).scalars().all()
    leaves = (await db.execute(select(LeaveRequest).where(LeaveRequest.tenant_id == tenant_id, LeaveRequest.employee_id == employee_id).order_by(LeaveRequest.created_at.desc()))).scalars().all()
    expenses = await get_employee_expenses(db, tenant_id, employee_id=employee_id)
    advances = (await db.execute(select(EmployeeAdvance).where(EmployeeAdvance.tenant_id == tenant_id, EmployeeAdvance.employee_id == employee_id))).scalars().all()
    return {"employee": employee, "payroll": payroll, "leaves": leaves, "expenses": expenses, "advances": advances}

async def get_hr_financial_report(db, tenant_id, month, year):
    rows = (await db.execute(select(PayrollRecord).where(PayrollRecord.tenant_id == tenant_id, PayrollRecord.month == month, PayrollRecord.year == year).options(selectinload(PayrollRecord.employee)))).scalars().all()
    expenses = await get_employee_expenses(db, tenant_id, status="approved")
    expenses = [x for x in expenses if x.expense_date.year == year and x.expense_date.month == month]
    return {"month": month, "year": year, "payroll": [{"employee": x.employee.full_name_ar if x.employee else x.employee_id, "gross": float(x.gross_salary), "deductions": float(x.total_deductions), "net": float(x.net_salary)} for x in rows], "totals": {"gross": float(sum((x.gross_salary for x in rows), Decimal(0))), "deductions": float(sum((x.total_deductions for x in rows), Decimal(0))), "net": float(sum((x.net_salary for x in rows), Decimal(0))), "approved_expenses": float(sum((x.amount for x in expenses), Decimal(0)))}}

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
