"""
نموذج المناديب (Sales Representatives)
كل مندوب = مستخدم بدور sales_rep + مستودع خاص مرتبط به
"""
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Text, Date, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from decimal import Decimal
from app.core.database import Base


class SalesRep(Base):
    __tablename__ = "sales_reps"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)

    # ربط بالمستخدم
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True, index=True)

    # المستودع الخاص بالمندوب
    warehouse_id: Mapped[str] = mapped_column(String, ForeignKey("warehouses.id"), index=True)

    # بيانات أساسية
    rep_code: Mapped[str] = mapped_column(String(50), index=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    zone: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # بيانات الهوية
    id_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    id_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)
    license_expiry: Mapped[date | None] = mapped_column(Date, nullable=True)

    # بيانات السيارة
    vehicle_plate: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vehicle_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vehicle_color: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # الأهداف والعمولة
    target_monthly: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    commission_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RepAttendance(Base):
    """سجل حضور يومي للمندوب، مستقل عن حضور الموظفين وتتبع الموقع."""
    __tablename__ = "rep_attendance"
    __table_args__ = (
        UniqueConstraint("tenant_id", "rep_id", "attendance_date", name="uq_rep_attendance_daily"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    rep_id: Mapped[str] = mapped_column(String, ForeignKey("sales_reps.id"), index=True)
    attendance_date: Mapped[date] = mapped_column(Date, index=True)
    check_in_at: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(30), default="present")
    source: Mapped[str] = mapped_column(String(30), default="rep_dashboard")
    # موقع الحضور الفعلي، يُحفظ من طلب موقع جديد عند ضغط المندوب على تسجيل الحضور.
    check_in_latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    check_in_longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    check_in_accuracy: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RepGeoZone(Base):
    """حدود منطقة عمل المندوب؛ يدعم الدائرة أو المضلع من دون تغيير تتبع المواقع."""
    __tablename__ = "rep_geo_zones"
    __table_args__ = (
        UniqueConstraint("tenant_id", "rep_id", name="uq_rep_geo_zone_per_rep"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    rep_id: Mapped[str] = mapped_column(String, ForeignKey("sales_reps.id"), index=True)
    name: Mapped[str] = mapped_column(String(200), default="منطقة عمل المندوب")
    boundary_type: Mapped[str] = mapped_column(String(20), default="circle")  # circle | polygon
    center_latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    center_longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    radius_meters: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    polygon_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RepGeoEvent(Base):
    """حدث انتقال حقيقي إلى داخل/خارج منطقة العمل، يظهر في تفاصيل الرحلات."""
    __tablename__ = "rep_geo_events"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    rep_id: Mapped[str] = mapped_column(String, ForeignKey("sales_reps.id"), index=True)
    zone_id: Mapped[str] = mapped_column(String, ForeignKey("rep_geo_zones.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(20))  # entered | exited
    is_initial: Mapped[bool] = mapped_column(Boolean, default=False)
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    source_location_id: Mapped[str | None] = mapped_column(String, nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class RepLocation(Base):
    __tablename__ = "rep_locations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    rep_id: Mapped[str] = mapped_column(String, index=True)  # بدون FK — يخزن rep_id أو supervisor_id
    latitude: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    longitude: Mapped[Decimal] = mapped_column(Numeric(10, 7))
    accuracy: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    speed: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    heading: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    battery_level: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_moving: Mapped[bool] = mapped_column(Boolean, default=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─── Supervisor (مشرف المناديب) ──────────────────────────────────────
class Supervisor(Base):
    __tablename__ = "supervisors"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SupervisorRep(Base):
    """ربط المشرف بالمناديب — many-to-many"""
    __tablename__ = "supervisor_reps"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    supervisor_id: Mapped[str] = mapped_column(String, ForeignKey("supervisors.id"), index=True)
    rep_id: Mapped[str] = mapped_column(String, ForeignKey("sales_reps.id"), index=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
