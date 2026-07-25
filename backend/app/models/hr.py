"""
موديل الموارد البشرية
يشمل: الموظفين، الأقسام، الحضور، الإجازات، الرواتب، GOSI
"""
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Date, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from decimal import Decimal
import enum
from app.core.database import Base


# ─── Enums ───────────────────────────────────────────────────────────

class EmployeeStatus(str, enum.Enum):
    ACTIVE     = "active"
    INACTIVE   = "inactive"
    TERMINATED = "terminated"
    ON_LEAVE   = "on_leave"


class Gender(str, enum.Enum):
    MALE   = "male"
    FEMALE = "female"


class ContractType(str, enum.Enum):
    FULL_TIME  = "full_time"
    PART_TIME  = "part_time"
    CONTRACT   = "contract"
    TEMPORARY  = "temporary"


class AttendanceStatus(str, enum.Enum):
    PRESENT = "present"
    ABSENT  = "absent"
    LATE    = "late"
    LEAVE   = "leave"


class LeaveType(str, enum.Enum):
    ANNUAL    = "annual"
    SICK      = "sick"
    EMERGENCY = "emergency"
    MATERNITY = "maternity"
    UNPAID    = "unpaid"


class LeaveStatus(str, enum.Enum):
    PENDING  = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PayrollStatus(str, enum.Enum):
    DRAFT   = "draft"
    PENDING = "pending"
    PAID    = "paid"


# ─── Department (الأقسام) ─────────────────────────────────────────────
class Department(Base):
    __tablename__ = "hr_departments"

    id:         Mapped[str]           = mapped_column(String, primary_key=True)
    tenant_id:  Mapped[str]           = mapped_column(String, ForeignKey("tenants.id"), index=True)
    name_ar:    Mapped[str]           = mapped_column(String(200))
    name_en:    Mapped[str | None]    = mapped_column(String(200), nullable=True)
    manager_id: Mapped[str | None]    = mapped_column(String, ForeignKey("hr_employees.id"), nullable=True)
    budget:     Mapped[Decimal]       = mapped_column(Numeric(18, 2), default=Decimal("0"))
    is_active:  Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)

    employees:  Mapped[list["Employee"]] = relationship(
        "Employee", back_populates="department",
        foreign_keys="Employee.department_id"
    )


# ─── Employee (الموظفون) ──────────────────────────────────────────────
class Employee(Base):
    __tablename__ = "hr_employees"

    id:              Mapped[str]           = mapped_column(String, primary_key=True)
    tenant_id:       Mapped[str]           = mapped_column(String, ForeignKey("tenants.id"), index=True)
    employee_number: Mapped[str]           = mapped_column(String(50), index=True)
    department_id:   Mapped[str | None]    = mapped_column(String, ForeignKey("hr_departments.id"), nullable=True)
    user_id:         Mapped[str | None]    = mapped_column(String, ForeignKey("users.id"), nullable=True)

    # البيانات الشخصية
    full_name_ar:    Mapped[str]           = mapped_column(String(300))
    full_name_en:    Mapped[str | None]    = mapped_column(String(300), nullable=True)
    national_id:     Mapped[str | None]    = mapped_column(String(20), nullable=True)
    gender:          Mapped[Gender]        = mapped_column(String(10), default="male")
    birth_date:      Mapped[date | None]   = mapped_column(Date, nullable=True)
    nationality:     Mapped[str]           = mapped_column(String(50), default="SA")
    phone:           Mapped[str | None]    = mapped_column(String(20), nullable=True)
    email:           Mapped[str | None]    = mapped_column(String(200), nullable=True)

    # بيانات الوظيفة
    job_title_ar:    Mapped[str]           = mapped_column(String(200))
    job_title_en:    Mapped[str | None]    = mapped_column(String(200), nullable=True)
    contract_type:   Mapped[ContractType]  = mapped_column(String(20), default="full_time")
    hire_date:       Mapped[date]          = mapped_column(Date)
    end_date:        Mapped[date | None]   = mapped_column(Date, nullable=True)
    status:          Mapped[EmployeeStatus] = mapped_column(String(20), default="active")

    # الراتب
    basic_salary:    Mapped[Decimal]       = mapped_column(Numeric(18, 2), default=Decimal("0"))
    housing_allowance: Mapped[Decimal]     = mapped_column(Numeric(18, 2), default=Decimal("0"))
    transport_allowance: Mapped[Decimal]   = mapped_column(Numeric(18, 2), default=Decimal("0"))
    other_allowances: Mapped[Decimal]      = mapped_column(Numeric(18, 2), default=Decimal("0"))

    # GOSI
    gosi_eligible:   Mapped[bool]          = mapped_column(Boolean, default=True)
    gosi_number:     Mapped[str | None]    = mapped_column(String(50), nullable=True)

    # الإجازة السنوية
    annual_leave_days: Mapped[int]         = mapped_column(Integer, default=21)
    leave_balance:   Mapped[Decimal]       = mapped_column(Numeric(8, 2), default=Decimal("21"))

    notes:           Mapped[str | None]    = mapped_column(Text, nullable=True)
    is_active:       Mapped[bool]          = mapped_column(Boolean, default=True)
    created_at:      Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:      Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)

    department:      Mapped["Department | None"] = relationship(
        "Department", back_populates="employees",
        foreign_keys=[department_id]
    )
    attendance_records: Mapped[list["AttendanceRecord"]] = relationship(
        "AttendanceRecord", back_populates="employee", cascade="all, delete-orphan"
    )
    leave_requests:  Mapped[list["LeaveRequest"]] = relationship(
        "LeaveRequest", back_populates="employee", cascade="all, delete-orphan"
    )
    payroll_records: Mapped[list["PayrollRecord"]] = relationship(
        "PayrollRecord", back_populates="employee", cascade="all, delete-orphan"
    )


# ─── AttendanceRecord (الحضور والانصراف) ─────────────────────────────
class AttendanceRecord(Base):
    __tablename__ = "hr_attendance"

    id:          Mapped[str]                = mapped_column(String, primary_key=True)
    tenant_id:   Mapped[str]                = mapped_column(String, ForeignKey("tenants.id"), index=True)
    employee_id: Mapped[str]                = mapped_column(String, ForeignKey("hr_employees.id"), index=True)
    date:        Mapped[date]               = mapped_column(Date, index=True)
    check_in:    Mapped[datetime | None]    = mapped_column(DateTime, nullable=True)
    check_out:   Mapped[datetime | None]    = mapped_column(DateTime, nullable=True)
    status:      Mapped[AttendanceStatus]   = mapped_column(String(20), default="present")
    notes:       Mapped[str | None]         = mapped_column(Text, nullable=True)
    created_at:  Mapped[datetime]           = mapped_column(DateTime, default=datetime.utcnow)

    employee:    Mapped["Employee"] = relationship("Employee", back_populates="attendance_records")


# ─── LeaveRequest (طلبات الإجازة) ────────────────────────────────────
class LeaveRequest(Base):
    __tablename__ = "hr_leave_requests"

    id:           Mapped[str]          = mapped_column(String, primary_key=True)
    tenant_id:    Mapped[str]          = mapped_column(String, ForeignKey("tenants.id"), index=True)
    employee_id:  Mapped[str]          = mapped_column(String, ForeignKey("hr_employees.id"), index=True)
    leave_type:   Mapped[LeaveType]    = mapped_column(String(20))
    from_date:    Mapped[date]         = mapped_column(Date)
    to_date:      Mapped[date]         = mapped_column(Date)
    days:         Mapped[int]          = mapped_column(Integer)
    reason:       Mapped[str | None]   = mapped_column(Text, nullable=True)
    status:       Mapped[LeaveStatus]  = mapped_column(String(20), default="pending")
    approved_by:  Mapped[str | None]   = mapped_column(String, ForeignKey("users.id"), nullable=True)
    approved_at:  Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at:   Mapped[datetime]     = mapped_column(DateTime, default=datetime.utcnow)

    employee:     Mapped["Employee"] = relationship("Employee", back_populates="leave_requests")


# ─── PayrollRecord (مسير الرواتب) ────────────────────────────────────
class PayrollRecord(Base):
    __tablename__ = "hr_payroll"

    id:                Mapped[str]          = mapped_column(String, primary_key=True)
    tenant_id:         Mapped[str]          = mapped_column(String, ForeignKey("tenants.id"), index=True)
    employee_id:       Mapped[str]          = mapped_column(String, ForeignKey("hr_employees.id"), index=True)
    month:             Mapped[int]          = mapped_column(Integer)   # 1-12
    year:              Mapped[int]          = mapped_column(Integer)

    # المكونات
    basic_salary:      Mapped[Decimal]      = mapped_column(Numeric(18, 2))
    housing_allowance: Mapped[Decimal]      = mapped_column(Numeric(18, 2), default=Decimal("0"))
    transport_allowance: Mapped[Decimal]    = mapped_column(Numeric(18, 2), default=Decimal("0"))
    other_allowances:  Mapped[Decimal]      = mapped_column(Numeric(18, 2), default=Decimal("0"))
    overtime_amount:   Mapped[Decimal]      = mapped_column(Numeric(18, 2), default=Decimal("0"))

    # الخصومات
    gosi_employee:     Mapped[Decimal]      = mapped_column(Numeric(18, 2), default=Decimal("0"))
    absence_deduction: Mapped[Decimal]      = mapped_column(Numeric(18, 2), default=Decimal("0"))
    other_deductions:  Mapped[Decimal]      = mapped_column(Numeric(18, 2), default=Decimal("0"))

    # الإجماليات
    gross_salary:      Mapped[Decimal]      = mapped_column(Numeric(18, 2))
    total_deductions:  Mapped[Decimal]      = mapped_column(Numeric(18, 2))
    net_salary:        Mapped[Decimal]      = mapped_column(Numeric(18, 2))

    # GOSI صاحب العمل
    gosi_employer:     Mapped[Decimal]      = mapped_column(Numeric(18, 2), default=Decimal("0"))

    status:            Mapped[PayrollStatus] = mapped_column(String(20), default="draft")
    journal_entry_id:  Mapped[str | None]   = mapped_column(String, nullable=True)
    notes:             Mapped[str | None]   = mapped_column(Text, nullable=True)
    created_by:        Mapped[str | None]   = mapped_column(String, ForeignKey("users.id"), nullable=True)
    created_at:        Mapped[datetime]     = mapped_column(DateTime, default=datetime.utcnow)

    employee:          Mapped["Employee"] = relationship("Employee", back_populates="payroll_records")
