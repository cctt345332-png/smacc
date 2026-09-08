"""نماذج طلبات صيانة أجهزة الجوالات واستبدالها."""
from datetime import datetime
from decimal import Decimal
import enum

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MaintenanceStatus(str, enum.Enum):
    NEW = "new"
    RECEIVED = "received"
    INSPECTING = "inspecting"
    WAITING_CUSTOMER = "waiting_customer"
    IN_REPAIR = "in_repair"
    WAITING_PART = "waiting_part"
    READY = "ready"
    DELIVERED = "delivered"
    CLOSED = "closed"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class MaintenanceResolution(str, enum.Enum):
    REPAIRED = "repaired"
    REPLACED = "replaced"
    NO_REPAIR = "no_repair"
    INSPECTION_ONLY = "inspection_only"
    RETURNED_UNREPAIRED = "returned_unrepaired"


class LockType(str, enum.Enum):
    NONE = "none"
    SCREEN_PIN = "screen_pin"
    PASSWORD = "password"
    PATTERN = "pattern"
    USER_ACCOUNT = "user_account"
    OTHER = "other"


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    request_number: Mapped[str] = mapped_column(String(50), index=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), index=True)
    rep_id: Mapped[str | None] = mapped_column(String, ForeignKey("sales_reps.id"), nullable=True, index=True)
    invoice_id: Mapped[str | None] = mapped_column(String, ForeignKey("invoices.id"), nullable=True, index=True)
    product_id: Mapped[str | None] = mapped_column(String, ForeignKey("inventory_items.id"), nullable=True, index=True)
    serial_item_id: Mapped[str | None] = mapped_column(String, ForeignKey("serial_items.id"), nullable=True, index=True)

    status: Mapped[MaintenanceStatus] = mapped_column(
        SAEnum(MaintenanceStatus, values_callable=lambda x: [e.value for e in x]),
        default=MaintenanceStatus.NEW,
        index=True,
    )
    resolution: Mapped[MaintenanceResolution | None] = mapped_column(
        SAEnum(MaintenanceResolution, values_callable=lambda x: [e.value for e in x]), nullable=True
    )

    device_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    serial_number: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    imei_1: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    imei_2: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    reported_problem: Mapped[str] = mapped_column(Text)
    device_condition: Mapped[str | None] = mapped_column(Text, nullable=True)
    accessories_received: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachment_urls_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    lock_type: Mapped[LockType] = mapped_column(
        SAEnum(LockType, values_callable=lambda x: [e.value for e in x]), default=LockType.NONE
    )
    lock_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    lock_secret_provided: Mapped[bool] = mapped_column(Boolean, default=False)
    lock_secret_returned: Mapped[bool] = mapped_column(Boolean, default=False)

    inspection_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    repair_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    warranty_case: Mapped[bool] = mapped_column(Boolean, default=False)
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    approved_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))

    replacement_product_id: Mapped[str | None] = mapped_column(String, ForeignKey("inventory_items.id"), nullable=True)
    replacement_serial_item_id: Mapped[str | None] = mapped_column(String, ForeignKey("serial_items.id"), nullable=True)
    replacement_serial_number: Mapped[str | None] = mapped_column(String(200), nullable=True)
    replacement_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    replacement_approved: Mapped[bool] = mapped_column(Boolean, default=False)

    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    assigned_to: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_maintenance_tenant_status_created", "tenant_id", "status", "created_at"),
    )


class MaintenanceStatusLog(Base):
    __tablename__ = "maintenance_status_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    request_id: Mapped[str] = mapped_column(String, ForeignKey("maintenance_requests.id", ondelete="CASCADE"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    to_status: Mapped[str] = mapped_column(String(40))
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    changed_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
