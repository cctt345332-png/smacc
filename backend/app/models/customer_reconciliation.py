from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, ForeignKey, DateTime, Numeric, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class CustomerBalanceReconciliation(Base):
    """مطابقة رصيد غير محاسبية تحفظ ما أقر به العميل دون تعديل الحركات الأصلية."""
    __tablename__ = "customer_balance_reconciliations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"), index=True)
    rep_id: Mapped[str | None] = mapped_column(String, ForeignKey("sales_reps.id"), nullable=True, index=True)
    reconciliation_date: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    from_date: Mapped[datetime] = mapped_column(DateTime)
    to_date: Mapped[datetime] = mapped_column(DateTime)
    system_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    acknowledged_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    difference: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    snapshot_json: Mapped[str] = mapped_column(Text, default="{}")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
