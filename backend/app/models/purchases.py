from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
import enum
from app.core.database import Base


class VendorType(str, enum.Enum):
    COMPANY = "company"
    INDIVIDUAL = "individual"
    GOVERNMENT = "government"


class BillStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PAID = "paid"
    PARTIAL = "partial"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PurchaseOrderStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    PARTIALLY_RECEIVED = "partially_received"
    RECEIVED = "received"
    BILLED = "billed"
    CANCELLED = "cancelled"


class DebitNoteStatus(str, enum.Enum):
    DRAFT = "draft"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"


# ─── Vendor (مورد) ───────────────────────────────────────────────────
class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    vendor_number: Mapped[str] = mapped_column(String(50), index=True)
    vendor_type: Mapped[VendorType] = mapped_column(SAEnum(VendorType), default=VendorType.COMPANY)

    # بيانات أساسية
    name_ar: Mapped[str] = mapped_column(String(300))
    name_en: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # بيانات ضريبية — متطلبات زاتكا
    vat_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cr_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    national_id: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # العنوان الوطني — متطلبات زاتكا
    address_building: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_street: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_postal: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address_additional: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address_country: Mapped[str] = mapped_column(String(3), default="SA")

    # بيانات التواصل
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    phone2: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # إعدادات مالية
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    payment_terms_days: Mapped[int] = mapped_column(Integer, default=30)
    currency_code: Mapped[str] = mapped_column(String(3), default="SAR")
    ap_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True)  # حساب الدائنين

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bills: Mapped[list["Bill"]] = relationship("Bill", back_populates="vendor")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship("PurchaseOrder", back_populates="vendor")


# ─── Purchase Order (أمر شراء) ───────────────────────────────────────
class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    order_number: Mapped[str] = mapped_column(String(50), index=True)
    vendor_id: Mapped[str] = mapped_column(String, ForeignKey("vendors.id"))
    status: Mapped[PurchaseOrderStatus] = mapped_column(SAEnum(PurchaseOrderStatus), default=PurchaseOrderStatus.DRAFT)
    order_date: Mapped[datetime] = mapped_column(DateTime)
    expected_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="purchase_orders")
    lines: Mapped[list["PurchaseOrderLine"]] = relationship("PurchaseOrderLine", back_populates="order", cascade="all, delete-orphan")


class PurchaseOrderLine(Base):
    __tablename__ = "purchase_order_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    order_id: Mapped[str] = mapped_column(String, ForeignKey("purchase_orders.id"), index=True)
    line_order: Mapped[int] = mapped_column(Integer, default=0)
    description_ar: Mapped[str] = mapped_column(String(500))
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=1)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=15)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    received_qty: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=0)

    order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="lines")


# ─── Bill (فاتورة واردة من المورد) ───────────────────────────────────
class Bill(Base):
    __tablename__ = "bills"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    bill_number: Mapped[str] = mapped_column(String(50), index=True)  # رقمنا الداخلي
    vendor_invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)  # رقم فاتورة المورد
    vendor_id: Mapped[str] = mapped_column(String, ForeignKey("vendors.id"))
    status: Mapped[BillStatus] = mapped_column(SAEnum(BillStatus), default=BillStatus.DRAFT)

    # التواريخ
    bill_date: Mapped[datetime] = mapped_column(DateTime)       # تاريخ الفاتورة
    supply_date: Mapped[datetime] = mapped_column(DateTime)     # تاريخ التوريد
    due_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # بيانات المورد snapshot — متطلبات زاتكا
    vendor_name_ar: Mapped[str] = mapped_column(String(300))
    vendor_vat_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vendor_cr_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vendor_address: Mapped[str | None] = mapped_column(Text, nullable=True)

    # المبالغ
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    taxable_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    currency_code: Mapped[str] = mapped_column(String(3), default="SAR")

    # الربط
    purchase_order_id: Mapped[str | None] = mapped_column(String, ForeignKey("purchase_orders.id"), nullable=True)
    fiscal_year_id: Mapped[str | None] = mapped_column(String, ForeignKey("fiscal_years.id"), nullable=True)
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vendor: Mapped["Vendor"] = relationship("Vendor", back_populates="bills")
    lines: Mapped[list["BillLine"]] = relationship("BillLine", back_populates="bill", cascade="all, delete-orphan")
    payments: Mapped[list["BillPayment"]] = relationship("BillPayment", back_populates="bill", cascade="all, delete-orphan")


class BillLine(Base):
    __tablename__ = "bill_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    bill_id: Mapped[str] = mapped_column(String, ForeignKey("bills.id"), index=True)
    line_order: Mapped[int] = mapped_column(Integer, default=0)
    description_ar: Mapped[str] = mapped_column(String(500))
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=1)
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    discount_pct: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=15)
    vat_category: Mapped[str] = mapped_column(String(10), default="S")
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    # ── ربط المخزون ──────────────────────────────────────────────────
    inventory_item_id: Mapped[str | None] = mapped_column(String, nullable=True)
    serial_item_id: Mapped[str | None] = mapped_column(String, nullable=True)
    variant_id: Mapped[str | None] = mapped_column(String, nullable=True)         # FK → product_variants
    # سيريال جديد — طريقة قديمة (سيريال واحد)
    new_serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    new_serial_condition: Mapped[str | None] = mapped_column(String(20), nullable=True)
    new_serial_sale_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    # سيريالات جديدة جماعية — الطريقة الجديدة (JSON قائمة بأرقام السيريالات)
    new_serial_numbers_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # تشغيلة جديدة (للصيدلية فقط)
    batch_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    batch_expiry_date: Mapped[str | None] = mapped_column(String(20), nullable=True)

    bill: Mapped["Bill"] = relationship("Bill", back_populates="lines")


# ─── Bill Payment (دفعة للمورد) ──────────────────────────────────────
class BillPayment(Base):
    __tablename__ = "bill_payments"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    payment_number: Mapped[str] = mapped_column(String(50), index=True)
    bill_id: Mapped[str] = mapped_column(String, ForeignKey("bills.id"))
    vendor_id: Mapped[str] = mapped_column(String, ForeignKey("vendors.id"))
    payment_date: Mapped[datetime] = mapped_column(DateTime)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    payment_method: Mapped[str] = mapped_column(String(30), default="bank_transfer")
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bill: Mapped["Bill"] = relationship("Bill", back_populates="payments")


# ─── Debit Note (إشعار مدين) ─────────────────────────────────────────
class DebitNote(Base):
    __tablename__ = "debit_notes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    debit_note_number: Mapped[str] = mapped_column(String(50), index=True)
    original_bill_id: Mapped[str] = mapped_column(String, ForeignKey("bills.id"))
    vendor_id: Mapped[str] = mapped_column(String, ForeignKey("vendors.id"))
    status: Mapped[DebitNoteStatus] = mapped_column(SAEnum(DebitNoteStatus), default=DebitNoteStatus.DRAFT)
    issue_date: Mapped[datetime] = mapped_column(DateTime)
    reason: Mapped[str] = mapped_column(String(500))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    lines: Mapped[list["DebitNoteLine"]] = relationship("DebitNoteLine", back_populates="debit_note", cascade="all, delete-orphan")


class DebitNoteLine(Base):
    __tablename__ = "debit_note_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    debit_note_id: Mapped[str] = mapped_column(String, ForeignKey("debit_notes.id"), index=True)
    line_order: Mapped[int] = mapped_column(Integer, default=0)
    description_ar: Mapped[str] = mapped_column(String(500))
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=15)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    vat_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)

    # ربط المخزون (للسيريالات المُرجَعة)
    inventory_item_id: Mapped[str | None] = mapped_column(String, nullable=True)
    serial_ids_json: Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON: قائمة IDs سيريالات مُرجَعة

    debit_note: Mapped["DebitNote"] = relationship("DebitNote", back_populates="lines")
