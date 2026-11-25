"""النموذج الجديد لدورة الصيانة؛ لا يعتمد على نموذج POS القديم."""
from datetime import date, datetime
from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text
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
