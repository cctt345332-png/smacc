"""
موديل نقطة البيع (POS) — مبني من الصفر
متوافق مع جميع الأنشطة ومرتبط بها بشكل صحيح:
  - جوالات / قطع غيار  → سيريال + شراء من POS
  - صيدلية              → تشغيلة FEFO + تاريخ انتهاء
  - بقالة / عطارة       → كمية / وزن
  - ملابس               → متغيرات (مقاس / لون)
  - مواد بناء / عام     → كمية
"""
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
import enum
from app.core.database import Base


# ─── ثوابت الأنشطة ───────────────────────────────────────────────────

# جميع الأنشطة التي تدعم نقطة البيع
POS_SUPPORTED_ACTIVITIES = {
    "mobile_phones",   # جوالات — سيريال + شراء من POS
    "spare_parts",     # قطع غيار — سيريال + شراء من POS
    "pharmacy",        # صيدلية — تشغيلة FEFO + تاريخ انتهاء
    "grocery",         # بقالة — كمية عادية
    "spices",          # عطارة — وزن
    "clothing",        # ملابس — متغيرات (مقاس / لون)
    "construction",    # مواد بناء — كمية
    "general",         # عام
}

# الأنشطة التي تدعم الشراء المباشر من نقطة البيع
POS_PURCHASE_ACTIVITIES = {"mobile_phones", "spare_parts"}

# خصائص كل نشاط
ACTIVITY_CONFIG: dict[str, dict] = {
    "mobile_phones": {
        "label_ar": "جوالات وإلكترونيات",
        "tracking":  "serial",
        "allow_purchase": True,
        "icon": "mobile",
        "color": "#2563EB",
    },
    "spare_parts": {
        "label_ar": "قطع غيار",
        "tracking":  "serial",
        "allow_purchase": True,
        "icon": "spareParts",
        "color": "#7C3AED",
    },
    "pharmacy": {
        "label_ar": "صيدلية",
        "tracking":  "batch",
        "allow_purchase": False,
        "icon": "pharmacy",
        "color": "#059669",
    },
    "grocery": {
        "label_ar": "بقالة",
        "tracking":  "quantity",
        "allow_purchase": False,
        "icon": "grocery",
        "color": "#D97706",
    },
    "spices": {
        "label_ar": "عطارة وتوابل",
        "tracking":  "weight",
        "allow_purchase": False,
        "icon": "spices",
        "color": "#B45309",
    },
    "clothing": {
        "label_ar": "ملابس وأزياء",
        "tracking":  "variant",
        "allow_purchase": False,
        "icon": "clothing",
        "color": "#EC4899",
    },
    "construction": {
        "label_ar": "مواد بناء",
        "tracking":  "quantity",
        "allow_purchase": False,
        "icon": "construction",
        "color": "#64748B",
    },
    "general": {
        "label_ar": "عام",
        "tracking":  "quantity",
        "allow_purchase": False,
        "icon": "general",
        "color": "#0F172A",
    },
}


# ─── Enums ────────────────────────────────────────────────────────────

class POSSessionStatus(str, enum.Enum):
    OPEN   = "open"
    CLOSED = "closed"


class POSTransactionStatus(str, enum.Enum):
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REFUNDED  = "refunded"


class POSPaymentMethod(str, enum.Enum):
    CASH        = "cash"
    MADA        = "mada"
    CREDIT_CARD = "credit_card"
    STC_PAY     = "stc_pay"
    SPLIT       = "split"


# ─── POSTerminal ──────────────────────────────────────────────────────
class POSTerminal(Base):
    """
    جهاز نقطة البيع — مرتبط بنشاط محدد
    كل جهاز له نشاطه الخاص الذي يحدد:
      - طريقة تتبع المخزون
      - إمكانية الشراء من POS
      - الأصناف المتاحة للبيع
    """
    __tablename__ = "pos_terminals"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)

    name: Mapped[str] = mapped_column(String(200))
    branch_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # النشاط المرتبط بهذا الجهاز — يحدد سلوك الكاشير بالكامل
    business_type: Mapped[str] = mapped_column(String(50), default="general")

    # المستودع الافتراضي لهذا الجهاز
    warehouse_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("warehouses.id"), nullable=True
    )

    # المستخدم المخصص لهذا الجهاز (الكاشير)
    assigned_user_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id"), nullable=True, index=True
    )

    # الربط المحاسبي
    cash_account_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("accounts.id"), nullable=True
    )
    sales_account_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("accounts.id"), nullable=True
    )
    vat_account_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("accounts.id"), nullable=True
    )
    bank_account_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("bank_accounts.id"), nullable=True
    )
    fiscal_year_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("fiscal_years.id"), nullable=True
    )

    # إعدادات الإيصال
    receipt_header: Mapped[str | None] = mapped_column(Text, nullable=True)
    receipt_footer: Mapped[str | None] = mapped_column(Text, nullable=True)
    print_receipt: Mapped[bool] = mapped_column(Boolean, default=True)

    # إعدادات الخصم
    allow_discount: Mapped[bool] = mapped_column(Boolean, default=True)
    max_discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("10"))

    # الشراء من POS — يُفعَّل تلقائياً للجوالات وقطع الغيار
    allow_purchase: Mapped[bool] = mapped_column(Boolean, default=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["POSSession"]] = relationship(
        "POSSession", back_populates="terminal"
    )


# ─── POSSession ───────────────────────────────────────────────────────
class POSSession(Base):
    """جلسة الكاشير — من فتح الصندوق حتى إغلاقه"""
    __tablename__ = "pos_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    terminal_id: Mapped[str] = mapped_column(
        String, ForeignKey("pos_terminals.id"), index=True
    )
    cashier_id: Mapped[str] = mapped_column(String, ForeignKey("users.id"))

    # النقد
    opening_cash: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    closing_cash: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    expected_cash: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)

    # الإجماليات
    total_sales: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    total_cash: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    total_card: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    total_vat: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    transaction_count: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[str] = mapped_column(
        String(20), default="open"
    )
    opened_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    terminal: Mapped["POSTerminal"] = relationship(
        "POSTerminal", back_populates="sessions"
    )
    transactions: Mapped[list["POSTransaction"]] = relationship(
        "POSTransaction", back_populates="session"
    )


# ─── POSTransaction ───────────────────────────────────────────────────
class POSTransaction(Base):
    """عملية بيع واحدة في نقطة البيع"""
    __tablename__ = "pos_transactions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    session_id: Mapped[str] = mapped_column(
        String, ForeignKey("pos_sessions.id"), index=True
    )
    transaction_number: Mapped[str] = mapped_column(String(50), index=True)

    # الربط بالفاتورة والقيد
    invoice_id: Mapped[str | None] = mapped_column(String, nullable=True)
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # بيانات العميل
    customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    customer_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    customer_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # الإجماليات
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))

    # الدفع
    payment_method: Mapped[str] = mapped_column(
        String(20), default="cash"
    )
    cash_tendered: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    change_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    card_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)

    # زاتكا
    qr_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    uuid: Mapped[str | None] = mapped_column(String(36), nullable=True)

    status: Mapped[str] = mapped_column(
        String(20), default="completed"
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    session: Mapped["POSSession"] = relationship(
        "POSSession", back_populates="transactions"
    )
    lines: Mapped[list["POSTransactionLine"]] = relationship(
        "POSTransactionLine", back_populates="transaction", cascade="all, delete-orphan"
    )


# ─── POSTransactionLine ───────────────────────────────────────────────
class POSTransactionLine(Base):
    """
    سطر في عملية البيع — يحمل معلومات التتبع الكاملة:
      serial_item_id → للجوالات وقطع الغيار
      variant_id     → للملابس
      batch_id       → للصيدلية
    """
    __tablename__ = "pos_transaction_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    transaction_id: Mapped[str] = mapped_column(
        String, ForeignKey("pos_transactions.id"), index=True
    )

    inventory_item_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # معلومات المنتج (snapshot وقت البيع)
    product_name_ar: Mapped[str] = mapped_column(String(300))
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # حقول التتبع — حسب نوع النشاط
    serial_item_id: Mapped[str | None] = mapped_column(String, nullable=True)  # جوالات
    variant_id: Mapped[str | None] = mapped_column(String, nullable=True)      # ملابس
    batch_id: Mapped[str | None] = mapped_column(String, nullable=True)        # صيدلية

    # التسعير
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3))
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("0"))
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("15"))
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2))

    transaction: Mapped["POSTransaction"] = relationship(
        "POSTransaction", back_populates="lines"
    )
