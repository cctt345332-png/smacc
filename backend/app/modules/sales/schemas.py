from pydantic import BaseModel, EmailStr
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, date
from app.models.sales import (
    CustomerType, InvoiceType, InvoiceStatus,
    PaymentMethod, InvoicePaymentMethod, QuotationStatus
)


# ─── Customer ────────────────────────────────────────────────────────
class CustomerCreate(BaseModel):
    customer_type: CustomerType = CustomerType.COMPANY
    name_ar: str
    name_en: Optional[str] = None
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None
    national_id: Optional[str] = None
    owner_name: Optional[str] = None
    owner_national_id: Optional[str] = None
    license_number: Optional[str] = None
    license_expiry: Optional[datetime] = None
    activity_type: Optional[str] = None
    address_street: Optional[str] = None
    address_building: Optional[str] = None
    address_city: Optional[str] = None
    address_district: Optional[str] = None
    address_postal: Optional[str] = None
    address_additional: Optional[str] = None
    address_country: str = "SA"
    phone: Optional[str] = None
    phone2: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    credit_limit: Decimal = Decimal("0")
    payment_terms_days: int = 30
    # الحساب الرئيسي الذي سيُنشأ تحته حساب العميل الفرعي
    ar_account_id: Optional[str] = None
    opening_balance: Decimal = Decimal("0")
    notes: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None


class CustomerUpdate(BaseModel):
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None
    national_id: Optional[str] = None
    owner_name: Optional[str] = None
    owner_national_id: Optional[str] = None
    license_number: Optional[str] = None
    activity_type: Optional[str] = None
    address_street: Optional[str] = None
    address_building: Optional[str] = None
    address_city: Optional[str] = None
    address_district: Optional[str] = None
    address_postal: Optional[str] = None
    address_additional: Optional[str] = None
    phone: Optional[str] = None
    phone2: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    payment_terms_days: Optional[int] = None
    ar_account_id: Optional[str] = None
    # عند إرساله في التعديل يُحدّث قيد الرصيد الافتتاحي، ولا يُحفظ كسجل مستقل على العميل.
    opening_balance: Optional[Decimal] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class CustomerOut(BaseModel):
    id: str
    customer_number: str
    customer_type: CustomerType
    name_ar: str
    name_en: Optional[str]
    vat_number: Optional[str]
    cr_number: Optional[str]
    national_id: Optional[str]
    owner_name: Optional[str]
    license_number: Optional[str]
    activity_type: Optional[str]
    address_city: Optional[str]
    address_district: Optional[str]
    address_street: Optional[str]
    address_building: Optional[str]
    address_postal: Optional[str]
    address_additional: Optional[str]
    address_country: Optional[str]
    phone: Optional[str]
    phone2: Optional[str]
    email: Optional[str]
    website: Optional[str]
    credit_limit: Decimal
    payment_terms_days: int
    ar_account_id: Optional[str]
    is_active: bool
    notes: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Invoice Lines ───────────────────────────────────────────────────
class InvoiceLineCreate(BaseModel):
    description_ar: str
    description_en: Optional[str] = None
    quantity: Decimal = Decimal("1")
    unit: Optional[str] = None
    unit_price: Decimal
    discount_pct: Decimal = Decimal("0")
    vat_rate: Decimal = Decimal("15")
    vat_category: str = "S"
    line_order: int = 0
    # ربط المخزون (اختياري)
    inventory_item_id: Optional[str] = None
    serial_item_id: Optional[str] = None   # legacy — سيريال واحد
    serial_ids: Optional[list[str]] = None  # جديد — قائمة سيريالات
    variant_id: Optional[str] = None
    # لا يُستخدم عند إنشاء الفاتورة؛ يلزم فقط عند إنشاء إشعار دائن لربط السطر بالأصل.
    original_invoice_line_id: Optional[str] = None


class InvoiceLineOut(BaseModel):
    id: str
    line_order: int
    description_ar: str
    description_en: Optional[str]
    quantity: Decimal
    unit: Optional[str]
    unit_price: Decimal
    discount_pct: Decimal
    discount_amount: Decimal
    vat_rate: Decimal
    vat_category: str
    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal
    inventory_item_id: Optional[str] = None
    serial_item_id: Optional[str] = None
    serial_ids_json: Optional[str] = None
    model_config = {"from_attributes": True}


# ─── Invoice ─────────────────────────────────────────────────────────
class InvoiceCreate(BaseModel):
    customer_id: str
    invoice_type: InvoiceType = InvoiceType.STANDARD
    issue_date: datetime
    supply_date: datetime
    due_date: Optional[datetime] = None
    fiscal_year_id: Optional[str] = None
    quotation_id: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    # طريقة الدفع على مستوى الفاتورة
    invoice_payment_method: Optional[InvoicePaymentMethod] = None
    credit_days: Optional[int] = None
    cheque_number: Optional[str] = None
    cheque_date: Optional[date] = None
    bank_name: Optional[str] = None
    lines: List[InvoiceLineCreate]


class InvoiceOut(BaseModel):
    id: str
    invoice_number: str
    uuid: str
    invoice_type: InvoiceType
    status: InvoiceStatus
    customer_id: str
    buyer_name_ar: str
    buyer_vat_number: Optional[str]
    issue_date: datetime
    supply_date: datetime
    due_date: Optional[datetime]
    subtotal: Decimal
    discount_amount: Decimal
    taxable_amount: Decimal
    vat_amount: Decimal
    total: Decimal
    paid_amount: Decimal
    currency_code: str
    qr_code: Optional[str]
    zatca_status: Optional[str]
    notes: Optional[str]
    seller_name_ar: Optional[str]
    seller_vat_number: Optional[str]
    seller_cr_number: Optional[str]
    seller_address: Optional[str]
    seller_logo: Optional[str] = None
    buyer_address: Optional[str]
    rep_id: Optional[str] = None
    rep_name: Optional[str] = None
    rep_code: Optional[str] = None
    rep_zone: Optional[str] = None
    # workflow المناديب
    invoice_payment_method: Optional[InvoicePaymentMethod] = None
    credit_days: Optional[int] = None
    cheque_number: Optional[str] = None
    cheque_date: Optional[date] = None
    bank_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    rejection_note: Optional[str] = None
    created_at: datetime
    lines: List[InvoiceLineOut] = []
    model_config = {"from_attributes": True}


class InvoiceReject(BaseModel):
    rejection_note: str


# ─── Payment ─────────────────────────────────────────────────────────
class PaymentCreate(BaseModel):
    invoice_id: str
    payment_date: datetime
    amount: Decimal
    payment_method: PaymentMethod
    reference: Optional[str] = None
    bank_account_id: Optional[str] = None
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    id: str
    payment_number: str
    invoice_id: str
    customer_id: str
    payment_date: datetime
    amount: Decimal
    payment_method: PaymentMethod
    reference: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Quotation ───────────────────────────────────────────────────────
class QuotationLineCreate(BaseModel):
    description_ar: str
    description_en: Optional[str] = None
    quantity: Decimal = Decimal("1")
    unit_price: Decimal
    discount_pct: Decimal = Decimal("0")
    vat_rate: Decimal = Decimal("15")
    line_order: int = 0


class QuotationCreate(BaseModel):
    customer_id: str
    issue_date: datetime
    expiry_date: Optional[datetime] = None
    subject: Optional[str] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    lines: List[QuotationLineCreate]


class QuotationOut(BaseModel):
    id: str
    quotation_number: str
    customer_id: str
    status: QuotationStatus
    issue_date: datetime
    expiry_date: Optional[datetime]
    subject: Optional[str]
    subtotal: Decimal
    vat_amount: Decimal
    total: Decimal
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Credit Note ─────────────────────────────────────────────────────
class CreditNoteLineCreate(InvoiceLineCreate):
    """سطر مرتجع مرتبط إلزامياً بسطر الفاتورة الأصلية.

    serial_ids يحدد الوحدات الفعلية المعادة للأصناف المتسلسلة؛ لا يقبل
    الخادم كمية سيريال بلا هذه القائمة.
    """
    original_invoice_line_id: str
    serial_ids: Optional[list[str]] = None


class CreditNoteCreate(BaseModel):
    original_invoice_id: str
    issue_date: datetime
    reason: str
    lines: List[CreditNoteLineCreate]


class RefundRequestCreate(BaseModel):
    amount: Decimal
    reason: Optional[str] = None


class RefundRequestDecision(BaseModel):
    rejection_reason: Optional[str] = None
