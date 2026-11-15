from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, ForeignKey, DateTime, Numeric, Text, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class CustodySettlement(Base):
    """تسوية دورية لعهدة مندوب أو جهاز POS دون تعديل المبيعات أو المخزون."""
    __tablename__ = "custody_settlements"
    __table_args__ = (
        Index("ix_custody_settlements_source", "tenant_id", "source_type", "source_id"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    source_type: Mapped[str] = mapped_column(String(20), index=True)  # rep | pos
    source_id: Mapped[str] = mapped_column(String, index=True)
    period_from: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    period_to: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    settled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    expected_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    received_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    difference: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
