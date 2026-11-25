

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
