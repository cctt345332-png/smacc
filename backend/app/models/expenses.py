"""نماذج مصاريف المناديب ومرفقاتها."""
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, ForeignKey, DateTime, Numeric, Text, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class RepExpense(Base):
    __tablename__ = "rep_expenses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    rep_id: Mapped[str | None] = mapped_column(String, ForeignKey("sales_reps.id"), nullable=True, index=True)
    supervisor_id: Mapped[str | None] = mapped_column(String, ForeignKey("supervisors.id"), nullable=True, index=True)
    expense_number: Mapped[str] = mapped_column(String(50), index=True)
    expense_date: Mapped[datetime] = mapped_column(DateTime, index=True)
    category: Mapped[str] = mapped_column(String(50), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    payment_method: Mapped[str] = mapped_column(String(40), default="rep_advance")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    journal_entry_id: Mapped[str | None] = mapped_column(String, ForeignKey("journal_entries.id"), nullable=True)
    submitted_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    approved_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    attachments: Mapped[list["RepExpenseAttachment"]] = relationship(
        "RepExpenseAttachment", back_populates="expense", cascade="all, delete-orphan"
    )


class RepExpenseAttachment(Base):
    __tablename__ = "rep_expense_attachments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    expense_id: Mapped[str] = mapped_column(String, ForeignKey("rep_expenses.id", ondelete="CASCADE"), index=True)
    file_name: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int] = mapped_column(Integer, default=0)
    file_data: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    expense: Mapped[RepExpense] = relationship("RepExpense", back_populates="attachments")
