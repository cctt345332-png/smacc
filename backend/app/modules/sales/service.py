import uuid
import base64
import json
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.sales import (
    Customer, Invoice, InvoiceLine, Payment, Quotation, QuotationLine,
    CreditNote, CreditNoteLine, InvoiceStatus, InvoiceType, PaymentMethod
)
from app.modules.sales.schemas import (
    CustomerCreate, CustomerUpdate, InvoiceCreate, PaymentCreate,
    QuotationCreate, CreditNoteCreate
)


# ─── QR Code Generator (ZATCA TLV format) ───────────────────────────
def _generate_qr_tlv(seller_name: str, vat_number: str, timestamp: str,
                      total: Decimal, vat_amount: Decimal) -> str:
    """توليد QR Code بصيغة TLV المطلوبة من زاتكا"""
    def tlv(tag: int, value: str) -> bytes:
        v = value.encode("utf-8")
        return bytes([tag, len(v)]) + v

    data = (
        tlv(1, seller_name) +
        tlv(2, vat_number or "") +
        tlv(3, timestamp) +
        tlv(4, str(total)) +
        tlv(5, str(vat_amount))
    )
    return base64.b64encode(data).decode("utf-8")


# ─── Sequence Numbers ────────────────────────────────────────────────
async def _next_customer_number(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id))
    return f"CUS-{str((r.scalar() or 0) + 1).zfill(5)}"


async def _next_invoice_number(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(select(func.count(Invoice.id)).where(Invoice.tenant_id == tenant_id))
    return f"INV-{str((r.scalar() or 0) + 1).zfill(5)}"


async def _next_payment_number(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(select(func.count(Payment.id)).where(Payment.tenant_id == tenant_id))
    return f"PAY-{str((r.scalar() or 0) + 1).zfill(5)}"


async def _next_quotation_number(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(select(func.count(Quotation.id)).where(Quotation.tenant_id == tenant_id))
    return f"QUO-{str((r.scalar() or 0) + 1).zfill(5)}"


async def _next_credit_note_number(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(select(func.count(CreditNote.id)).where(CreditNote.tenant_id == tenant_id))
    return f"CN-{str((r.scalar() or 0) + 1).zfill(5)}"


# ─── Line Calculations ───────────────────────────────────────────────
def _calc_line(qty: Decimal, price: Decimal, disc_pct: Decimal, vat_rate: Decimal):
    subtotal = (qty * price).quantize(Decimal("0.01"))
    discount = (subtotal * disc_pct / 100).quantize(Decimal("0.01"))
    taxable = subtotal - discount
    vat = (taxable * vat_rate / 100).quantize(Decimal("0.01"))
    total = taxable + vat
    return subtotal, discount, taxable, vat, total


# ─── Customers ───────────────────────────────────────────────────────
async def get_customers(db: AsyncSession, tenant_id: str, search: str | None = None, rep_id: str | None = None):
    q = select(Customer).where(Customer.tenant_id == tenant_id)
    if search:
        q = q.where(Customer.name_ar.ilike(f"%{search}%") | Customer.customer_number.ilike(f"%{search}%"))
    if rep_id:
        q = q.where(Customer.rep_id == rep_id)
    q = q.order_by(Customer.customer_number)
    r = await db.execute(q)
    return r.scalars().all()


async def get_customer(db: AsyncSession, tenant_id: str, customer_id: str):
    c = await db.get(Customer, customer_id)
    if not c or c.tenant_id != tenant_id:
        raise HTTPException(404, "Customer not found")
    return c


async def create_customer(db: AsyncSession, tenant_id: str, data: CustomerCreate, rep_id: str | None = None):
    customer = Customer(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        customer_number=await _next_customer_number(db, tenant_id),
        rep_id=rep_id,
        **data.model_dump(),
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


async def update_customer(db: AsyncSession, tenant_id: str, customer_id: str, data: CustomerUpdate):
    c = await get_customer(db, tenant_id, customer_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return c


# ─── Invoices ────────────────────────────────────────────────────────
async def get_invoices(db: AsyncSession, tenant_id: str, status: str | None = None,
                        customer_id: str | None = None, rep_id: str | None = None):
    from sqlalchemy.orm import selectinload
    q = select(Invoice).options(selectinload(Invoice.lines), selectinload(Invoice.payments)).where(Invoice.tenant_id == tenant_id)
    if status:
        q = q.where(Invoice.status == status)
    if customer_id:
        q = q.where(Invoice.customer_id == customer_id)
    if rep_id:
        q = q.where(Invoice.rep_id == rep_id)
    q = q.order_by(Invoice.issue_date.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def get_invoice(db: AsyncSession, tenant_id: str, invoice_id: str):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Invoice).options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id)
    )
    inv = result.scalar_one_or_none()
    if not inv or inv.tenant_id != tenant_id:
        raise HTTPException(404, "Invoice not found")
    # نضيف الشعار من بيانات الشركة
    from sqlalchemy import select as sa_select
    from app.models.tenant import Tenant
    tenant_r = await db.execute(sa_select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_r.scalar_one_or_none()
    if tenant and tenant.logo_data:
        inv.__dict__["seller_logo"] = tenant.logo_data
    else:
        inv.__dict__["seller_logo"] = None
    return inv


async def create_invoice(db: AsyncSession, tenant_id: str, user_id: str, data: InvoiceCreate):
    # جلب بيانات العميل
    customer = await get_customer(db, tenant_id, data.customer_id)

    # جلب إعدادات الضريبة للبائع
    from app.modules.accounting.service import get_vat_settings
    vat_settings = await get_vat_settings(db, tenant_id)

    # جلب بيانات الشركة (المستأجر)
    from app.models.tenant import Tenant
    from sqlalchemy import select as sa_select
    tenant_r = await db.execute(sa_select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_r.scalar_one_or_none()

    # حساب المبالغ
    subtotal = Decimal("0")
    total_discount = Decimal("0")
    total_vat = Decimal("0")
    total = Decimal("0")

    invoice_id = str(uuid.uuid4())
    invoice_uuid = str(uuid.uuid4())
    issue_date = data.issue_date.replace(tzinfo=None)
    supply_date = data.supply_date.replace(tzinfo=None)
    due_date = data.due_date.replace(tzinfo=None) if data.due_date else None

    lines_data = []
    for i, line in enumerate(data.lines):
        sub, disc, taxable, vat, tot = _calc_line(line.quantity, line.unit_price, line.discount_pct, line.vat_rate)
        subtotal += sub
        total_discount += disc
        total_vat += vat
        total += tot
        lines_data.append((line, sub, disc, vat, tot))

    taxable_amount = subtotal - total_discount

    # توليد QR Code (زاتكا TLV)
    qr = _generate_qr_tlv(
        seller_name=tenant.name if tenant else "",
        vat_number=vat_settings.vat_number if vat_settings else "",
        timestamp=issue_date.isoformat(),
        total=total,
        vat_amount=total_vat,
    )

    # بيانات البائع snapshot — من بيانات الشركة
    seller_address_parts = [
        tenant.address_street or "",
        tenant.address_district or "",
        tenant.address_city or "",
        tenant.address_postal or "",
        "المملكة العربية السعودية",
    ]
    seller_address = "، ".join(p for p in seller_address_parts if p)

    # بيانات المشتري snapshot
    buyer_address_parts = [
        customer.address_street or "",
        customer.address_district or "",
        customer.address_city or "",
        customer.address_postal or "",
    ]
    buyer_address = "، ".join(p for p in buyer_address_parts if p)

    # ربط المندوب إن كان المستخدم مندوباً
    rep_id = getattr(data, "rep_id", None)
    if not rep_id:
        from app.models.reps import SalesRep
        rep_r = await db.execute(select(SalesRep).where(SalesRep.user_id == user_id))
        rep = rep_r.scalar_one_or_none()
        if rep:
            rep_id = rep.id

    invoice = Invoice(
        id=invoice_id,
        tenant_id=tenant_id,
        invoice_number=await _next_invoice_number(db, tenant_id),
        uuid=invoice_uuid,
        invoice_type=data.invoice_type,
        customer_id=data.customer_id,
        issue_date=issue_date,
        supply_date=supply_date,
        due_date=due_date,
        fiscal_year_id=data.fiscal_year_id,
        quotation_id=data.quotation_id,
        seller_name_ar=tenant.name if tenant else "",
        seller_vat_number=vat_settings.vat_number if vat_settings else (tenant.vat_number if tenant else None),
        seller_cr_number=vat_settings.cr_number if vat_settings else (tenant.cr_number if tenant else None),
        seller_address=seller_address,
        buyer_name_ar=customer.name_ar,
        buyer_vat_number=customer.vat_number,
        buyer_address=buyer_address,
        subtotal=subtotal,
        discount_amount=total_discount,
        taxable_amount=taxable_amount,
        vat_amount=total_vat,
        total=total,
        currency_code="SAR",
        qr_code=qr,
        notes=data.notes,
        terms=data.terms,
        rep_id=rep_id,
        # حقول طريقة الدفع
        invoice_payment_method=data.invoice_payment_method,
        credit_days=data.credit_days,
        cheque_number=data.cheque_number,
        cheque_date=data.cheque_date,
        bank_name=data.bank_name,
        created_by=user_id,
    )
    db.add(invoice)

    for i, (line, sub, disc, vat, tot) in enumerate(lines_data):
        import json as _json
        db.add(InvoiceLine(
            id=str(uuid.uuid4()),
            invoice_id=invoice_id,
            line_order=i,
            description_ar=line.description_ar,
            description_en=line.description_en,
            quantity=line.quantity,
            unit=line.unit,
            unit_price=line.unit_price,
            discount_pct=line.discount_pct,
            discount_amount=disc,
            vat_rate=line.vat_rate,
            vat_category=line.vat_category,
            subtotal=sub,
            vat_amount=vat,
            total=tot,
            inventory_item_id=getattr(line, "inventory_item_id", None),
            serial_item_id=getattr(line, "serial_item_id", None),
            serial_ids_json=_json.dumps(line.serial_ids) if getattr(line, "serial_ids", None) else None,
            variant_id=getattr(line, "variant_id", None),
        ))

    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def confirm_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    """تأكيد الفاتورة — تقبل draft أو approved"""
    invoice = await get_invoice(db, tenant_id, invoice_id)
    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.APPROVED):
        raise HTTPException(400, f"لا يمكن تأكيد فاتورة بحالة '{invoice.status.value}'")

    if invoice.fiscal_year_id:
        journal_id = await _create_invoice_journal(db, tenant_id, user_id, invoice)
        invoice.journal_entry_id = journal_id

    await _deduct_inventory_for_invoice(db, tenant_id, user_id, invoice)

    invoice.status = InvoiceStatus.CONFIRMED
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def _deduct_inventory_for_invoice(
    db: AsyncSession, tenant_id: str, user_id: str, invoice: Invoice
):
    """خصم المخزون عند تأكيد فاتورة المبيعات"""
    from app.modules.inventory.service import sell_serial, deduct_stock, deduct_batch_fefo
    from app.models.inventory import InventoryItem
    import json

    # تحديد المستودع — إن كان مندوباً يُخصم من مستودعه
    warehouse_id = None
    if invoice.rep_id:
        from app.models.reps import SalesRep
        rep_r = await db.execute(select(SalesRep).where(SalesRep.id == invoice.rep_id))
        rep = rep_r.scalar_one_or_none()
        if rep:
            warehouse_id = rep.warehouse_id

    lines_r = await db.execute(
        select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id)
    )
    lines = lines_r.scalars().all()

    for line in lines:
        # ── السيريالات المتعددة (الطريقة الجديدة) ─────────────────────
        if line.serial_ids_json:
            serial_ids = json.loads(line.serial_ids_json)
            for sid in serial_ids:
                try:
                    await sell_serial(
                        db=db, tenant_id=tenant_id,
                        serial_id=sid,
                        sale_price=line.unit_price,
                        invoice_id=invoice.id,
                    )
                except HTTPException as e:
                    raise HTTPException(400, f"خطأ في خصم السيريال {sid}: {e.detail}")
            continue

        # ── السيريال الواحد (legacy) ────────────────────────────────────
        if line.serial_item_id:
            try:
                await sell_serial(
                    db=db, tenant_id=tenant_id,
                    serial_id=line.serial_item_id,
                    sale_price=line.unit_price,
                    invoice_id=invoice.id,
                )
            except HTTPException as e:
                raise HTTPException(400, f"خطأ في خصم السيريال: {e.detail}")
        elif line.inventory_item_id:
            item = await db.get(InventoryItem, line.inventory_item_id)
            if item and item.tracking_type == "batch":
                try:
                    await deduct_batch_fefo(
                        db=db, tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        quantity=line.quantity,
                        reference_type="invoice",
                        reference_id=invoice.id,
                        user_id=user_id,
                    )
                except HTTPException as e:
                    raise HTTPException(400, f"خطأ في خصم التشغيلة: {e.detail}")
            elif item and item.tracking_type == "variant" and line.variant_id:
                from app.models.inventory import ProductVariant
                variant = await db.get(ProductVariant, line.variant_id)
                if variant:
                    if variant.quantity < line.quantity:
                        raise HTTPException(400, f"الكمية المتاحة للمتغير {variant.quantity} أقل من المطلوب")
                    variant.quantity -= line.quantity
                    item.quantity_on_hand -= line.quantity
            else:
                try:
                    await deduct_stock(
                        db=db, tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        quantity=line.quantity,
                        warehouse_id=warehouse_id,
                        reference_type="invoice",
                        reference_id=invoice.id,
                        user_id=user_id,
                    )
                except HTTPException as e:
                    raise HTTPException(400, f"خطأ في خصم المخزون: {e.detail}")


async def _create_invoice_journal(db: AsyncSession, tenant_id: str, user_id: str, invoice: Invoice) -> str | None:
    """قيد يومية تلقائي للفاتورة: مدين حسابات القبض، دائن الإيرادات + الضريبة"""
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus, Account, AccountType
    from app.modules.accounting.service import _next_entry_number, get_vat_settings

    vat_settings = await get_vat_settings(db, tenant_id)

    # نحتاج حسابات: حسابات القبض، الإيرادات، ضريبة القيمة المضافة
    customer = await db.get(Customer, invoice.customer_id)
    ar_account_id = customer.ar_account_id if customer else None

    if not ar_account_id:
        return None  # لا يمكن إنشاء القيد بدون حساب القبض

    # جلب أول حساب إيرادات متاح للـ tenant
    revenue_r = await db.execute(
        select(Account).where(
            Account.tenant_id == tenant_id,
            Account.account_type == AccountType.REVENUE,
            Account.is_active == True,
            Account.is_posting == True,
        ).order_by(Account.code).limit(1)
    )
    revenue_account = revenue_r.scalar_one_or_none()
    revenue_account_id = revenue_account.id if revenue_account else None

    entry_number = await _next_entry_number(db, tenant_id)
    entry = JournalEntry(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=invoice.issue_date,
        fiscal_year_id=invoice.fiscal_year_id,
        description_ar=f"فاتورة مبيعات: {invoice.invoice_number} - {invoice.buyer_name_ar}",
        description_en=f"Sales Invoice: {invoice.invoice_number}",
        status=JournalEntryStatus.POSTED,
        source="sales_invoice",
        reference=invoice.invoice_number,
        total_debit=invoice.total,
        total_credit=invoice.total,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(entry)

    line_order = 0

    # مدين: حسابات القبض (الإجمالي شامل الضريبة)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=ar_account_id,
        description=f"فاتورة {invoice.invoice_number}",
        debit=invoice.total, credit=Decimal("0"), line_order=line_order,
    ))
    line_order += 1

    # دائن: الإيرادات (المبلغ قبل الضريبة)
    if revenue_account_id:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=revenue_account_id,
            description=f"إيرادات مبيعات — {invoice.invoice_number}",
            debit=Decimal("0"), credit=invoice.taxable_amount, line_order=line_order,
        ))
        line_order += 1

    # دائن: ضريبة القيمة المضافة
    if invoice.vat_amount > 0 and vat_settings and vat_settings.vat_account_id:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=vat_settings.vat_account_id,
            description="ضريبة القيمة المضافة 15%",
            debit=Decimal("0"), credit=invoice.vat_amount, line_order=line_order,
        ))

    return entry.id


async def cancel_invoice(db: AsyncSession, tenant_id: str, invoice_id: str):
    invoice = await get_invoice(db, tenant_id, invoice_id)
    if invoice.status in (InvoiceStatus.PAID, InvoiceStatus.CANCELLED):
        raise HTTPException(400, "Cannot cancel this invoice")
    invoice.status = InvoiceStatus.CANCELLED
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


# ─── Payments ────────────────────────────────────────────────────────
async def get_payments(db: AsyncSession, tenant_id: str, invoice_id: str | None = None, rep_id: str | None = None):
    q = select(Payment).where(Payment.tenant_id == tenant_id)
    if invoice_id:
        q = q.where(Payment.invoice_id == invoice_id)
    if rep_id:
        q = q.where(Payment.rep_id == rep_id)
    q = q.order_by(Payment.payment_date.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def create_payment(db: AsyncSession, tenant_id: str, user_id: str, data: PaymentCreate):
    invoice = await get_invoice(db, tenant_id, data.invoice_id)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(400, "Cannot pay a cancelled invoice")

    payment_date = data.payment_date.replace(tzinfo=None)
    payment = Payment(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        payment_number=await _next_payment_number(db, tenant_id),
        customer_id=invoice.customer_id,
        rep_id=invoice.rep_id,   # يرث rep_id من الفاتورة تلقائياً
        payment_date=payment_date,
        created_by=user_id,
        **{k: v for k, v in data.model_dump().items() if k != "payment_date"},
    )
    db.add(payment)

    # تحديث المبلغ المدفوع
    invoice.paid_amount += data.amount
    remaining = invoice.total - invoice.paid_amount
    if remaining <= Decimal("0.01"):
        invoice.status = InvoiceStatus.PAID
    elif invoice.paid_amount > 0:
        invoice.status = InvoiceStatus.PARTIAL

    # ── قيد سند القبض التلقائي ──────────────────────────────────────
    if invoice.fiscal_year_id:
        journal_id = await _create_payment_journal(
            db, tenant_id, user_id, payment, invoice, data.bank_account_id
        )
        payment.journal_entry_id = journal_id

    await db.commit()
    await db.refresh(payment)
    return payment


async def _create_payment_journal(
    db: AsyncSession, tenant_id: str, user_id: str,
    payment: Payment, invoice: Invoice, bank_account_id: str | None
) -> str | None:
    """
    قيد سند القبض:
    مدين: البنك أو الصندوق (حسب طريقة الدفع)
    دائن: حسابات القبض
    """
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import _next_entry_number
    from app.models.sales import Customer

    # حساب القبض من العميل
    customer = await db.get(Customer, invoice.customer_id)
    ar_account_id = customer.ar_account_id if customer else None
    if not ar_account_id:
        return None  # لا قيد بدون حساب القبض

    # حساب البنك/الصندوق — من الحساب البنكي المختار أو نبحث عن حساب الصندوق
    debit_account_id = None
    if bank_account_id:
        from app.models.accounting import BankAccount
        bank = await db.get(BankAccount, bank_account_id)
        if bank and bank.gl_account_id:
            debit_account_id = bank.gl_account_id

    if not debit_account_id:
        return None  # لا قيد بدون حساب البنك/الصندوق

    # وصف طريقة الدفع
    method_ar = {
        "cash": "نقداً",
        "bank_transfer": "تحويل بنكي",
        "cheque": "شيك",
        "mada": "مدى",
        "stc_pay": "STC Pay",
        "credit_card": "بطاقة ائتمان",
    }.get(payment.payment_method.value if hasattr(payment.payment_method, 'value') else str(payment.payment_method), "دفع")

    entry_number = await _next_entry_number(db, tenant_id)
    entry = JournalEntry(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=payment.payment_date,
        fiscal_year_id=invoice.fiscal_year_id,
        description_ar=f"سند قبض {payment.payment_number} - {invoice.buyer_name_ar} - {method_ar}",
        description_en=f"Payment Receipt {payment.payment_number}",
        status=JournalEntryStatus.POSTED,
        source="payment_receipt",
        reference=payment.payment_number,
        total_debit=payment.amount,
        total_credit=payment.amount,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(entry)

    # مدين: البنك / الصندوق
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=debit_account_id,
        description=f"استلام دفعة - {method_ar}",
        debit=payment.amount, credit=Decimal("0"), line_order=0,
    ))

    # دائن: حسابات القبض
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=ar_account_id,
        description=f"تسوية فاتورة {invoice.invoice_number}",
        debit=Decimal("0"), credit=payment.amount, line_order=1,
    ))

    # ── إنشاء سند قبض في الخزينة أيضاً ──────────────────────────
    await _create_receipt_voucher(db, tenant_id, user_id, payment, invoice, bank_account_id, ar_account_id, debit_account_id, method_ar)

    return entry.id


async def _create_receipt_voucher(
    db, tenant_id, user_id, payment, invoice, bank_account_id, ar_account_id, debit_account_id, method_ar
):
    """إنشاء سند قبض في الخزينة مرتبط بفاتورة المبيعات"""
    from app.models.treasury import Voucher, VoucherType, VoucherStatus
    from app.modules.treasury.service import _next_number

    voucher_num = await _next_number(db, tenant_id, VoucherType.RECEIPT)
    voucher = Voucher(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        voucher_number=voucher_num,
        voucher_type=VoucherType.RECEIPT,
        status=VoucherStatus.POSTED,
        voucher_date=payment.payment_date,
        amount=payment.amount,
        vat_amount=Decimal("0"),
        currency_code="SAR",
        payment_method=payment.payment_method,
        bank_account_id=bank_account_id,
        party_type="customer",
        party_id=str(invoice.customer_id),
        party_name=invoice.buyer_name_ar,
        invoice_id=str(invoice.id),
        debit_account_id=debit_account_id,
        credit_account_id=ar_account_id,
        fiscal_year_id=invoice.fiscal_year_id,
        description_ar=f"سند قبض — {invoice.buyer_name_ar} — فاتورة {invoice.invoice_number} — {method_ar}",
        reference=payment.payment_number,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(voucher)


# ─── Quotations ──────────────────────────────────────────────────────
async def get_quotations(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(Quotation).where(Quotation.tenant_id == tenant_id).order_by(Quotation.issue_date.desc())
    )
    return r.scalars().all()


async def create_quotation(db: AsyncSession, tenant_id: str, user_id: str, data: QuotationCreate):
    subtotal = Decimal("0")
    total_vat = Decimal("0")
    total = Decimal("0")

    quot_id = str(uuid.uuid4())
    issue_date = data.issue_date.replace(tzinfo=None)
    expiry_date = data.expiry_date.replace(tzinfo=None) if data.expiry_date else None

    lines_data = []
    for line in data.lines:
        sub, disc, taxable, vat, tot = _calc_line(line.quantity, line.unit_price, line.discount_pct, line.vat_rate)
        subtotal += sub
        total_vat += vat
        total += tot
        lines_data.append((line, sub, vat, tot))

    quot = Quotation(
        id=quot_id, tenant_id=tenant_id,
        quotation_number=await _next_quotation_number(db, tenant_id),
        customer_id=data.customer_id,
        issue_date=issue_date, expiry_date=expiry_date,
        subject=data.subject, notes=data.notes, terms=data.terms,
        subtotal=subtotal, vat_amount=total_vat, total=total,
        created_by=user_id,
    )
    db.add(quot)

    for i, (line, sub, vat, tot) in enumerate(lines_data):
        db.add(QuotationLine(
            id=str(uuid.uuid4()), quotation_id=quot_id, line_order=i,
            description_ar=line.description_ar, description_en=line.description_en,
            quantity=line.quantity, unit_price=line.unit_price,
            discount_pct=line.discount_pct, vat_rate=line.vat_rate,
            subtotal=sub, vat_amount=vat, total=tot,
        ))

    await db.commit()
    await db.refresh(quot)
    return quot


async def convert_quotation_to_invoice(db: AsyncSession, tenant_id: str, user_id: str, quotation_id: str):
    """تحويل عرض السعر لفاتورة"""
    quot_r = await db.execute(select(Quotation).where(Quotation.id == quotation_id, Quotation.tenant_id == tenant_id))
    quot = quot_r.scalar_one_or_none()
    if not quot:
        raise HTTPException(404, "Quotation not found")

    lines_r = await db.execute(select(QuotationLine).where(QuotationLine.quotation_id == quotation_id))
    lines = lines_r.scalars().all()

    from app.modules.sales.schemas import InvoiceCreate, InvoiceLineCreate
    invoice_data = InvoiceCreate(
        customer_id=quot.customer_id,
        issue_date=datetime.utcnow(),
        supply_date=datetime.utcnow(),
        quotation_id=quotation_id,
        notes=quot.notes,
        terms=quot.terms,
        lines=[InvoiceLineCreate(
            description_ar=l.description_ar,
            description_en=l.description_en,
            quantity=l.quantity,
            unit_price=l.unit_price,
            discount_pct=l.discount_pct,
            vat_rate=l.vat_rate,
        ) for l in lines],
    )

    quot.status = "accepted"
    invoice = await create_invoice(db, tenant_id, user_id, invoice_data)
    return invoice


# ─── Credit Notes ────────────────────────────────────────────────────
async def create_credit_note(db: AsyncSession, tenant_id: str, user_id: str, data: CreditNoteCreate):
    original = await get_invoice(db, tenant_id, data.original_invoice_id)

    subtotal = Decimal("0")
    total_vat = Decimal("0")
    total = Decimal("0")
    cn_id = str(uuid.uuid4())
    issue_date = data.issue_date.replace(tzinfo=None)

    lines_data = []
    for line in data.lines:
        sub, disc, taxable, vat, tot = _calc_line(line.quantity, line.unit_price, line.discount_pct, line.vat_rate)
        subtotal += sub
        total_vat += vat
        total += tot
        lines_data.append((line, sub, vat, tot))

    from app.models.tenant import Tenant
    tenant = await db.get(Tenant, tenant_id)
    from app.modules.accounting.service import get_vat_settings
    vat_settings = await get_vat_settings(db, tenant_id)

    qr = _generate_qr_tlv(
        seller_name=tenant.name if tenant else "",
        vat_number=vat_settings.vat_number if vat_settings else "",
        timestamp=issue_date.isoformat(),
        total=total, vat_amount=total_vat,
    )

    cn = CreditNote(
        id=cn_id, tenant_id=tenant_id,
        credit_note_number=await _next_credit_note_number(db, tenant_id),
        uuid=str(uuid.uuid4()),
        original_invoice_id=data.original_invoice_id,
        customer_id=original.customer_id,
        issue_date=issue_date, reason=data.reason,
        subtotal=subtotal, vat_amount=total_vat, total=total,
        qr_code=qr, created_by=user_id,
    )
    db.add(cn)

    for i, (line, sub, vat, tot) in enumerate(lines_data):
        db.add(CreditNoteLine(
            id=str(uuid.uuid4()), credit_note_id=cn_id, line_order=i,
            description_ar=line.description_ar,
            quantity=line.quantity, unit_price=line.unit_price,
            vat_rate=line.vat_rate, subtotal=sub, vat_amount=vat, total=tot,
        ))

    await db.commit()
    await db.refresh(cn)

    # ── قيد محاسبي للإشعار الدائن (مرتجع مبيعات) ──────────────────
    if original.fiscal_year_id:
        await _create_credit_note_journal(db, tenant_id, user_id, cn, original)
        await db.commit()

    return cn


async def _create_credit_note_journal(db, tenant_id, user_id, cn, original_invoice):
    """
    قيد مرتجع المبيعات:
    مدين: الإيرادات (عكس الفاتورة الأصلية)
    مدين: ضريبة القيمة المضافة (استرداد)
    دائن: حسابات القبض (تخفيض الدين)
    """
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import _next_entry_number, get_vat_settings

    customer = await db.get(Customer, cn.customer_id)
    ar_account_id = customer.ar_account_id if customer else None
    if not ar_account_id:
        return

    vat_settings = await get_vat_settings(db, tenant_id)
    entry_number = await _next_entry_number(db, tenant_id)

    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=cn.issue_date,
        fiscal_year_id=original_invoice.fiscal_year_id,
        description_ar=f"إشعار دائن (مرتجع): {cn.credit_note_number} — {original_invoice.buyer_name_ar}",
        description_en=f"Credit Note (Return): {cn.credit_note_number}",
        status=JournalEntryStatus.POSTED,
        source="credit_note",
        reference=cn.credit_note_number,
        total_debit=cn.total,
        total_credit=cn.total,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(entry)

    # دائن: حسابات القبض (تخفيض ما يستحق من العميل)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=ar_account_id,
        description=f"مرتجع — {cn.credit_note_number}",
        debit=Decimal("0"), credit=cn.total, line_order=0,
    ))

    # مدين: ضريبة القيمة المضافة (استرداد ضريبة المخرجات)
    if cn.vat_amount > 0 and vat_settings and vat_settings.vat_account_id:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=vat_settings.vat_account_id,
            description="استرداد ضريبة القيمة المضافة — مرتجع",
            debit=cn.vat_amount, credit=Decimal("0"), line_order=1,
        ))


    # مدين: ضريبة القيمة المضافة (استرداد ضريبة المخرجات)
    if cn.vat_amount > 0 and vat_settings and vat_settings.vat_account_id:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=vat_settings.vat_account_id,
            description="استرداد ضريبة القيمة المضافة — مرتجع",
            debit=cn.vat_amount, credit=Decimal("0"), line_order=1,
        ))


# ─── Summary ─────────────────────────────────────────────────────────
async def get_sales_summary(db: AsyncSession, tenant_id: str, rep_id: str | None = None):
    q = select(Invoice).where(Invoice.tenant_id == tenant_id)
    if rep_id:
        q = q.where(Invoice.rep_id == rep_id)
    invoices_r = await db.execute(q)
    invoices = invoices_r.scalars().all()

    total_invoiced = sum(i.total for i in invoices if i.status != InvoiceStatus.CANCELLED)
    total_paid = sum(i.paid_amount for i in invoices)
    total_outstanding = total_invoiced - total_paid
    overdue_count = sum(1 for i in invoices if i.status == InvoiceStatus.OVERDUE)
    draft_count = sum(1 for i in invoices if i.status == InvoiceStatus.DRAFT)

    return {
        "total_invoiced": total_invoiced,
        "total_paid": total_paid,
        "total_outstanding": total_outstanding,
        "overdue_count": overdue_count,
        "draft_count": draft_count,
        "invoice_count": len(invoices),
    }


# ─── Workflow المناديب ────────────────────────────────────────────────

async def submit_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    """المندوب يقدّم الفاتورة للمحاسب — draft أو rejected → submitted"""
    invoice = await get_invoice(db, tenant_id, invoice_id)

    # التحقق من الصلاحية — المندوب يقدّم فواتيره فقط
    from app.models.reps import SalesRep
    rep_r = await db.execute(select(SalesRep).where(SalesRep.user_id == user_id))
    rep = rep_r.scalar_one_or_none()
    if rep and invoice.rep_id != rep.id:
        raise HTTPException(403, "لا يمكنك تقديم فاتورة مندوب آخر")

    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.REJECTED):
        raise HTTPException(400, f"لا يمكن تقديم فاتورة بحالة '{invoice.status.value}'")

    invoice.status = InvoiceStatus.SUBMITTED
    invoice.submitted_at = datetime.utcnow()
    invoice.rejection_note = None  # مسح سبب الرفض السابق
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def approve_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    """المحاسب/المدير يوافق على الفاتورة — submitted → approved"""
    invoice = await get_invoice(db, tenant_id, invoice_id)

    if invoice.status != InvoiceStatus.SUBMITTED:
        raise HTTPException(400, f"لا يمكن الموافقة على فاتورة بحالة '{invoice.status.value}'")

    invoice.status = InvoiceStatus.APPROVED
    invoice.reviewed_by = user_id
    invoice.reviewed_at = datetime.utcnow()
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def reject_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str, rejection_note: str):
    """المحاسب/المدير يرفض الفاتورة مع سبب — submitted → rejected"""
    invoice = await get_invoice(db, tenant_id, invoice_id)

    if invoice.status != InvoiceStatus.SUBMITTED:
        raise HTTPException(400, f"لا يمكن رفض فاتورة بحالة '{invoice.status.value}'")

    if not rejection_note or not rejection_note.strip():
        raise HTTPException(400, "يجب إدخال سبب الرفض")

    invoice.status = InvoiceStatus.REJECTED
    invoice.reviewed_by = user_id
    invoice.reviewed_at = datetime.utcnow()
    invoice.rejection_note = rejection_note.strip()
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def confirm_approved_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    """تأكيد الفاتورة الموافق عليها — approved → confirmed + خصم المخزون"""
    invoice = await get_invoice(db, tenant_id, invoice_id)

    if invoice.status != InvoiceStatus.APPROVED:
        raise HTTPException(400, f"لا يمكن تأكيد فاتورة بحالة '{invoice.status.value}' — يجب أن تكون موافقاً عليها أولاً")

    if invoice.fiscal_year_id:
        journal_id = await _create_invoice_journal(db, tenant_id, user_id, invoice)
        invoice.journal_entry_id = journal_id

    await _deduct_inventory_for_invoice(db, tenant_id, user_id, invoice)

    invoice.status = InvoiceStatus.CONFIRMED
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def get_submitted_invoices(db: AsyncSession, tenant_id: str, rep_id: str | None = None):
    """جلب الفواتير المقدّمة للمراجعة"""
    from sqlalchemy.orm import selectinload
    q = (
        select(Invoice)
        .options(selectinload(Invoice.lines))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.status == InvoiceStatus.SUBMITTED,
        )
    )
    if rep_id:
        q = q.where(Invoice.rep_id == rep_id)
    q = q.order_by(Invoice.submitted_at.asc())
    r = await db.execute(q)
    return r.scalars().all()


async def update_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str, data: dict):
    """تحديث فاتورة مسودة أو مرفوضة"""
    invoice = await get_invoice(db, tenant_id, invoice_id)

    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.REJECTED):
        raise HTTPException(400, "لا يمكن تعديل فاتورة بهذه الحالة")

    # تحديث الحقول المسموح بها
    allowed = {
        "notes", "terms", "due_date",
        "invoice_payment_method", "credit_days",
        "cheque_number", "cheque_date", "bank_name",
    }
    for key, value in data.items():
        if key in allowed:
            setattr(invoice, key, value)

    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)
