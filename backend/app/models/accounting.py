from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
import enum
from app.core.database import Base


class AccountType(str, enum.Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class AccountNature(str, enum.Enum):
    DEBIT = "debit"
    CREDIT = "credit"


class JournalEntryStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    CANCELLED = "cancelled"


class FiscalYearStatus(str, enum.Enum):
    OPEN = "open"
    CLOSED = "closed"


# ─── Chart of Accounts ───────────────────────────────────────────────
class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    code: Mapped[str] = mapped_column(String(20))
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str] = mapped_column(String(200))
    account_type: Mapped[AccountType] = mapped_column(SAEnum(AccountType))
    nature: Mapped[AccountNature] = mapped_column(SAEnum(AccountNature))
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True)
    level: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_posting: Mapped[bool] = mapped_column(Boolean, default=True)  # can post entries
    allow_direct_posting: Mapped[bool] = mapped_column(Boolean, default=True)
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    children: Mapped[list["Account"]] = relationship("Account", back_populates="parent")
    parent: Mapped["Account | None"] = relationship("Account", back_populates="children", remote_side="Account.id")


# ─── Fiscal Year ─────────────────────────────────────────────────────
class FiscalYear(Base):
    __tablename__ = "fiscal_years"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[datetime] = mapped_column(DateTime)
    end_date: Mapped[datetime] = mapped_column(DateTime)
    status: Mapped[FiscalYearStatus] = mapped_column(SAEnum(FiscalYearStatus), default=FiscalYearStatus.OPEN)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─── Cost Center ─────────────────────────────────────────────────────
class CostCenter(Base):
    __tablename__ = "cost_centers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    code: Mapped[str] = mapped_column(String(20))
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str] = mapped_column(String(200))
    parent_id: Mapped[str | None] = mapped_column(String, ForeignKey("cost_centers.id"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─── Currency ────────────────────────────────────────────────────────
class Currency(Base):
    __tablename__ = "currencies"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    code: Mapped[str] = mapped_column(String(3))   # SAR, USD, EUR
    name_ar: Mapped[str] = mapped_column(String(100))
    name_en: Mapped[str] = mapped_column(String(100))
    symbol: Mapped[str] = mapped_column(String(5))
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=1)
    is_base: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─── Journal Entry ───────────────────────────────────────────────────
class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    entry_number: Mapped[str] = mapped_column(String(50), index=True)
    entry_date: Mapped[datetime] = mapped_column(DateTime)
    fiscal_year_id: Mapped[str] = mapped_column(String, ForeignKey("fiscal_years.id"))
    description_ar: Mapped[str] = mapped_column(String(500))
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[JournalEntryStatus] = mapped_column(SAEnum(JournalEntryStatus), default=JournalEntryStatus.DRAFT)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str | None] = mapped_column(String(50), nullable=True)  # manual, sales, purchase, etc.
    currency_id: Mapped[str | None] = mapped_column(String, ForeignKey("currencies.id"), nullable=True)
    exchange_rate: Mapped[Decimal] = mapped_column(Numeric(18, 6), default=1)
    total_debit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total_credit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    posted_by: Mapped[str | None] = mapped_column(String, nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lines: Mapped[list["JournalEntryLine"]] = relationship("JournalEntryLine", back_populates="entry", cascade="all, delete-orphan")


class JournalEntryLine(Base):
    __tablename__ = "journal_entry_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    entry_id: Mapped[str] = mapped_column(String, ForeignKey("journal_entries.id"), index=True)
    account_id: Mapped[str] = mapped_column(String, ForeignKey("accounts.id"))
    cost_center_id: Mapped[str | None] = mapped_column(String, ForeignKey("cost_centers.id"), nullable=True)
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    debit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    credit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    line_order: Mapped[int] = mapped_column(Integer, default=0)

    entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="lines")
    account: Mapped["Account"] = relationship("Account")


# ─── Bank Account ────────────────────────────────────────────────────
class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    bank_name: Mapped[str] = mapped_column(String(200))
    account_name: Mapped[str] = mapped_column(String(200))
    account_number: Mapped[str] = mapped_column(String(50))
    iban: Mapped[str | None] = mapped_column(String(34), nullable=True)
    currency_id: Mapped[str | None] = mapped_column(String, ForeignKey("currencies.id"), nullable=True)
    gl_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True)
    opening_balance: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# ─── Budget ──────────────────────────────────────────────────────────
class Budget(Base):
    __tablename__ = "budgets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    fiscal_year_id: Mapped[str] = mapped_column(String, ForeignKey("fiscal_years.id"))
    name: Mapped[str] = mapped_column(String(200))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lines: Mapped[list["BudgetLine"]] = relationship("BudgetLine", back_populates="budget", cascade="all, delete-orphan")


class BudgetLine(Base):
    __tablename__ = "budget_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    budget_id: Mapped[str] = mapped_column(String, ForeignKey("budgets.id"), index=True)
    account_id: Mapped[str] = mapped_column(String, ForeignKey("accounts.id"))
    cost_center_id: Mapped[str | None] = mapped_column(String, ForeignKey("cost_centers.id"), nullable=True)
    jan: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    feb: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    mar: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    apr: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    may: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    jun: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    jul: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    aug: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    sep: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    oct: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    nov: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    dec: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    budget: Mapped["Budget"] = relationship("Budget", back_populates="lines")


# ─── VAT Settings (Saudi) ────────────────────────────────────────────
class VATSetting(Base):
    __tablename__ = "vat_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), unique=True)
    vat_number: Mapped[str | None] = mapped_column(String(20), nullable=True)   # الرقم الضريبي
    cr_number: Mapped[str | None] = mapped_column(String(20), nullable=True)    # السجل التجاري
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=15)        # 15%
    vat_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True)
    vat_receivable_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    zatca_env: Mapped[str] = mapped_column(String(20), default="sandbox")       # sandbox / production
    zatca_cert: Mapped[str | None] = mapped_column(Text, nullable=True)
    zatca_private_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_zatca_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
