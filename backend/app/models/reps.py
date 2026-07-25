"""
نموذج المناديب (Sales Representatives)
كل مندوب = مستخدم بدور sales_rep + مستودع خاص مرتبط به
"""
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Text, Date
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
