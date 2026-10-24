"""مركبات المناديب وسجل الصيانة الدورية."""
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class RepVehicle(Base):
    __tablename__ = "rep_vehicles"
    __table_args__ = (
        Index("ix_rep_vehicles_tenant_active", "tenant_id", "is_active"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    rep_id: Mapped[str] = mapped_column(String, ForeignKey("sales_reps.id"), unique=True, index=True)
    plate_number: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    vehicle_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    current_odometer: Mapped[int] = mapped_column(Integer, default=0)
    odometer_updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    oil_interval_km: Mapped[int] = mapped_column(Integer, default=5000)
    oil_interval_days: Mapped[int] = mapped_column(Integer, default=180)
    next_oil_due_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_oil_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VehicleMaintenanceRecord(Base):
    __tablename__ = "vehicle_maintenance_records"
    __table_args__ = (
        Index("ix_vehicle_maintenance_tenant_vehicle_date", "tenant_id", "vehicle_id", "service_date"),
    )
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    vehicle_id: Mapped[str] = mapped_column(String, ForeignKey("rep_vehicles.id", ondelete="CASCADE"), index=True)
    rep_id: Mapped[str] = mapped_column(String, ForeignKey("sales_reps.id"), index=True)
    service_type: Mapped[str] = mapped_column(String(50), default="oil_change")
    service_date: Mapped[date] = mapped_column(Date, default=date.today)
    odometer: Mapped[int] = mapped_column(Integer)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    oil_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vendor_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_due_km: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
