"""نماذج دورة الصيانة الجديدة المستقلة عن نظام POS القديم."""
from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Date, DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class MaintenanceCase(Base):
    __tablename__ = "maintenance_cases"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    case_number: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(String(40), default="received", index=True)
    source: Mapped[str] = mapped_column(String(30), default="management")
    terminal_id: Mapped[str | None] = mapped_column(String, ForeignKey("pos_terminals.id"), nullable=True, index=True)
    customer_id: Mapped[str | None] = mapped_column(String, ForeignKey("customers.id"), nullable=True, index=True)
    rep_id: Mapped[str | None] = mapped_column(String, ForeignKey("sales_reps.id"), nullable=True, index=True)
    device_name: Mapped[str] = mapped_column(String(300))
    device_model: Mapped[str | None] = mapped_column(String(200), nullable=True)
    device_serial: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_name: Mapped[str] = mapped_column(String(200))
    customer_phone: Mapped[str] = mapped_column(String(50))
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    reported_problem: Mapped[str] = mapped_column(Text)
    device_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    received_accessories: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_urls_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    received_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    __table_args__ = (Index("ix_maintenance_cases_tenant_status_created", "tenant_id", "status", "created_at"),)


class MaintenanceCaseStatusLog(Base):
    __tablename__ = "maintenance_case_status_logs"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    case_id: Mapped[str] = mapped_column(String, ForeignKey("maintenance_cases.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_status: Mapped[str] = mapped_column(String(40))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    __table_args__ = (Index("ix_maintenance_case_status_logs_case_created", "case_id", "created_at"),)


class MaintenanceInspection(Base):
    __tablename__ = "maintenance_inspections"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    case_id: Mapped[str] = mapped_column(String, ForeignKey("maintenance_cases.id", ondelete="CASCADE"), unique=True, index=True)
    diagnosis: Mapped[str] = mapped_column(Text)
    failure_cause: Mapped[str | None] = mapped_column(Text, nullable=True)
    repair_required: Mapped[str | None] = mapped_column(Text, nullable=True)
    warranty_status: Mapped[str] = mapped_column(String(30), default="unknown")
    cost_responsibility: Mapped[str] = mapped_column(String(30), default="customer")
    labor_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    expected_days: Mapped[int | None] = mapped_column(nullable=True)
    customer_approval: Mapped[str] = mapped_column(String(30), default="pending")
    customer_approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class MaintenanceInspectionPart(Base):
    __tablename__ = "maintenance_inspection_parts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    inspection_id: Mapped[str] = mapped_column(String, ForeignKey("maintenance_inspections.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(String, ForeignKey("inventory_items.id"), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    warehouse_id: Mapped[str | None] = mapped_column(String, ForeignKey("warehouses.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="requested")
    issued_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    returned_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    returned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class MaintenanceBilling(Base):
    __tablename__ = "maintenance_billings"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    case_id: Mapped[str] = mapped_column(String, ForeignKey("maintenance_cases.id", ondelete="CASCADE"), unique=True, index=True)
    labor_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    parts_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)
    invoice_id: Mapped[str | None] = mapped_column(String, ForeignKey("invoices.id"), nullable=True, index=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
