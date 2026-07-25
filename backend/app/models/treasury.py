from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
import enum
from app.core.database import Base
# نستخدم PaymentMethod من موديول المبيعات لتجنب تكرار الـ enum في PostgreSQL
from app.models.sales import PaymentMethod


class VoucherType(str, enum.Enum):
    RECEIPT = "receipt"
    PAYMENT = "payment"
    EXPENSE = "expense"
    TRANSFER = "transfer"


class VoucherStatus(str, enum.Enum):
    DRAFT = "draft"
    POSTED = "posted"
    CANCELLED = "cancelled"


class ExpenseCategory(str, enum.Enum):
    RENT = "rent"                   # إيجار
    UTILITIES = "utilities"         # كهرباء وماء
    SALARIES = "salaries"           # رواتب
    MAINTENANCE = "maintenance"     # صيانة
    TRANSPORT = "transport"         # مواصلات
    MARKETING = "marketing"         # تسويق
    OFFICE = "office"               # مستلزمات مكتبية
    INSURANCE = "insurance"         # تأمين
    GOVERNMENT = "government"       # رسوم حكومية
    OTHER = "other"                 # أخرى


class Voucher(Base):
    """سند قبض / صرف / مصروف / تحويل"""
    __tablename__ = "vouchers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    voucher_number: Mapped[str] = mapped_column(String(50), index=True)
    voucher_type: Mapped[VoucherType] = mapped_column(SAEnum(VoucherType))
    status: Mapped[VoucherStatus] = mapped_column(SAEnum(VoucherStatus), default=VoucherStatus.DRAFT)

    # التاريخ والمبلغ
    voucher_date: Mapped[datetime] = mapped_column(DateTime)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    currency_code: Mapped[str] = mapped_column(String(3), default="SAR")

    # طريقة الدفع
    payment_method: Mapped[PaymentMethod] = mapped_column(SAEnum(PaymentMethod), default=PaymentMethod.CASH)
    bank_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("bank_accounts.id"), nullable=True)
    cheque_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cheque_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # الطرف الآخر (عميل / مورد / موظف / جهة)
    party_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # customer/vendor/employee/other
    party_id: Mapped[str | None] = mapped_column(String, nullable=True)
    party_name: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # الربط
    invoice_id: Mapped[str | None] = mapped_column(String, nullable=True)       # فاتورة مبيعات
    purchase_id: Mapped[str | None] = mapped_column(String, nullable=True)      # فاتورة مشتريات
    asset_id: Mapped[str | None] = mapped_column(String, ForeignKey("assets.id"), nullable=True)  # أصل ثابت

    # تصنيف المصروف
    expense_category: Mapped[ExpenseCategory | None] = mapped_column(SAEnum(ExpenseCategory), nullable=True)

    # الحسابات المحاسبية
    debit_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True)
    credit_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True)
    cost_center_id: Mapped[str | None] = mapped_column(String, ForeignKey("cost_centers.id"), nullable=True)
    fiscal_year_id: Mapped[str | None] = mapped_column(String, ForeignKey("fiscal_years.id"), nullable=True)

    # القيد المحاسبي
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # البيان
    description_ar: Mapped[str] = mapped_column(String(500))
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # ضريبة القيمة المضافة (للمصروفات)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_account_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # للتحويلات البنكية
    to_bank_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("bank_accounts.id"), nullable=True)

    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    posted_by: Mapped[str | None] = mapped_column(String, nullable=True)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
