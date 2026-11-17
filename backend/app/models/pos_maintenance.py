"""صيانة نقاط البيع المعزولة عن فواتير ومبيعات POS."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class POSMaintenanceTicket(Base):
    __tablename__ = "pos_maintenance_tickets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    terminal_id: Mapped[str] = mapped_column(String, ForeignKey("pos_terminals.id"), index=True)
    session_id: Mapped[str | None] = mapped_column(String, ForeignKey("pos_sessions.id"), nullable=True, index=True)
    maintenance_warehouse_id: Mapped[str] = mapped_column(String, ForeignKey("warehouses.id"), index=True)
    ticket_number: Mapped[str] = mapped_column(String(50), index=True)
    status: Mapped[str] = mapped_column(String(30), default="open", index=True)
    customer_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    device_name: Mapped[str] = mapped_column(String(300))
    device_serial: Mapped[str | None] = mapped_column(String(200), nullable=True)
    reported_problem: Mapped[str] = mapped_column(Text)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    approved_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_pos_maintenance_tenant_status_created", "tenant_id", "status", "created_at"),
    )


class POSMaintenancePart(Base):
    __tablename__ = "pos_maintenance_parts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    ticket_id: Mapped[str] = mapped_column(String, ForeignKey("pos_maintenance_tickets.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[str] = mapped_column(String, ForeignKey("inventory_items.id"), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("1"))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    serial_item_id: Mapped[str | None] = mapped_column(String, ForeignKey("serial_items.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="planned")
    stock_document_id: Mapped[str | None] = mapped_column(String, nullable=True)
    issued_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
