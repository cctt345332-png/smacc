from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Enum as SAEnum, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from decimal import Decimal
import enum
from app.core.database import Base


class CustomerType(str, enum.Enum):
    INDIVIDUAL = "individual"   # فرد
    COMPANY = "company"         # شركة
    GOVERNMENT = "government"   # جهة حكومية


class InvoiceType(str, enum.Enum):
    STANDARD = "standard"       # فاتورة ضريبية كاملة (B2B)
    SIMPLIFIED = "simplified"   # فاتورة ضريبية مبسطة (B2C)


class InvoiceStatus(str, enum.Enum):
    DRAFT = "draft"             # مسودة — المندوب يعمل عليها
    SUBMITTED = "submitted"     # قدّمها المندوب للمحاسب
    APPROVED = "approved"       # المحاسب وافق عليها
    REJECTED = "rejected"       # المحاسب ردّها مع سبب
    CONFIRMED = "confirmed"     # مؤكدة رسمياً — تخصم المخزون
    SENT = "sent"               # مرسلة للعميل
    PAID = "paid"               # مدفوعة بالكامل
    PARTIAL = "partial"         # مدفوعة جزئياً
    OVERDUE = "overdue"         # متأخرة
    CANCELLED = "cancelled"     # ملغاة
    ZATCA_PENDING = "zatca_pending"
    ZATCA_CLEARED = "zatca_cleared"
    ZATCA_REJECTED = "zatca_rejected"


class QuotationStatus(str, enum.Enum):
    DRAFT = "draft"
    SENT = "sent"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXPIRED = "expired"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    CHEQUE = "cheque"
    CREDIT_CARD = "credit_card"
    MADA = "mada"
    STC_PAY = "stc_pay"


class InvoicePaymentMethod(str, enum.Enum):
    """طريقة الدفع على مستوى الفاتورة (مختلفة عن Payment)"""
    CASH = "cash"         # نقد فوري
    CREDIT = "credit"     # آجل
    CHEQUE = "cheque"     # شيك
    TRANSFER = "transfer" # تحويل بنكي


# ─── Customer ────────────────────────────────────────────────────────
class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    customer_number: Mapped[str] = mapped_column(String(50), index=True)
    customer_type: Mapped[CustomerType] = mapped_column(SAEnum(CustomerType), default=CustomerType.COMPANY)

    # بيانات أساسية
    name_ar: Mapped[str] = mapped_column(String(300))
    name_en: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # بيانات ضريبية — متطلبات زاتكا
    vat_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cr_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # بيانات إضافية للشركات
    owner_name: Mapped[str | None] = mapped_column(String(200), nullable=True)       # اسم المالك
    owner_national_id: Mapped[str | None] = mapped_column(String(20), nullable=True) # هوية المالك
    license_number: Mapped[str | None] = mapped_column(String(50), nullable=True)    # رقم الترخيص
    license_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True) # انتهاء الترخيص
    activity_type: Mapped[str | None] = mapped_column(String(200), nullable=True)    # النشاط التجاري

    # العنوان الوطني — متطلبات زاتكا
    address_street: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_building: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_postal: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address_additional: Mapped[str | None] = mapped_column(String(10), nullable=True) # الرمز الإضافي
    address_country: Mapped[str] = mapped_column(String(3), default="SA")

    # بيانات التواصل
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone2: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # ملفات مرفقة (base64 أو مسار)
    cr_document: Mapped[str | None] = mapped_column(Text, nullable=True)       # صورة السجل التجاري
    vat_document: Mapped[str | None] = mapped_column(Text, nullable=True)      # شهادة التسجيل الضريبي
    national_id_document: Mapped[str | None] = mapped_column(Text, nullable=True) # صورة الهوية
    license_document: Mapped[str | None] = mapped_column(Text, nullable=True)  # صورة الترخيص

    # إعدادات مالية
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    currency_code: Mapped[str] = mapped_column(String(3), default="SAR")
    ar_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ربط المندوب — من أنشأ هذا العميل
    rep_id: Mapped[str | None] = mapped_column(String, ForeignKey("sales_reps.id"), nullable=True, index=True)

    invoices: Mapped[list["Invoice"]] = relationship("Invoice", back_populates="customer")
    quotations: Mapped[list["Quotation"]] = relationship("Quotation", back_populates="customer")


# ─── Quotation (عرض سعر) ─────────────────────────────────────────────
class Quotation(Base):
    __tablename__ = "quotations"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    quotation_number: Mapped[str] = mapped_column(String(50), index=True)
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"))
    status: Mapped[QuotationStatus] = mapped_column(SAEnum(QuotationStatus), default=QuotationStatus.DRAFT)
    issue_date: Mapped[datetime] = mapped_column(DateTime)
    expiry_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    subject: Mapped[str | None] = mapped_column(String(300), nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="quotations")
    lines: Mapped[list["QuotationLine"]] = relationship("QuotationLine", back_populates="quotation", cascade="all, delete-orphan")


class QuotationLine(Base):
    __tablename__ = "quotation_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    quotation_id: Mapped[str] = mapped_column(String, ForeignKey("quotations.id"), index=True)
    line_order: Mapped[int] = mapped_column(Integer, default=0)
    description_ar: Mapped[str] = mapped_column(String(500))
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=15)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    quotation: Mapped["Quotation"] = relationship("Quotation", back_populates="lines")


# ─── Invoice (فاتورة ضريبية) ─────────────────────────────────────────
class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)

    # تسلسل الفاتورة — متطلب زاتكا
    invoice_number: Mapped[str] = mapped_column(String(50), index=True)  # رقم تسلسلي فريد
    uuid: Mapped[str] = mapped_column(String(36), unique=True)           # UUID — متطلب زاتكا

    # نوع الفاتورة — متطلب زاتكا
    invoice_type: Mapped[InvoiceType] = mapped_column(SAEnum(InvoiceType, values_callable=lambda x: [e.value for e in x]), default=InvoiceType.STANDARD)
    status: Mapped[InvoiceStatus] = mapped_column(SAEnum(InvoiceStatus, values_callable=lambda x: [e.value for e in x]), default=InvoiceStatus.DRAFT)

    # العميل
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"))

    # التواريخ — متطلب زاتكا
    issue_date: Mapped[datetime] = mapped_column(DateTime)        # تاريخ الإصدار
    supply_date: Mapped[datetime] = mapped_column(DateTime)       # تاريخ التوريد
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # تاريخ الاستحقاق

    # بيانات البائع (snapshot) — متطلب زاتكا
    seller_name_ar: Mapped[str] = mapped_column(String(300))
    seller_vat_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    seller_cr_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    seller_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # بيانات المشتري (snapshot) — متطلب زاتكا
    buyer_name_ar: Mapped[str] = mapped_column(String(300))
    buyer_vat_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    buyer_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # المبالغ — متطلب زاتكا
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)       # المبلغ قبل الضريبة
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0) # الخصم
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)  # الوعاء الضريبي
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)      # مبلغ الضريبة
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)           # الإجمالي شامل الضريبة
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)     # المدفوع
    currency_code: Mapped[str] = mapped_column(String(3), default="SAR")

    # QR Code — متطلب زاتكا
    qr_code: Mapped[str | None] = mapped_column(Text, nullable=True)

    # زاتكا
    zatca_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    zatca_response: Mapped[str | None] = mapped_column(Text, nullable=True)
    zatca_cleared_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # مرجع
    quotation_id: Mapped[str | None] = mapped_column(String, ForeignKey("quotations.id"), nullable=True)
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)
    fiscal_year_id: Mapped[str | None] = mapped_column(String, ForeignKey("fiscal_years.id"), nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    rep_id: Mapped[str | None] = mapped_column(String, ForeignKey("sales_reps.id"), nullable=True, index=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ── Workflow المناديب ────────────────────────────────────────────
    invoice_payment_method: Mapped[str | None] = mapped_column(
        SAEnum(InvoicePaymentMethod, values_callable=lambda x: [e.value for e in x]),
        nullable=True
    )
    credit_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cheque_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cheque_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    rejection_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="invoices")
    lines: Mapped[list["InvoiceLine"]] = relationship("InvoiceLine", back_populates="invoice", cascade="all, delete-orphan")
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")

class InvoiceLine(Base):
    __tablename__ = "invoice_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    invoice_id: Mapped[str] = mapped_column(String, ForeignKey("invoices.id"), index=True)
    line_order: Mapped[int] = mapped_column(Integer, default=0)
    description_ar: Mapped[str] = mapped_column(String(500))      # الوصف بالعربي — إلزامي
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=1)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)  # وحدة القياس
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=15)   # نسبة الضريبة
    vat_category: Mapped[str] = mapped_column(String(10), default="S")     # S=Standard, Z=Zero, E=Exempt
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)   # قبل الضريبة
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0) # مبلغ الضريبة
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)      # شامل الضريبة

    # ── ربط المخزون ──────────────────────────────────────────────────
    inventory_item_id: Mapped[str | None] = mapped_column(String, nullable=True)  # FK → inventory_items
    serial_item_id: Mapped[str | None] = mapped_column(String, nullable=True)     # FK → serial_items (للسيريال الواحد - legacy)
    serial_ids_json: Mapped[str | None] = mapped_column(Text, nullable=True)      # JSON list of serial IDs للسيريالات المتعددة
    variant_id: Mapped[str | None] = mapped_column(String, nullable=True)         # FK → product_variants (للملابس)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="lines")


# ─── Payment (سند قبض) ───────────────────────────────────────────────
class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    payment_number: Mapped[str] = mapped_column(String(50), index=True)
    invoice_id: Mapped[str] = mapped_column(String, ForeignKey("invoices.id"))
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"))
    payment_date: Mapped[datetime] = mapped_column(DateTime)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    payment_method: Mapped[PaymentMethod] = mapped_column(SAEnum(PaymentMethod))
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)  # رقم الشيك / التحويل
    bank_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)
    rep_id: Mapped[str | None] = mapped_column(String, ForeignKey("sales_reps.id"), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")


# ─── Credit Note (إشعار دائن) ────────────────────────────────────────
class CreditNote(Base):
    __tablename__ = "credit_notes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    credit_note_number: Mapped[str] = mapped_column(String(50), index=True)
    uuid: Mapped[str] = mapped_column(String(36), unique=True)
    original_invoice_id: Mapped[str] = mapped_column(String, ForeignKey("invoices.id"))
    customer_id: Mapped[str] = mapped_column(String, ForeignKey("customers.id"))
    issue_date: Mapped[datetime] = mapped_column(DateTime)
    reason: Mapped[str] = mapped_column(String(500))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    qr_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    zatca_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lines: Mapped[list["CreditNoteLine"]] = relationship("CreditNoteLine", back_populates="credit_note", cascade="all, delete-orphan")


class CreditNoteLine(Base):
    __tablename__ = "credit_note_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    credit_note_id: Mapped[str] = mapped_column(String, ForeignKey("credit_notes.id"), index=True)
    line_order: Mapped[int] = mapped_column(Integer, default=0)
    description_ar: Mapped[str] = mapped_column(String(500))
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=15)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    credit_note: Mapped["CreditNote"] = relationship("CreditNote", back_populates="lines")
