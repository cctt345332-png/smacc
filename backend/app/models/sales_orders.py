from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
import enum
from app.core.database import Base


class SalesOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PARTIALLY_DELIVERED = "partially_delivered"
    DELIVERED = "delivered"
    INVOICED = "invoiced"
    CANCELLED = "cancelled"


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    order_number: Mapped[str] = mapped_column(String(50), index=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"))
    status: Mapped[SalesOrderStatus] = mapped_column(SAEnum(SalesOrderStatus), default=SalesOrderStatus.DRAFT)
    order_date: Mapped[datetime] = mapped_column(DateTime)
    delivery_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    quotation_id: Mapped[str | None] = mapped_column(String, ForeignKey("quotations.id"), nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lines: Mapped[list["SalesOrderLine"]] = relationship("SalesOrderLine", back_populates="order", cascade="all, delete-orphan")


class SalesOrderLine(Base):
    __tablename__ = "sales_order_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    order_id: Mapped[str] = mapped_column(String, ForeignKey("sales_orders.id"), index=True)
    line_order: Mapped[int] = mapped_column(Integer, default=0)
    description_ar: Mapped[str] = mapped_column(String(500))
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=1)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=15)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    delivered_qty: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=0)

    order: Mapped["SalesOrder"] = relationship("SalesOrder", back_populates="lines")
