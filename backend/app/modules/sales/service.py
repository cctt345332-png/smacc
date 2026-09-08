import uuid
import base64
import json
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, case, or_
from fastapi import HTTPException

from app.models.sales import (
    Customer, Invoice, InvoiceLine, Payment, Quotation, QuotationLine,
    CreditNote, CreditNoteLine, RefundRequest, RefundRequestStatus,
    InvoiceStatus, InvoiceType, PaymentMethod, InvoicePaymentMethod
)
from app.models.reps import SalesRep
from app.models.user import User
from app.models.inventory import (
    InventoryItem, ProductVariant, SerialItem, BatchItem, StockMovement,
)
from app.models.accounting import Account, AccountType, AccountNature, JournalEntry, JournalEntryLine
from app.modules.sales.schemas import (
    CustomerCreate, CustomerUpdate, InvoiceCreate, PaymentCreate,
    QuotationCreate, CreditNoteCreate, RefundRequestCreate
)
from app.core.audit import record_audit
from app.modules.accounting.service import is_operational_auto_posting_enabled


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


def _normalize_match_text(value: str | None) -> str:
    return " ".join((value or "").replace("ـ", "").split()).strip().lower()


async def preview_customer_account_import(db: AsyncSession, tenant_id: str) -> dict:
    """يعرض الحسابات النهائية تحت فرع العملاء التي يمكن تحويلها إلى سجلات عملاء."""
    accounts = (await db.execute(select(Account).where(Account.tenant_id == tenant_id).order_by(Account.code))).scalars().all()
    account_by_id = {account.id: account for account in accounts}
    customer_accounts = [account for account in accounts if account.is_customer_account]
    reps = (await db.execute(
        select(SalesRep, User).join(User, User.id == SalesRep.user_id).where(SalesRep.tenant_id == tenant_id)
    )).all()
    existing = (await db.execute(select(Customer).where(Customer.tenant_id == tenant_id))).scalars().all()
    by_account = {customer.ar_account_id: customer for customer in existing if customer.ar_account_id}
    by_name = {_normalize_match_text(customer.name_ar): customer for customer in existing}
    items = []
    for account in customer_accounts:
        ancestors = []
        parent = account_by_id.get(account.parent_id)
        while parent:
            ancestors.append(parent)
            parent = account_by_id.get(parent.parent_id)
        ancestor_names = [item.name_ar for item in reversed(ancestors)]
        rep_branch = next((name for name in ancestor_names if "مندوب" in name), None)
        city = None
        if rep_branch and "/" in rep_branch:
            city = rep_branch.rsplit("/", 1)[1].strip()
        matched_rep = None
        if rep_branch:
            rep_token = _normalize_match_text(rep_branch.split("-", 1)[-1].split("/", 1)[0])
            for rep, user in reps:
                candidates = {_normalize_match_text(user.full_name), _normalize_match_text(rep.rep_code)}
                if rep_token and any(rep_token in candidate or candidate in rep_token for candidate in candidates if candidate):
                    matched_rep = rep
                    break
        existing_customer = by_account.get(account.id) or by_name.get(_normalize_match_text(account.name_ar))
        items.append({
            "account_id": account.id, "account_code": account.code, "name_ar": account.name_ar,
            "city": city, "rep_id": matched_rep.id if matched_rep else None,
            "rep_name": matched_rep.rep_code if matched_rep else None,
            "existing_customer_id": existing_customer.id if existing_customer else None,
            "will_create": existing_customer is None,
            "opening_balance": str(account.opening_balance or 0),
        })
    return {"total_accounts": len(items), "to_create": sum(1 for item in items if item["will_create"]),
            "already_linked": sum(1 for item in items if not item["will_create"]), "items": items}


async def repair_legacy_customer_opening_balances(
    db: AsyncSession, tenant_id: str, actor_user_id: str | None = None,
) -> dict:
    """ترحيل أرصدة حسابات العملاء القديمة إلى قيود افتتاحية بشكل idempotent."""
    accounts = (await db.execute(
        select(Account).where(
            Account.tenant_id == tenant_id,
            Account.is_customer_account.is_(True),
            Account.opening_balance != 0,
        ).order_by(Account.code)
    )).scalars().all()
    customers = (await db.execute(
        select(Customer).where(Customer.tenant_id == tenant_id)
    )).scalars().all()
    customer_by_account = {customer.ar_account_id: customer for customer in customers if customer.ar_account_id}

    repaired = 0
    skipped = 0
    missing_customer = 0
    for account in accounts:
        customer = customer_by_account.get(account.id)
        if not customer:
            missing_customer += 1
            continue

        existing_entry = (await db.execute(
            select(JournalEntry.id)
            .join(JournalEntryLine, JournalEntryLine.entry_id == JournalEntry.id)
            .where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.source == "customer_opening_balance",
                JournalEntry.reference == customer.customer_number,
                JournalEntryLine.account_id == account.id,
            ).limit(1)
        )).scalar_one_or_none()
        if existing_entry:
            # القيد موجود؛ نصفر الحقل القديم فقط حتى لا يظهر الرصيد مرتين.
            account.opening_balance = Decimal("0")
            skipped += 1
            continue

        amount = Decimal(str(account.opening_balance or 0)).quantize(Decimal("0.01"))
        if amount == 0:
            continue
        await _create_customer_opening_journal(
            db, tenant_id, actor_user_id or "system", customer, account, amount,
        )
        account.opening_balance = Decimal("0")
        repaired += 1

    await db.commit()
    return {
        "repaired": repaired,
        "already_journaled": skipped,
        "missing_customer": missing_customer,
        "scanned": len(accounts),
    }


async def import_customers_from_chart(db: AsyncSession, tenant_id: str, actor_user_id: str) -> dict:
    """ينشئ سجلات العملاء من الحسابات النهائية مرة واحدة، دون تكرار."""
    preview = await preview_customer_account_import(db, tenant_id)
    created = []
    next_number = (await db.execute(select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id))).scalar() or 0
    accounts = (await db.execute(select(Account).where(Account.tenant_id == tenant_id))).scalars().all()
    account_by_id = {account.id: account for account in accounts}
    reps = (await db.execute(
        select(SalesRep, User).join(User, User.id == SalesRep.user_id).where(SalesRep.tenant_id == tenant_id)
    )).all()
    existing = (await db.execute(select(Customer).where(Customer.tenant_id == tenant_id))).scalars().all()
    existing_accounts = {customer.ar_account_id for customer in existing if customer.ar_account_id}
    existing_names = {_normalize_match_text(customer.name_ar) for customer in existing}
    for item in preview["items"]:
        if not item["will_create"] or item["account_id"] in existing_accounts or _normalize_match_text(item["name_ar"]) in existing_names:
            continue
        account = account_by_id[item["account_id"]]
        rep_id = item["rep_id"]
        next_number += 1
        customer = Customer(
            id=str(uuid.uuid4()), tenant_id=tenant_id, customer_number=f"CUS-{next_number:05d}",
            customer_type="company", name_ar=account.name_ar, name_en=account.name_ar,
            address_city=item["city"], rep_id=rep_id, ar_account_id=account.id,
            credit_limit=Decimal("0"), payment_terms_days=30, currency_code="SAR", is_active=True,
            notes="مستورد تلقائياً من شجرة الحسابات الافتراضية",
        )
        db.add(customer)
        await db.flush()
        if account.opening_balance and Decimal(str(account.opening_balance)) != 0:
            await _create_customer_opening_journal(db, tenant_id, actor_user_id, customer, account, Decimal(str(account.opening_balance)))
            account.opening_balance = Decimal("0")
        existing_accounts.add(account.id)
        existing_names.add(_normalize_match_text(account.name_ar))
        created.append({"customer_id": customer.id, "account_id": account.id, "name_ar": account.name_ar})
    await db.commit()
    return {"created": len(created), "skipped": preview["total_accounts"] - len(created), "items": created}


async def get_customer(db: AsyncSession, tenant_id: str, customer_id: str):
    c = await db.get(Customer, customer_id)
    if not c or c.tenant_id != tenant_id:
        raise HTTPException(404, "Customer not found")
    return c


async def _validate_customer_ar_account(
    db: AsyncSession, tenant_id: str, ar_account_id: str | None,
    *, required: bool = False,
) -> Account | None:
    """يتحقق من الحساب الرئيسي الذي سيحمل حساب العميل الفرعي."""
    if ar_account_id is None:
        if required:
            raise HTTPException(400, "يجب اختيار الحساب الرئيسي للعملاء من شجرة الحسابات")
        return None
    account = await db.get(Account, ar_account_id)
    if not account or account.tenant_id != tenant_id:
        raise HTTPException(400, "الحساب الرئيسي المختار غير موجود لهذه الشركة")
    if not account.is_active:
        raise HTTPException(400, "يجب اختيار حساب نشط من شجرة الحسابات")
    account_type = getattr(account, "account_type", None)
    nature = getattr(account, "nature", None)
    if account_type is None and (not account.is_posting or not account.is_customer_account):
        raise HTTPException(400, "يجب اختيار حساب رئيسي صالح من شجرة الحسابات")
    if account_type is not None and (account_type != AccountType.ASSET or nature != AccountNature.DEBIT):
        raise HTTPException(400, "يجب اختيار حساب عملاء مدين ضمن الأصول")
    return account


async def _next_customer_account_code(
    db: AsyncSession, tenant_id: str, parent: Account, exclude_account_id: str | None = None,
) -> str:
    """يعيد الرقم التالي من تسلسل الحسابات الموجودة تحت الأب المختار.

    أكواد العملاء في الشجرة الحالية تسلسل مسطح تحت فرع المدينة/المندوب، مثل
    01131136 ثم 01131137؛ لذلك لا نركب الكود من parent.code.
    """
    query = select(Account.code).where(
        Account.tenant_id == tenant_id,
        Account.parent_id == parent.id,
    )
    if exclude_account_id:
        query = query.where(Account.id != exclude_account_id)
    result = await db.execute(query)
    numeric_codes = [str(code) for code in result.scalars().all() if str(code).isdigit()]
    if numeric_codes:
        width = max(len(code) for code in numeric_codes)
        return str(max(int(code) for code in numeric_codes) + 1).zfill(width)

    # لا نغيّر قاعدة الفروع القديمة عند عدم وجود أبناء بعد؛ هذا fallback
    # يحافظ على كود الأب كجذر تسلسلي إلى أن يتوفر أول كود فعلي.
    return f"{parent.code}001"


async def _create_customer_opening_journal(
    db: AsyncSession, tenant_id: str, user_id: str, customer: Customer,
    customer_account: Account, opening_balance: Decimal,
) -> str | None:
    """ينشئ قيداً افتتاحياً مرحلاً للرصيد المنقول من النظام السابق."""
    amount = Decimal(str(opening_balance or 0)).quantize(Decimal("0.01"))
    if amount == 0:
        return None
    from app.models.accounting import (
        FiscalYear, FiscalYearStatus, JournalEntry, JournalEntryLine,
        JournalEntryStatus,
    )
    from app.modules.accounting.service import _next_entry_number, get_operational_account

    entry_date = datetime.utcnow()
    fiscal_result = await db.execute(
        select(FiscalYear).where(
            FiscalYear.tenant_id == tenant_id,
            FiscalYear.start_date <= entry_date,
            FiscalYear.end_date >= entry_date,
            FiscalYear.status == FiscalYearStatus.OPEN,
        ).order_by(FiscalYear.is_default.desc(), FiscalYear.start_date.desc()).limit(1)
    )
    fiscal_year = fiscal_result.scalar_one_or_none()
    if not fiscal_year:
        # إنشاء سنة مالية مفتوحة تلقائياً إذا لم تكن الشركة أعدتها بعد.
        fiscal_year = FiscalYear(
            id=str(uuid.uuid4()), tenant_id=tenant_id,
            name=f"السنة المالية {entry_date.year}",
            start_date=datetime(entry_date.year, 1, 1),
            end_date=datetime(entry_date.year, 12, 31, 23, 59, 59),
            status=FiscalYearStatus.OPEN, is_default=True,
        )
        db.add(fiscal_year)
        await db.flush()

    journal_user_id = user_id
    if not journal_user_id or journal_user_id == "system":
        user_result = await db.execute(select(User.id).where(User.tenant_id == tenant_id).order_by(User.created_at).limit(1))
        journal_user_id = user_result.scalar_one_or_none()
    if not journal_user_id:
        raise HTTPException(400, "لا يوجد مستخدم صالح لتسجيل قيد الرصيد الافتتاحي")

    try:
        offset_account = await get_operational_account(db, tenant_id, "capital")
    except HTTPException:
        # يسمح للشركة الجديدة باستخدام أول حساب حقوق ملكية قابل للقيد
        # إذا لم تتم تهيئة ربط حساب رأس المال بعد.
        offset_account = None
    offset_account_id = offset_account.id if offset_account else None
    if not offset_account_id:
        offset_result = await db.execute(
            select(Account).where(
                Account.tenant_id == tenant_id,
                Account.account_type == AccountType.EQUITY,
                Account.is_active.is_(True),
                Account.is_posting.is_(True),
                Account.allow_direct_posting.is_(True),
            ).order_by(Account.code).limit(1)
        )
        offset_account = offset_result.scalar_one_or_none()
        offset_account_id = offset_account.id if offset_account else None
    if not offset_account_id:
        raise HTTPException(400, "لا يوجد حساب مقابل صالح لقيد الرصيد الافتتاحي")

    debit_account_id = customer_account.id if amount > 0 else offset_account_id
    credit_account_id = offset_account_id if amount > 0 else customer_account.id
    value = abs(amount)
    entry_number = await _next_entry_number(db, tenant_id)
    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id, entry_number=entry_number,
        entry_date=entry_date, fiscal_year_id=fiscal_year.id,
        description_ar=f"رصيد افتتاحي للعميل: {customer.name_ar}",
        description_en=f"Opening balance - customer: {customer.name_en or customer.name_ar}",
        status=JournalEntryStatus.POSTED, source="customer_opening_balance",
        reference=customer.customer_number, total_debit=value, total_credit=value,
        created_by=journal_user_id, posted_by=journal_user_id, posted_at=entry_date,
    )
    db.add(entry)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id, account_id=debit_account_id,
        description=f"رصيد افتتاحي {customer.customer_number}", debit=value, credit=Decimal("0"), line_order=0,
    ))
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id, account_id=credit_account_id,
        description=f"مقابل رصيد افتتاحي {customer.customer_number}", debit=Decimal("0"), credit=value, line_order=1,
    ))
    await db.flush()
    return entry.id


async def create_customer(
    db: AsyncSession, tenant_id: str, data: CustomerCreate,
    rep_id: str | None = None, actor_user_id: str | None = None,
):
    selected_parent_account_id = data.ar_account_id
    if not selected_parent_account_id and rep_id:
        rep = await db.get(SalesRep, rep_id)
        if not rep or rep.tenant_id != tenant_id:
            raise HTTPException(400, "المندوب غير تابع لهذه الشركة")
        selected_parent_account_id = rep.customer_account_id
        if not selected_parent_account_id:
            raise HTTPException(400, "لم يتم ربط حساب لهذا المندوب. اطلب من المدير تحديد المدينة والحساب أولاً")
    parent_account = await _validate_customer_ar_account(db, tenant_id, selected_parent_account_id, required=True)
    customer_id = str(uuid.uuid4())
    customer_number = await _next_customer_number(db, tenant_id)
    customer_data = data.model_dump(exclude={"ar_account_id", "opening_balance"})
    customer = Customer(
        id=customer_id,
        tenant_id=tenant_id,
        customer_number=customer_number,
        rep_id=rep_id,
        ar_account_id=None,
        **customer_data,
    )
    db.add(customer)
    account = Account(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        code=await _next_customer_account_code(db, tenant_id, parent_account),
        name_ar=data.name_ar,
        name_en=data.name_en or data.name_ar,
        account_type=AccountType.ASSET,
        nature=AccountNature.DEBIT,
        parent_id=parent_account.id,
        level=parent_account.level + 1,
        is_active=True,
        is_posting=True,
        allow_direct_posting=True,
        is_customer_account=True,
        # الرصيد سيظهر من خلال قيد اليومية الافتتاحي، وليس كرصد مباشر مكرر على الحساب.
        opening_balance=Decimal("0"),
        notes=f"حساب العميل {customer_number}",
    )
    db.add(account)
    customer.ar_account_id = account.id
    if data.opening_balance:
        await _create_customer_opening_journal(
            db, tenant_id, actor_user_id or "system", customer, account, data.opening_balance,
        )
    record_audit(db, tenant_id, actor_user_id, "create", "customer", customer.id,
                 customer_number=customer.customer_number, ar_account_id=account.id, rep_id=rep_id)
    await db.commit()
    await db.refresh(customer)
    return customer


async def update_customer(
    db: AsyncSession, tenant_id: str, customer_id: str, data: CustomerUpdate,
    actor_user_id: str | None = None,
):
    c = await get_customer(db, tenant_id, customer_id)
    opening_balance_requested = "opening_balance" in data.model_fields_set
    opening_balance = Decimal(str(data.opening_balance or 0)).quantize(Decimal("0.01")) if opening_balance_requested else None
    # نستخدم exclude_unset بدل exclude_none حتى تُحفظ None المرسلة صراحة لمسح
    # الرقم الضريبي أو الموقع أو أي حقل اختياري من سجل العميل.
    updates = data.model_dump(exclude_unset=True)
    # الرصيد الافتتاحي ليس حقلاً يُخزن على العميل؛ بل يُترجم إلى قيد محاسبي.
    updates.pop("opening_balance", None)
    # عند تغيير الحساب الرئيسي ننقل حساب العميل المحاسبي نفسه، لا سجل العميل فقط.
    # هذا يحافظ على ارتباط العميل بالشجرة ويولد كودًا تابعًا للأب الجديد.
    if "ar_account_id" in data.model_fields_set:
        new_parent = await _validate_customer_ar_account(db, tenant_id, data.ar_account_id)
        if data.ar_account_id and data.ar_account_id != c.ar_account_id:
            customer_account = await db.get(Account, c.ar_account_id) if c.ar_account_id else None
            if customer_account and new_parent:
                customer_account.parent_id = new_parent.id
                customer_account.level = new_parent.level + 1
                customer_account.code = await _next_customer_account_code(
                    db, tenant_id, new_parent, exclude_account_id=customer_account.id,
                )
                customer_account.name_ar = c.name_ar
                customer_account.name_en = c.name_en or c.name_ar
        updates["ar_account_id"] = data.ar_account_id
    changed_fields = list(updates.keys())
    for k, v in updates.items():
        setattr(c, k, v)
    # الواجهة القديمة ترسل صفراً افتراضياً عند تعديل بيانات أخرى؛ لا نعتبره طلباً لمسح قيد قائم.
    if opening_balance_requested and opening_balance != 0:
        if not c.ar_account_id:
            raise HTTPException(400, "لا يوجد حساب مرتبط بهذا العميل لإنشاء قيد الرصيد الافتتاحي")
        customer_account = await db.get(Account, c.ar_account_id)
        if not customer_account or customer_account.tenant_id != tenant_id:
            raise HTTPException(400, "حساب العميل غير صالح لإنشاء قيد الرصيد الافتتاحي")

        # احذف أي قيد افتتاحي سابق لهذا العميل قبل إعادة بنائه بالقيمة الجديدة.
        old_entry_ids = (await db.execute(
            select(JournalEntry.id)
            .join(JournalEntryLine, JournalEntryLine.entry_id == JournalEntry.id)
            .where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.source == "customer_opening_balance",
                JournalEntry.reference == c.customer_number,
                JournalEntryLine.account_id == customer_account.id,
            )
            .distinct()
        )).scalars().all()
        if old_entry_ids:
            await db.execute(delete(JournalEntryLine).where(JournalEntryLine.entry_id.in_(old_entry_ids)))
            await db.execute(delete(JournalEntry).where(JournalEntry.id.in_(old_entry_ids)))

        if opening_balance:
            await db.flush()
            await _create_customer_opening_journal(
                db, tenant_id, actor_user_id or "system", c, customer_account, opening_balance,
            )
        changed_fields.append("opening_balance")

    record_audit(db, tenant_id, actor_user_id, "update", "customer", c.id,
                 changed_fields=changed_fields)
    await db.commit()
    await db.refresh(c)
    return c


async def delete_customer(
    db: AsyncSession, tenant_id: str, customer_id: str, actor_user_id: str | None = None,
):
    """يحذف العميل الذي لا يملك حركة مالية فقط؛ السجل المالي لا يحذف."""
    customer = await get_customer(db, tenant_id, customer_id)
    invoice_count = (await db.execute(select(func.count(Invoice.id)).where(
        Invoice.tenant_id == tenant_id, Invoice.customer_id == customer.id
    ))).scalar() or 0
    if invoice_count:
        raise HTTPException(400, "لا يمكن حذف عميل لديه فواتير أو ذمم؛ أوقفه بدلاً من ذلك")
    record_audit(db, tenant_id, actor_user_id, "delete", "customer", customer.id,
                 customer_number=customer.customer_number)
    await db.delete(customer)
    await db.commit()
    return {"message": "تم حذف العميل", "id": customer_id}


# ─── Invoices ────────────────────────────────────────────────────────
async def get_invoices(db: AsyncSession, tenant_id: str, status: str | None = None,
                        customer_id: str | None = None, rep_id: str | None = None,
                        include_unconfirmed: bool = False):
    """قائمة الفواتير المالية.

    المدير والتقارير يرون الفواتير التي اكتملت دورتها المالية فقط. أما المندوب
    فيحتاج الوصول إلى مسوداته والفواتير المعادة أو قيد المراجعة عبر include_unconfirmed.
    """
    from sqlalchemy.orm import selectinload
    financial_statuses = (
        InvoiceStatus.CONFIRMED,
        InvoiceStatus.PAID,
        InvoiceStatus.PARTIAL,
        InvoiceStatus.OVERDUE,
    )
    q = select(Invoice).options(selectinload(Invoice.lines), selectinload(Invoice.payments)).where(Invoice.tenant_id == tenant_id)
    financial_status_values = {item.value for item in financial_statuses}
    if status and (include_unconfirmed or status in financial_status_values):
        q = q.where(Invoice.status == status)
    elif not include_unconfirmed:
        # لا يعيد هذا المسار العام submitted أو draft أو rejected للمدير
        # ولو أُرسلت الحالة يدويًا؛ لها مسارات تشغيل ومراجعة مستقلة.
        q = q.where(Invoice.status.in_(financial_statuses))
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

    if data.invoice_payment_method == InvoicePaymentMethod.CREDIT:
        if data.credit_days not in (21, 30):
            raise HTTPException(400, "مدة الآجل المسموحة هي 21 أو 30 يومًا فقط")
        if not data.due_date:
            raise HTTPException(400, "يجب تحديد تاريخ الاستحقاق للفاتورة الآجلة")
    else:
        # النقد والتحويل والشيك لا يحمل مدة آجل تلقائيًا.
        data.due_date = None
        data.credit_days = None

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

    record_audit(db, tenant_id, user_id, "create", "invoice", invoice.id,
                 invoice_number=invoice.invoice_number, customer_id=invoice.customer_id,
                 line_count=len(lines_data), total=invoice.total, rep_id=invoice.rep_id)
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def confirm_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    """تأكيد الفاتورة — تقبل draft أو approved"""
    invoice = await get_invoice(db, tenant_id, invoice_id)
    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.APPROVED):
        raise HTTPException(400, f"لا يمكن تأكيد فاتورة بحالة '{invoice.status.value}'")

    if invoice.fiscal_year_id and await is_operational_auto_posting_enabled(db, tenant_id):
        journal_id = await _create_invoice_journal(db, tenant_id, user_id, invoice)
        invoice.journal_entry_id = journal_id

    try:
        await _deduct_inventory_for_invoice(db, tenant_id, user_id, invoice)
    except Exception:
        await db.rollback()
        raise

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
                        warehouse_id=warehouse_id,
                        user_id=user_id,
                        auto_commit=False,
                    )
                except HTTPException as e:
                    raise HTTPException(400, f"خطأ في خصم السيريال {sid}: {e.detail}")
            continue

        # ── السيريال الواحد (legacy) ────────────────────────────────────
        if line.serial_item_id:
            try:
                await sell_serial(
                    db=db,
                    tenant_id=tenant_id,
                    serial_id=line.serial_item_id,
                    sale_price=line.unit_price,
                    invoice_id=invoice.id,
                    warehouse_id=warehouse_id,
                    user_id=user_id,
                    auto_commit=False,
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
    from app.modules.accounting.service import _next_entry_number, get_vat_settings, get_operational_account

    vat_settings = await get_vat_settings(db, tenant_id)

    # نحتاج حسابات: حسابات القبض، الإيرادات، ضريبة القيمة المضافة
    customer = await db.get(Customer, invoice.customer_id)
    ar_account_id = customer.ar_account_id if customer else None
    if not ar_account_id:
        ar_account_id = await get_operational_account(db, tenant_id, "default_ar")

    if not ar_account_id:
        return None  # لا يمكن إنشاء القيد بدون حساب القبض

    # الحساب التشغيلي المحدد من خريطة الشجرة، مع fallback للتوافق القديم.
    revenue_account_id = await get_operational_account(db, tenant_id, "sales_goods")
    if not revenue_account_id:
        revenue_r = await db.execute(
            select(Account).where(
                Account.tenant_id == tenant_id,
                Account.account_type == AccountType.REVENUE,
                Account.is_active == True,
                Account.is_posting == True,
                Account.allow_direct_posting == True,
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


async def cancel_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    invoice = await get_invoice(db, tenant_id, invoice_id)
    if invoice.status in (InvoiceStatus.PAID, InvoiceStatus.CANCELLED):
        raise HTTPException(400, "Cannot cancel this invoice")

    # إرجاع السيريالات التي خصمتها هذه الفاتورة فقط.
    # الفاتورة تحت المراجعة لم تخصم شيئًا، لذلك لا ينتج عنها إرجاع.
    lines_r = await db.execute(select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id))
    for line in lines_r.scalars().all():
        serial_ids = []
        if line.serial_ids_json:
            serial_ids.extend(json.loads(line.serial_ids_json) or [])
        if line.serial_item_id:
            serial_ids.append(line.serial_item_id)

        for serial_id in serial_ids:
            serial = await db.get(SerialItem, serial_id, with_for_update=True)
            if not serial or serial.sale_invoice_id != invoice.id:
                continue
            if getattr(serial.status, "value", serial.status) != "sold":
                continue
            serial.status = "in_stock"
            serial.sale_invoice_id = None
            serial.sold_at = None
            db.add(StockMovement(
                id=str(uuid.uuid4()), tenant_id=tenant_id,
                product_id=serial.product_id,
                warehouse_id=serial.warehouse_id,
                movement_type="return_in", quantity=Decimal("1"),
                unit_cost=serial.cost_price, serial_item_id=serial.id,
                reference_type="invoice_cancel", reference_id=invoice.id,
                created_by=user_id,
            ))

    invoice.status = InvoiceStatus.CANCELLED
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


# ─── Payments ────────────────────────────────────────────────────────
async def get_payments(
    db: AsyncSession,
    tenant_id: str,
    invoice_id: str | None = None,
    rep_id: str | None = None,
):
    """جلب سندات القبض مع اسم العميل والمندوب ورقم الفاتورة إن وجد."""
    linked_rep_id = func.coalesce(Payment.rep_id, Invoice.rep_id, Customer.rep_id)
    q = (
        select(Payment, Customer.name_ar, linked_rep_id, SalesRep.rep_code, User.full_name, Invoice.invoice_number)
        .join(Customer, Customer.id == Payment.customer_id)
        .outerjoin(Invoice, Invoice.id == Payment.invoice_id)
        .outerjoin(SalesRep, SalesRep.id == linked_rep_id)
        .outerjoin(User, User.id == SalesRep.user_id)
        .where(Payment.tenant_id == tenant_id)
    )
    if invoice_id:
        q = q.where(Payment.invoice_id == invoice_id)
    if rep_id:
        q = q.where(linked_rep_id == rep_id)
    q = q.order_by(Payment.payment_date.desc(), Payment.payment_number.desc())
    rows = (await db.execute(q)).all()
    return [
        {
            "id": payment.id,
            "payment_number": payment.payment_number,
            "invoice_id": payment.invoice_id,
            "customer_id": payment.customer_id,
            "customer_name_ar": customer_name,
            "rep_id": linked_rep_id,
            "rep_code": linked_rep_code,
            "rep_name": rep_name,
            "invoice_number": invoice_number,
            "payment_date": payment.payment_date,
            "amount": payment.amount,
            "payment_method": payment.payment_method,
            "reference": payment.reference,
            "bank_account_id": payment.bank_account_id,
            "journal_entry_id": payment.journal_entry_id,
            "created_at": payment.created_at,
            "notes": payment.notes,
        }
        for payment, customer_name, linked_rep_id, linked_rep_code, rep_name, invoice_number in rows
    ]


async def get_payment(
    db: AsyncSession,
    tenant_id: str,
    payment_id: str,
    rep_id: str | None = None,
):
    """جلب سند قبض واحد، مع منع المندوب من رؤية سند خارج نطاقه."""
    rows = await get_payments(db, tenant_id)
    payment = next((item for item in rows if item["id"] == payment_id), None)
    if not payment:
        raise HTTPException(404, "سند القبض غير موجود")
    if rep_id and payment.get("rep_id") != rep_id:
        raise HTTPException(403, "لا يمكنك عرض سند قبض لمندوب آخر")
    return payment


async def update_payment(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payment_id: str,
    data,
):
    """تعديل سند قبض من الإدارة مع إبقاء الفاتورة والقيد متطابقين."""
    payment = await db.scalar(
        select(Payment).where(Payment.id == payment_id, Payment.tenant_id == tenant_id)
    )
    if not payment:
        raise HTTPException(404, "سند القبض غير موجود")

    customer = await db.scalar(
        select(Customer).where(Customer.id == payment.customer_id, Customer.tenant_id == tenant_id)
    )
    if not customer:
        raise HTTPException(409, "العميل المرتبط بالسند غير موجود")
    invoice = None
    if payment.invoice_id:
        invoice = await db.scalar(
            select(Invoice).where(Invoice.id == payment.invoice_id, Invoice.tenant_id == tenant_id)
        )
        if not invoice:
            raise HTTPException(409, "الفاتورة المرتبطة بالسند غير موجودة")

    changes = data.model_dump(exclude_unset=True)
    old_amount = Decimal(str(payment.amount or 0))
    new_amount = Decimal(str(changes.get("amount", old_amount)))
    if new_amount <= Decimal("0"):
        raise HTTPException(400, "يجب أن يكون مبلغ السند أكبر من صفر")

    new_date = changes.get("payment_date", payment.payment_date)
    if new_date:
        new_date = new_date.replace(tzinfo=None)

    new_method = changes.get("payment_method", payment.payment_method)
    if payment.journal_entry_id and new_method != payment.payment_method:
        raise HTTPException(409, "لا يمكن تغيير طريقة الدفع بعد ترحيل القيد المحاسبي")

    if invoice:
        paid_without_current = Decimal(str(invoice.paid_amount or 0)) - old_amount
        if paid_without_current < Decimal("0"):
            paid_without_current = Decimal("0")
        if new_amount > Decimal(str(invoice.total or 0)) - paid_without_current + Decimal("0.01"):
            raise HTTPException(400, "المبلغ أكبر من المتبقي على الفاتورة")
    else:
        from app.modules.sales.orders_service import get_customer_statement
        statement = await get_customer_statement(
            db, tenant_id, customer.id,
            datetime(1970, 1, 1),
            max(payment.payment_date, new_date),
        )
        available = Decimal(str(statement["summary"].get("closing_balance") or 0)) + old_amount
        if new_amount > available + Decimal("0.01"):
            raise HTTPException(400, "المبلغ أكبر من رصيد العميل المتاح")

    payment.amount = new_amount
    payment.payment_date = new_date
    if "payment_method" in changes:
        payment.payment_method = new_method
    if "reference" in changes:
        payment.reference = changes["reference"]
    if "notes" in changes:
        payment.notes = changes["notes"]

    if invoice:
        invoice.paid_amount = Decimal(str(invoice.paid_amount or 0)) - old_amount + new_amount
        if invoice.paid_amount >= Decimal(str(invoice.total or 0)) - Decimal("0.01"):
            invoice.status = InvoiceStatus.PAID
        elif invoice.paid_amount > Decimal("0"):
            invoice.status = InvoiceStatus.PARTIAL
        else:
            invoice.status = InvoiceStatus.CONFIRMED

    if payment.journal_entry_id:
        entry = await db.scalar(
            select(JournalEntry).where(
                JournalEntry.id == payment.journal_entry_id,
                JournalEntry.tenant_id == tenant_id,
            )
        )
        if not entry:
            raise HTTPException(409, "القيد المحاسبي المرتبط بالسند غير موجود")
        entry.entry_date = new_date
        entry.total_debit = new_amount
        entry.total_credit = new_amount
        line_result = await db.execute(
            select(JournalEntryLine)
            .where(JournalEntryLine.entry_id == entry.id)
            .order_by(JournalEntryLine.line_order.asc())
        )
        lines = line_result.scalars().all()
        if len(lines) < 2:
            raise HTTPException(409, "القيد المحاسبي المرتبط بالسند غير مكتمل")
        lines[0].debit = new_amount
        lines[0].credit = Decimal("0")
        lines[1].debit = Decimal("0")
        lines[1].credit = new_amount

        from app.models.treasury import Voucher, VoucherStatus
        voucher = await db.scalar(
            select(Voucher).where(
                Voucher.tenant_id == tenant_id,
                Voucher.reference == payment.payment_number,
                Voucher.status != VoucherStatus.CANCELLED,
            )
        )
        if voucher:
            voucher.voucher_date = new_date
            voucher.amount = new_amount

    await db.commit()
    return await get_payment(db, tenant_id, payment_id)


async def _get_open_fiscal_year_id(db: AsyncSession, tenant_id: str, payment_date: datetime) -> str | None:
    from app.models.accounting import FiscalYear, FiscalYearStatus
    result = await db.execute(
        select(FiscalYear.id)
        .where(
            FiscalYear.tenant_id == tenant_id,
            FiscalYear.status == FiscalYearStatus.OPEN,
            FiscalYear.start_date <= payment_date,
            FiscalYear.end_date >= payment_date,
        )
        .order_by(FiscalYear.is_default.desc(), FiscalYear.start_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_payment(db: AsyncSession, tenant_id: str, user_id: str, data: PaymentCreate):
    if not data.invoice_id and not data.customer_id:
        raise HTTPException(400, "يجب اختيار فاتورة أو عميل لتحصيل الرصيد")
    if data.amount <= Decimal("0"):
        raise HTTPException(400, "يجب أن يكون مبلغ السند أكبر من صفر")

    invoice = await get_invoice(db, tenant_id, data.invoice_id) if data.invoice_id else None
    customer_id = data.customer_id or (invoice.customer_id if invoice else None)
    if not customer_id:
        raise HTTPException(400, "يجب اختيار عميل صالح")
    customer = await get_customer(db, tenant_id, customer_id)
    if invoice and invoice.status == InvoiceStatus.CANCELLED:
        raise HTTPException(400, "لا يمكن التحصيل من فاتورة ملغاة")
    if invoice and data.customer_id and data.customer_id != invoice.customer_id:
        raise HTTPException(400, "العميل لا يطابق العميل الموجود في الفاتورة")

    # المندوب لا يستطيع التحصيل إلا من عملائه، ويرث السند رقم المندوب.
    rep = await db.scalar(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.user_id == user_id))
    if rep:
        expected_rep_id = (invoice.rep_id if invoice and invoice.rep_id else customer.rep_id)
        if expected_rep_id != rep.id:
            raise HTTPException(403, "لا يمكنك إنشاء سند لهذا العميل أو لهذه الفاتورة")
        payment_rep_id = rep.id
    else:
        payment_rep_id = invoice.rep_id if invoice else customer.rep_id

    payment_date = data.payment_date.replace(tzinfo=None)
    if invoice:
        remaining = Decimal(str(invoice.total or 0)) - Decimal(str(invoice.paid_amount or 0))
        if data.amount > remaining + Decimal("0.01"):
            raise HTTPException(400, f"المبلغ أكبر من المتبقي على الفاتورة ({remaining:.2f})")
    else:
        # السند المباشر لا يُسمح به إلا مقابل رصيد قائم، بما فيه الرصيد الافتتاحي
        # والقيود المرحّلة والفواتير السابقة ناقص سندات القبض.
        from app.modules.sales.orders_service import get_customer_statement
        statement = await get_customer_statement(
            db, tenant_id, customer.id,
            datetime(1970, 1, 1), payment_date,
        )
        balance_due = Decimal(str(statement["summary"].get("closing_balance") or 0))
        if balance_due <= Decimal("0.01"):
            raise HTTPException(400, "لا يوجد رصيد مستحق على هذا العميل")
        if data.amount > balance_due + Decimal("0.01"):
            raise HTTPException(400, f"المبلغ أكبر من رصيد العميل ({balance_due:.2f})")
    fiscal_year_id = invoice.fiscal_year_id if invoice else await _get_open_fiscal_year_id(db, tenant_id, payment_date)
    payment = Payment(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        payment_number=await _next_payment_number(db, tenant_id),
        invoice_id=invoice.id if invoice else None,
        customer_id=customer.id,
        rep_id=payment_rep_id,
        payment_date=payment_date,
        amount=data.amount,
        payment_method=data.payment_method,
        reference=data.reference,
        bank_account_id=data.bank_account_id,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(payment)

    if invoice:
        invoice.paid_amount += data.amount
        remaining = invoice.total - invoice.paid_amount
        if remaining <= Decimal("0.01"):
            invoice.status = InvoiceStatus.PAID
        elif invoice.paid_amount > 0:
            invoice.status = InvoiceStatus.PARTIAL

    # قيد سند القبض يخصم من حساب العميل سواء كان التحصيل على فاتورة أو على الرصيد المباشر.
    if fiscal_year_id and await is_operational_auto_posting_enabled(db, tenant_id):
        journal_id = await _create_payment_journal(
            db, tenant_id, user_id, payment, customer, invoice, fiscal_year_id, data.bank_account_id
        )
        if not journal_id:
            raise HTTPException(409, "تعذر ترحيل سند القبض: تحقق من ربط حساب العميل وحساب الصندوق/البنك")
        payment.journal_entry_id = journal_id

    await db.commit()
    await db.refresh(payment)
    return payment


async def _create_payment_journal(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    payment: Payment,
    customer: Customer,
    invoice: Invoice | None,
    fiscal_year_id: str,
    bank_account_id: str | None,
) -> str | None:
    """قيد سند القبض: مدين نقد/بنك، دائن حساب العميل، بفاتورة أو بدونها."""
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import _next_entry_number, get_operational_account

    ar_account_id = customer.ar_account_id
    if not ar_account_id:
        return None

    debit_account_id = None
    if bank_account_id:
        from app.models.accounting import BankAccount
        bank = await db.get(BankAccount, bank_account_id)
        if bank and bank.tenant_id == tenant_id and bank.gl_account_id:
            debit_account_id = bank.gl_account_id

    # المندوب لا يختار حساب الصندوق من الشاشة؛ استخدم خريطة الحسابات التشغيلية.
    if not debit_account_id:
        method_key = payment.payment_method.value if hasattr(payment.payment_method, "value") else str(payment.payment_method)
        mapping_key = {
            "cash": "default_cash",
            "bank_transfer": "default_bank",
            "cheque": "default_bank",
            "credit_card": "default_card",
            "mada": "default_card",
            "stc_pay": "default_wallet",
        }.get(method_key, "default_cash")
        try:
            debit_account = await get_operational_account(db, tenant_id, mapping_key)
            debit_account_id = debit_account.id
        except HTTPException:
            # إذا لم يوجد ربط للطريقة المحددة، لا ننشئ قيدًا غير متوازن.
            return None

    method_ar = {
        "cash": "نقداً",
        "bank_transfer": "تحويل بنكي",
        "cheque": "شيك",
        "mada": "مدى",
        "stc_pay": "STC Pay",
        "credit_card": "بطاقة ائتمان",
    }.get(payment.payment_method.value if hasattr(payment.payment_method, "value") else str(payment.payment_method), "دفع")
    customer_name = customer.name_ar
    invoice_label = f"فاتورة {invoice.invoice_number}" if invoice else "الرصيد الافتتاحي/رصيد العميل"

    entry_number = await _next_entry_number(db, tenant_id)
    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id, entry_number=entry_number,
        entry_date=payment.payment_date, fiscal_year_id=fiscal_year_id,
        description_ar=f"سند قبض {payment.payment_number} - {customer_name} - {invoice_label} - {method_ar}",
        description_en=f"Payment Receipt {payment.payment_number} - {invoice_label}",
        status=JournalEntryStatus.POSTED, source="payment_receipt",
        reference=payment.payment_number, total_debit=payment.amount, total_credit=payment.amount,
        created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow(),
    )
    db.add(entry)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id, account_id=debit_account_id,
        description=f"استلام دفعة - {method_ar}", debit=payment.amount,
        credit=Decimal("0"), line_order=0,
    ))
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id, account_id=ar_account_id,
        description=f"تسوية {invoice_label}", debit=Decimal("0"),
        credit=payment.amount, line_order=1,
    ))

    await _create_receipt_voucher(
        db, tenant_id, user_id, payment, customer, invoice, bank_account_id,
        ar_account_id, debit_account_id, fiscal_year_id, method_ar,
    )
    return entry.id


async def _create_receipt_voucher(
    db, tenant_id, user_id, payment, customer, invoice, bank_account_id,
    ar_account_id, debit_account_id, fiscal_year_id, method_ar,
):
    """إنشاء سند قبض خزينة، مع ربط اختياري بفاتورة."""
    from app.models.treasury import Voucher, VoucherType, VoucherStatus
    from app.modules.treasury.service import _next_number

    voucher_num = await _next_number(db, tenant_id, VoucherType.RECEIPT)
    invoice_label = f"فاتورة {invoice.invoice_number}" if invoice else "الرصيد الافتتاحي/رصيد العميل"
    voucher = Voucher(
        id=str(uuid.uuid4()), tenant_id=tenant_id, voucher_number=voucher_num,
        voucher_type=VoucherType.RECEIPT, status=VoucherStatus.POSTED,
        voucher_date=payment.payment_date, amount=payment.amount, vat_amount=Decimal("0"),
        currency_code="SAR", payment_method=payment.payment_method,
        bank_account_id=bank_account_id, party_type="customer", party_id=str(customer.id),
        party_name=customer.name_ar, invoice_id=str(invoice.id) if invoice else None,
        debit_account_id=debit_account_id, credit_account_id=ar_account_id,
        fiscal_year_id=fiscal_year_id,
        description_ar=f"سند قبض — {customer.name_ar} — {invoice_label} — {method_ar}",
        reference=payment.payment_number, created_by=user_id,
        posted_by=user_id, posted_at=datetime.utcnow(),
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
    """إنشاء إشعار دائن متزن، مرتبط بسطر الفاتورة ووحداته المتسلسلة عند الحاجة."""
    original = await get_invoice(db, tenant_id, data.original_invoice_id)
    if not data.lines:
        raise HTTPException(400, "يجب أن يحتوي المرتجع على سطر واحد على الأقل")

    # يعتمد المرتجع الجديد على هوية السطر، لا على وصفه. تبقى مطابقة الوصف أدناه
    # لاستيعاب إشعارات تاريخية لم يكن لها هذا الحقل فقط.
    original_by_id = {line.id: line for line in original.lines}
    duplicate_ids = [line.original_invoice_line_id for line in data.lines]
    if len(duplicate_ids) != len(set(duplicate_ids)):
        raise HTTPException(400, "لا يمكن تكرار سطر الفاتورة الأصلي داخل المرتجع نفسه")

    previous_rows = await db.execute(
        select(
            CreditNoteLine.original_invoice_line_id,
            CreditNoteLine.description_ar,
            func.coalesce(func.sum(CreditNoteLine.quantity), 0),
        )
        .join(CreditNote)
        .where(CreditNote.tenant_id == tenant_id, CreditNote.original_invoice_id == original.id)
        .group_by(CreditNoteLine.original_invoice_line_id, CreditNoteLine.description_ar)
    )
    returned_qty: dict[str, Decimal] = {}
    descriptions_count: dict[str, int] = {}
    for source_line in original.lines:
        descriptions_count[source_line.description_ar] = descriptions_count.get(source_line.description_ar, 0) + 1
    for original_line_id, description_ar, quantity in previous_rows.all():
        if original_line_id:
            returned_qty[original_line_id] = returned_qty.get(original_line_id, Decimal("0")) + Decimal(str(quantity))
        elif descriptions_count.get(description_ar, 0) == 1:
            # توافق محدود مع سجل قديم لا يحمل الهوية؛ لا يستخدم مع الفواتير ذات الوصف المكرر.
            fallback_id = next(line.id for line in original.lines if line.description_ar == description_ar)
            returned_qty[fallback_id] = returned_qty.get(fallback_id, Decimal("0")) + Decimal(str(quantity))

    previous_serial_rows = await db.execute(
        select(CreditNoteLine.original_invoice_line_id, CreditNoteLine.serial_ids_json)
        .join(CreditNote)
        .where(
            CreditNote.tenant_id == tenant_id,
            CreditNote.original_invoice_id == original.id,
            CreditNoteLine.serial_ids_json.isnot(None),
        )
    )
    returned_serial_ids: set[str] = set()
    for _source_line_id, serial_json in previous_serial_rows.all():
        try:
            returned_serial_ids.update(str(serial_id) for serial_id in json.loads(serial_json or "[]"))
        except (TypeError, ValueError):
            # لا تُهمل الخطأ بصمت في الإشعارات الجديدة؛ هذا المسار للحفاظ على قراءة السجل التاريخي فقط.
            continue

    from app.modules.inventory.service import get_item
    validated_lines: list[tuple[object, InvoiceLine, list[str], Decimal, Decimal, Decimal]] = []
    taxable_total = Decimal("0")
    total_vat = Decimal("0")
    total = Decimal("0")
    for line in data.lines:
        original_line = original_by_id.get(line.original_invoice_line_id)
        if not original_line:
            raise HTTPException(400, "سطر المرتجع لا ينتمي إلى الفاتورة الأصلية")
        quantity = Decimal(str(line.quantity))
        if quantity <= 0:
            raise HTTPException(400, "كمية المرتجع يجب أن تكون أكبر من صفر")
        if quantity + returned_qty.get(original_line.id, Decimal("0")) > Decimal(str(original_line.quantity)):
            raise HTTPException(400, f"كمية المرتجع للصنف '{original_line.description_ar}' تتجاوز الكمية المتاحة للمرتجع")
        if line.inventory_item_id and line.inventory_item_id != original_line.inventory_item_id:
            raise HTTPException(400, "الصنف المرتجع لا يطابق سطر الفاتورة الأصلية")
        if line.variant_id and line.variant_id != original_line.variant_id:
            raise HTTPException(400, "متغير الصنف المرتجع لا يطابق سطر الفاتورة الأصلية")

        serial_ids = list(dict.fromkeys(str(serial_id) for serial_id in (line.serial_ids or [])))
        if original_line.inventory_item_id:
            item = await get_item(db, tenant_id, original_line.inventory_item_id)
            tracking_type = getattr(item.tracking_type, "value", item.tracking_type)
            if tracking_type == "serial":
                expected_ids: set[str] = set()
                if original_line.serial_item_id:
                    expected_ids.add(str(original_line.serial_item_id))
                try:
                    expected_ids.update(str(serial_id) for serial_id in json.loads(original_line.serial_ids_json or "[]"))
                except (TypeError, ValueError):
                    raise HTTPException(400, "بيانات سيريالات الفاتورة الأصلية غير صالحة")
                if not serial_ids:
                    raise HTTPException(400, f"حدد السيريال المرتجع للصنف '{original_line.description_ar}'")
                if Decimal(len(serial_ids)) != quantity:
                    raise HTTPException(400, "كمية سطر السيريال يجب أن تساوي عدد السيريالات المحددة")
                if not set(serial_ids).issubset(expected_ids):
                    raise HTTPException(400, "يوجد سيريال لا ينتمي إلى سطر الفاتورة الأصلية")
                if set(serial_ids) & returned_serial_ids:
                    raise HTTPException(400, "لا يمكن إرجاع السيريال نفسه أكثر من مرة")
                returned_serial_ids.update(serial_ids)
            elif serial_ids:
                raise HTTPException(400, "لا تقبل السيريالات إلا عند إرجاع صنف متسلسل")
            elif tracking_type in ("batch", "variant"):
                raise HTTPException(400, "مرتجع التشغيلة أو المتغير يحتاج تحديد هويته التشغيلية قبل تمكينه")

        # يستمد السعر والضريبة والوصف من الأصل؛ لا يسمح لواجهة العميل بتغيير الأساس المالي للمرتجع.
        _sub, _disc, taxable, vat, total_line = _calc_line(
            quantity,
            Decimal(str(original_line.unit_price)),
            Decimal(str(original_line.discount_pct)),
            Decimal(str(original_line.vat_rate)),
        )
        taxable_total += taxable
        total_vat += vat
        total += total_line
        validated_lines.append((line, original_line, serial_ids, taxable, vat, total_line))

    cn_id = str(uuid.uuid4())
    issue_date = data.issue_date.replace(tzinfo=None)
    from app.models.tenant import Tenant
    tenant = await db.get(Tenant, tenant_id)
    from app.modules.accounting.service import get_vat_settings
    vat_settings = await get_vat_settings(db, tenant_id)
    cn = CreditNote(
        id=cn_id, tenant_id=tenant_id, credit_note_number=await _next_credit_note_number(db, tenant_id),
        uuid=str(uuid.uuid4()), original_invoice_id=data.original_invoice_id, customer_id=original.customer_id,
        issue_date=issue_date, reason=data.reason, subtotal=taxable_total, vat_amount=total_vat, total=total,
        qr_code=_generate_qr_tlv(tenant.name if tenant else "", vat_settings.vat_number if vat_settings else "", issue_date.isoformat(), total, total_vat), created_by=user_id,
    )

    try:
        db.add(cn)
        for i, (line, original_line, serial_ids, taxable, vat, total_line) in enumerate(validated_lines):
            db.add(CreditNoteLine(
                id=str(uuid.uuid4()), credit_note_id=cn_id, original_invoice_line_id=original_line.id,
                line_order=i, description_ar=original_line.description_ar, quantity=Decimal(str(line.quantity)),
                unit_price=Decimal(str(original_line.unit_price)), vat_rate=Decimal(str(original_line.vat_rate)),
                subtotal=taxable, vat_amount=vat, total=total_line,
                inventory_item_id=original_line.inventory_item_id, variant_id=original_line.variant_id,
                serial_ids_json=json.dumps(serial_ids) if serial_ids else None,
            ))
        await _return_credit_note_inventory(db, tenant_id, user_id, cn, original, validated_lines)
        record_audit(db, tenant_id, user_id, "create", "credit_note", cn.id,
                     credit_note_number=cn.credit_note_number, original_invoice_id=original.id,
                     total=cn.total, line_count=len(validated_lines))
        if original.fiscal_year_id and await is_operational_auto_posting_enabled(db, tenant_id):
            await _create_credit_note_journal(db, tenant_id, user_id, cn, original)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    await db.refresh(cn)
    return cn


async def _return_credit_note_inventory(db, tenant_id, user_id, credit_note, original_invoice, validated_lines):
    """يعيد الكمية أو السيريال إلى مستودع الفاتورة مع حركة return_in داخل معاملة الإشعار."""
    from app.modules.inventory.service import add_stock, get_item
    from app.models.inventory import SerialItem, SerialStatus, StockMovement
    from app.models.reps import SalesRep

    warehouse_id = None
    if original_invoice.rep_id:
        rep = await db.get(SalesRep, original_invoice.rep_id)
        warehouse_id = rep.warehouse_id if rep else None

    for _line, original_line, serial_ids, _taxable, _vat, _total_line in validated_lines:
        if not original_line.inventory_item_id:
            continue
        item = await get_item(db, tenant_id, original_line.inventory_item_id)
        tracking_type = getattr(item.tracking_type, "value", item.tracking_type)
        if tracking_type == "serial":
            serial_result = await db.execute(select(SerialItem).where(SerialItem.id.in_(serial_ids)))
            serials = {serial.id: serial for serial in serial_result.scalars().all()}
            if len(serials) != len(serial_ids):
                raise HTTPException(400, "تعذر العثور على أحد السيريالات المحددة للمرتجع")
            for serial_id in serial_ids:
                serial = serials[serial_id]
                if serial.product_id != original_line.inventory_item_id or serial.sale_invoice_id != original_invoice.id:
                    raise HTTPException(400, "السيريال المحدد لا يخص الفاتورة أو الصنف المرتجع")
                if getattr(serial.status, "value", serial.status) != "sold":
                    raise HTTPException(400, f"لا يمكن إرجاع السيريال بحالته الحالية: {serial.status}")
                serial.status = SerialStatus.IN_STOCK
                serial.warehouse_id = warehouse_id or serial.warehouse_id
                db.add(StockMovement(
                    id=str(uuid.uuid4()), tenant_id=tenant_id, product_id=serial.product_id,
                    warehouse_id=serial.warehouse_id, movement_type="return_in", quantity=Decimal("1"),
                    unit_cost=serial.cost_price, serial_item_id=serial.id,
                    reference_type="credit_note", reference_id=credit_note.id, created_by=user_id,
                ))
            continue
        if tracking_type in ("batch", "variant"):
            raise HTTPException(400, "مرتجع التشغيلة أو المتغير يحتاج تحديد هويته التشغيلية قبل إعادة المخزون")
        await add_stock(
            db=db, tenant_id=tenant_id, product_id=original_line.inventory_item_id,
            quantity=Decimal(str(_line.quantity)), unit_cost=item.cost_price, warehouse_id=warehouse_id,
            reference_type="credit_note", reference_id=credit_note.id, user_id=user_id, auto_commit=False,
            movement_type="return_in",
        )


async def _create_credit_note_journal(db, tenant_id, user_id, cn, original_invoice):
    """قيد متزن: مدين الإيراد والضريبة، دائن حساب العميل."""
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus, Account, AccountType
    from app.modules.accounting.service import _next_entry_number, get_vat_settings
    customer = await db.get(Customer, cn.customer_id)
    if not customer or not customer.ar_account_id:
        return None
    revenue = (await db.execute(select(Account).where(Account.tenant_id == tenant_id, Account.account_type == AccountType.REVENUE, Account.is_active == True, Account.is_posting == True).order_by(Account.code).limit(1))).scalar_one_or_none()
    vat_settings = await get_vat_settings(db, tenant_id)
    if not revenue or (cn.vat_amount > 0 and (not vat_settings or not vat_settings.vat_account_id)):
        return None
    entry = JournalEntry(id=str(uuid.uuid4()), tenant_id=tenant_id, entry_number=await _next_entry_number(db, tenant_id), entry_date=cn.issue_date,
        fiscal_year_id=original_invoice.fiscal_year_id, description_ar=f"إشعار دائن (مرتجع): {cn.credit_note_number} — {original_invoice.buyer_name_ar}",
        description_en=f"Credit Note (Return): {cn.credit_note_number}", status=JournalEntryStatus.POSTED, source="credit_note", reference=cn.credit_note_number,
        total_debit=cn.total, total_credit=cn.total, created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow())
    db.add(entry)
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=customer.ar_account_id, description=f"مرتجع — {cn.credit_note_number}", debit=Decimal("0"), credit=cn.total, line_order=0))
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=revenue.id, description=f"عكس إيراد المبيعات — {cn.credit_note_number}", debit=cn.subtotal, credit=Decimal("0"), line_order=1))
    if cn.vat_amount > 0:
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=vat_settings.vat_account_id, description="عكس ضريبة القيمة المضافة — مرتجع", debit=cn.vat_amount, credit=Decimal("0"), line_order=2))
    cn.journal_entry_id = entry.id
    await db.flush()
    return entry.id


async def get_credit_note(db: AsyncSession, tenant_id: str, credit_note_id: str) -> CreditNote:
    credit_note = await db.get(CreditNote, credit_note_id)
    if not credit_note or credit_note.tenant_id != tenant_id:
        raise HTTPException(404, "الإشعار الدائن غير موجود")
    return credit_note


async def get_refund_request(db: AsyncSession, tenant_id: str, refund_request_id: str) -> RefundRequest:
    request = await db.get(RefundRequest, refund_request_id)
    if not request or request.tenant_id != tenant_id:
        raise HTTPException(404, "طلب الاسترداد غير موجود")
    return request


async def list_credit_note_refund_requests(db: AsyncSession, tenant_id: str, credit_note_id: str):
    credit_note = await get_credit_note(db, tenant_id, credit_note_id)
    result = await db.execute(
        select(RefundRequest)
        .where(RefundRequest.tenant_id == tenant_id, RefundRequest.credit_note_id == credit_note.id)
        .order_by(RefundRequest.created_at.desc())
    )
    return result.scalars().all()


async def create_refund_request(
    db: AsyncSession, tenant_id: str, user_id: str, credit_note_id: str, data: RefundRequestCreate,
):
    """ينشئ طلب استرداد يحتاج اعتمادًا؛ لا ينشئ سند صرف ولا يرحّل خزينة تلقائيًا."""
    credit_note = await get_credit_note(db, tenant_id, credit_note_id)
    original = await get_invoice(db, tenant_id, credit_note.original_invoice_id)
    amount = Decimal(str(data.amount)).quantize(Decimal("0.01"))
    if amount <= 0:
        raise HTTPException(400, "مبلغ طلب الاسترداد يجب أن يكون أكبر من صفر")

    active_statuses = (RefundRequestStatus.REQUESTED, RefundRequestStatus.APPROVED)
    credit_note_active = (await db.execute(
        select(func.coalesce(func.sum(RefundRequest.amount), 0)).where(
            RefundRequest.tenant_id == tenant_id,
            RefundRequest.credit_note_id == credit_note.id,
            RefundRequest.status.in_(active_statuses),
        )
    )).scalar() or Decimal("0")
    credit_note_remaining = Decimal(str(credit_note.total)) - Decimal(str(credit_note_active))

    all_credit_total = (await db.execute(
        select(func.coalesce(func.sum(CreditNote.total), 0)).where(
            CreditNote.tenant_id == tenant_id,
            CreditNote.original_invoice_id == original.id,
        )
    )).scalar() or Decimal("0")
    invoice_active = (await db.execute(
        select(func.coalesce(func.sum(RefundRequest.amount), 0)).where(
            RefundRequest.tenant_id == tenant_id,
            RefundRequest.original_invoice_id == original.id,
            RefundRequest.status.in_(active_statuses),
        )
    )).scalar() or Decimal("0")
    invoice_refundable_cap = min(Decimal(str(original.paid_amount or 0)), Decimal(str(all_credit_total)))
    invoice_remaining = invoice_refundable_cap - Decimal(str(invoice_active))
    allowed = min(credit_note_remaining, invoice_remaining)
    if amount > allowed:
        raise HTTPException(400, "مبلغ طلب الاسترداد يتجاوز قيمة الإشعار الدائن أو المبلغ المقبوض المتاح")

    request = RefundRequest(
        id=str(uuid.uuid4()), tenant_id=tenant_id, credit_note_id=credit_note.id,
        original_invoice_id=original.id, customer_id=credit_note.customer_id,
        amount=amount, status=RefundRequestStatus.REQUESTED, reason=(data.reason or None),
        requested_by=user_id,
    )
    db.add(request)
    record_audit(db, tenant_id, user_id, "request_refund", "credit_note", credit_note.id,
                 refund_request_id=request.id, amount=amount, original_invoice_id=original.id)
    await db.commit()
    await db.refresh(request)
    return request


async def approve_refund_request(db: AsyncSession, tenant_id: str, user_id: str, refund_request_id: str):
    """يعتمد الطلب فقط؛ ينشأ سند الصرف لاحقًا من الخزينة بعد تحديد الحسابات."""
    request = await get_refund_request(db, tenant_id, refund_request_id)
    if request.status != RefundRequestStatus.REQUESTED:
        raise HTTPException(400, "يمكن اعتماد طلب استرداد بانتظار الاعتماد فقط")
    request.status = RefundRequestStatus.APPROVED
    request.approved_by = user_id
    request.approved_at = datetime.utcnow()
    record_audit(db, tenant_id, user_id, "approve_refund", "refund_request", request.id,
                 credit_note_id=request.credit_note_id, amount=request.amount)
    await db.commit()
    await db.refresh(request)
    return request


async def reject_refund_request(
    db: AsyncSession, tenant_id: str, user_id: str, refund_request_id: str, rejection_reason: str | None,
):
    request = await get_refund_request(db, tenant_id, refund_request_id)
    if request.status != RefundRequestStatus.REQUESTED:
        raise HTTPException(400, "يمكن رفض طلب استرداد بانتظار الاعتماد فقط")
    if not rejection_reason or not rejection_reason.strip():
        raise HTTPException(400, "سبب رفض الاسترداد مطلوب")
    request.status = RefundRequestStatus.REJECTED
    request.approved_by = user_id
    request.approved_at = datetime.utcnow()
    request.rejection_reason = rejection_reason.strip()
    record_audit(db, tenant_id, user_id, "reject_refund", "refund_request", request.id,
                 credit_note_id=request.credit_note_id, amount=request.amount)
    await db.commit()
    await db.refresh(request)
    return request


# ─── Summary ─────────────────────────────────────────────────────────
async def get_sales_summary(db: AsyncSession, tenant_id: str, rep_id: str | None = None):
    """ملخص المبيعات — يحسب فقط الفواتير المؤكدة والمدفوعة (تجاهل المسودات والملغية والمرفوضة)"""
    CONFIRMED_STATUSES = (
        InvoiceStatus.CONFIRMED,
        InvoiceStatus.PAID,
        InvoiceStatus.PARTIAL,
        InvoiceStatus.OVERDUE,
    )
    q = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.status.in_(CONFIRMED_STATUSES),
    )
    if rep_id:
        q = q.where(Invoice.rep_id == rep_id)
    invoices_r = await db.execute(q)
    invoices = invoices_r.scalars().all()

    total_invoiced = sum(i.total for i in invoices)
    total_paid = sum(i.paid_amount for i in invoices)

    # ذمم العملاء تشمل أرصدة النقل الافتتاحية المثبتة في القيود، لا الفواتير فقط.
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    customer_account_ids = (await db.execute(
        select(Customer.ar_account_id).where(
            Customer.tenant_id == tenant_id,
            Customer.ar_account_id.is_not(None),
            *( [Customer.rep_id == rep_id] if rep_id else [] ),
        )
    )).scalars().all()
    opening_total = Decimal("0")
    if customer_account_ids:
        opening_total = Decimal(str((await db.execute(
            select(func.coalesce(func.sum(JournalEntryLine.debit - JournalEntryLine.credit), 0))
            .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
            .where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.source == "customer_opening_balance",
                JournalEntryLine.account_id.in_(customer_account_ids),
            )
        )).scalar() or 0))
    total_outstanding = total_invoiced - total_paid + opening_total
    overdue_count = sum(1 for i in invoices if i.status == InvoiceStatus.OVERDUE)

    # عدد الفواتير المعلّقة للمراجعة (submitted) — لا تُحسب ضمن الإيرادات
    pending_q = select(func.count(Invoice.id)).where(
        Invoice.tenant_id == tenant_id,
        Invoice.status == InvoiceStatus.SUBMITTED,
    )
    if rep_id:
        pending_q = pending_q.where(Invoice.rep_id == rep_id)
    pending_count = (await db.execute(pending_q)).scalar() or 0

    return {
        "total_invoiced":    float(total_invoiced),
        "total_paid":        float(total_paid),
        "total_outstanding": float(total_outstanding),
        "opening_balance":   float(opening_total),
        "overdue_count":     overdue_count,
        "draft_count":       int(pending_count),   # يُستخدم لعرض عدد المعلّقة
        "invoice_count":     len(invoices),
    }




# ─── System dashboard ────────────────────────────────────────────────
async def get_system_dashboard_summary(db: AsyncSession, tenant_id: str) -> dict:
    """ملخص موحّد للمدير؛ لا يخلط طلبات المناديب مع أداء النظام الأساسي."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    confirmed_statuses = (
        InvoiceStatus.CONFIRMED,
        InvoiceStatus.PAID,
        InvoiceStatus.PARTIAL,
        InvoiceStatus.OVERDUE,
    )

    monthly_invoices_r = await db.execute(
        select(Invoice).where(
            Invoice.tenant_id == tenant_id,
            Invoice.status.in_(confirmed_statuses),
            Invoice.issue_date >= month_start,
        )
    )
    monthly_invoices = monthly_invoices_r.scalars().all()

    sales_total = sum((invoice.total or Decimal("0")) for invoice in monthly_invoices)
    sales_before_vat = sum((invoice.taxable_amount or Decimal("0")) for invoice in monthly_invoices)

    # الربح الإجمالي ليس (المبيعات - كل مشتريات الشهر): ففاتورة الشراء قد
    # تمثل مخزوناً لم يُبع بعد. نعتمد تكلفة حركات المخزون الخارجة والمرتبطة
    # بالفواتير المؤكدة فقط، مع fallback للفواتير القديمة التي سجلت الحركة
    # بتكلفة صفرية قبل إدخال سعر التكلفة. أولوية التكلفة: الحركة نفسها، ثم
    # السيريال/التشغيلة/المتغير، ثم سعر المنتج الحالي.
    movement_cost = case(
        (StockMovement.unit_cost > 0, StockMovement.unit_cost),
        (SerialItem.cost_price > 0, SerialItem.cost_price),
        (BatchItem.cost_price > 0, BatchItem.cost_price),
        (ProductVariant.cost_price > 0, ProductVariant.cost_price),
        else_=InventoryItem.cost_price,
    )
    cost_of_sales_r = await db.execute(
        select(func.coalesce(func.sum((-StockMovement.quantity) * movement_cost), 0))
        .join(Invoice, Invoice.id == StockMovement.reference_id)
        .join(InventoryItem, InventoryItem.id == StockMovement.product_id)
        .outerjoin(SerialItem, SerialItem.id == StockMovement.serial_item_id)
        .outerjoin(BatchItem, BatchItem.id == StockMovement.batch_item_id)
        .outerjoin(ProductVariant, ProductVariant.id == StockMovement.variant_id)
        .where(
            StockMovement.tenant_id == tenant_id,
            StockMovement.reference_type == "invoice",
            StockMovement.quantity < 0,
            Invoice.status.in_(confirmed_statuses),
            Invoice.issue_date >= month_start,
        )
    )
    stock_cost_of_sales = Decimal(str(cost_of_sales_r.scalar() or 0))

    # المتغيرات (مثل مقاسات/ألوان الملابس) تُخصم من رصيدها مباشرة في المسار
    # الحالي ولا تنشئ StockMovement، لذلك تحسب تكلفتها من سعر تكلفة المتغير.
    variant_cost_r = await db.execute(
        select(func.coalesce(func.sum(InvoiceLine.quantity * ProductVariant.cost_price), 0))
        .join(Invoice, Invoice.id == InvoiceLine.invoice_id)
        .join(ProductVariant, ProductVariant.id == InvoiceLine.variant_id)
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.status.in_(confirmed_statuses),
            Invoice.issue_date >= month_start,
        )
    )
    variant_cost_of_sales = Decimal(str(variant_cost_r.scalar() or 0))
    cost_of_sales = stock_cost_of_sales + variant_cost_of_sales
    estimated_gross_profit = sales_before_vat - cost_of_sales

    new_customers_r = await db.execute(
        select(func.count(Customer.id)).where(
            Customer.tenant_id == tenant_id,
            Customer.created_at >= month_start,
        )
    )
    total_customers_r = await db.execute(
        select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id)
    )

    # ذمم العملاء الفعلية = أرصدة افتتاحية العملاء + الفواتير المؤكدة - كل سندات القبض.
    # لا نعتمد على Invoice.paid_amount وحده حتى تدخل السندات المباشرة على رصيد العميل.
    from app.models.accounting import JournalEntryStatus
    customer_accounts_r = await db.execute(
        select(Customer.ar_account_id, Account.opening_balance)
        .join(Account, Account.id == Customer.ar_account_id)
        .where(
            Customer.tenant_id == tenant_id,
            Customer.ar_account_id.is_not(None),
        )
    )
    customer_account_rows = customer_accounts_r.all()
    customer_account_ids = [account_id for account_id, _ in customer_account_rows]
    account_opening_total = sum(
        (opening_balance or Decimal("0")) for _, opening_balance in customer_account_rows
    )
    opening_journal_total = Decimal("0")
    if customer_account_ids:
        opening_journal_r = await db.execute(
            select(func.coalesce(func.sum(JournalEntryLine.debit - JournalEntryLine.credit), 0))
            .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
            .where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.source == "customer_opening_balance",
                JournalEntryLine.account_id.in_(customer_account_ids),
            )
        )
        opening_journal_total = Decimal(str(opening_journal_r.scalar() or 0))

    payments_r = await db.execute(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.tenant_id == tenant_id,
        )
    )
    total_customer_payments = Decimal(str(payments_r.scalar() or 0))
    opening_total = account_opening_total + opening_journal_total
    confirmed_customer_invoices_r = await db.execute(
        select(Invoice.total).where(
            Invoice.tenant_id == tenant_id,
            Invoice.status.in_(confirmed_statuses),
        )
    )
    confirmed_invoice_total = sum(
        (total or Decimal("0")) for (total,) in confirmed_customer_invoices_r.all()
    )
    outstanding_total = confirmed_invoice_total - total_customer_payments + opening_total

    margin = float(estimated_gross_profit / sales_before_vat * 100) if sales_before_vat else 0.0
    return {
        "period": "this_month",
        "sales_total": float(sales_total),
        "sales_before_vat": float(sales_before_vat),
        "invoice_count": len(monthly_invoices),
        "estimated_gross_profit": float(estimated_gross_profit),
        "cost_of_sales": float(cost_of_sales),
        "gross_margin_pct": round(margin, 1),
        "new_customers": int(new_customers_r.scalar() or 0),
        "total_customers": int(total_customers_r.scalar() or 0),
        "opening_balance": float(opening_total),
        "total_collected": float(total_customer_payments),
        "operational_outstanding": float(confirmed_invoice_total - total_customer_payments),
        "outstanding_total": float(outstanding_total),
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

    previous_status = invoice.status.value
    invoice.status = InvoiceStatus.SUBMITTED
    invoice.submitted_at = datetime.utcnow()
    invoice.rejection_note = None  # مسح سبب الرفض السابق
    record_audit(db, tenant_id, user_id, "submit", "invoice", invoice.id,
                 invoice_number=invoice.invoice_number, from_status=previous_status, to_status="submitted")
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def approve_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    """
    المحاسب/المدير يوافق على الفاتورة — submitted → approved → confirmed
    الموافقة تُكمل دورة الحياة كاملة: تخصم المخزون وتُغلق الفاتورة
    """
    invoice = await get_invoice(db, tenant_id, invoice_id)

    if invoice.status != InvoiceStatus.SUBMITTED:
        raise HTTPException(400, f"لا يمكن الموافقة على فاتورة بحالة '{invoice.status.value}'")

    invoice.status = InvoiceStatus.APPROVED
    invoice.reviewed_by = user_id
    invoice.reviewed_at = datetime.utcnow()
    await db.flush()  # نحفظ APPROVED مؤقتاً

    # تأكيد الفاتورة تلقائياً بعد الموافقة — يخصم المخزون
    if invoice.fiscal_year_id and await is_operational_auto_posting_enabled(db, tenant_id):
        try:
            journal_id = await _create_invoice_journal(db, tenant_id, user_id, invoice)
            invoice.journal_entry_id = journal_id
        except Exception:
            pass  # القيد المحاسبي اختياري

    try:
        await _deduct_inventory_for_invoice(db, tenant_id, user_id, invoice)
    except Exception:
        await db.rollback()
        raise

    invoice.status = InvoiceStatus.CONFIRMED
    record_audit(db, tenant_id, user_id, "approve_and_confirm", "invoice", invoice.id,
                 invoice_number=invoice.invoice_number, total=invoice.total)
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
    record_audit(db, tenant_id, user_id, "reject", "invoice", invoice.id,
                 invoice_number=invoice.invoice_number, reason=invoice.rejection_note)
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def confirm_approved_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    """تأكيد الفاتورة الموافق عليها — approved → confirmed + خصم المخزون"""
    invoice = await get_invoice(db, tenant_id, invoice_id)

    if invoice.status != InvoiceStatus.APPROVED:
        raise HTTPException(400, f"لا يمكن تأكيد فاتورة بحالة '{invoice.status.value}' — يجب أن تكون موافقاً عليها أولاً")

    if invoice.fiscal_year_id and await is_operational_auto_posting_enabled(db, tenant_id):
        journal_id = await _create_invoice_journal(db, tenant_id, user_id, invoice)
        invoice.journal_entry_id = journal_id

    await _deduct_inventory_for_invoice(db, tenant_id, user_id, invoice)

    invoice.status = InvoiceStatus.CONFIRMED
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def get_submitted_invoices(db: AsyncSession, tenant_id: str, rep_id: str | None = None):
    """جلب فواتير المناديب المقدّمة للمراجعة، مع هوية المندوب التشغيلية."""
    from sqlalchemy.orm import selectinload

    q = (
        select(Invoice, SalesRep.rep_code, SalesRep.zone, User.full_name)
        .outerjoin(SalesRep, Invoice.rep_id == SalesRep.id)
        .outerjoin(User, SalesRep.user_id == User.id)
        .options(selectinload(Invoice.lines))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.rep_id.is_not(None),
            Invoice.status == InvoiceStatus.SUBMITTED,
        )
    )
    if rep_id:
        q = q.where(Invoice.rep_id == rep_id)
    q = q.order_by(Invoice.submitted_at.asc())

    rows = (await db.execute(q)).all()
    invoices = []
    for invoice, rep_code, rep_zone, rep_name in rows:
        # حقول عرض فقط؛ تبقى الفاتورة نفسها المصدر المالي الوحيد للحقيقة.
        invoice.rep_name = rep_name
        invoice.rep_code = rep_code
        invoice.rep_zone = rep_zone
        invoices.append(invoice)
    return invoices


async def _assert_rep_owns_invoice(db: AsyncSession, user_id: str, invoice: Invoice):
    """يحمي عمليات المندوب على فواتيره فقط، بينما يبقى المدير/المحاسب قادرين على الإدارة."""
    rep_r = await db.execute(select(SalesRep).where(SalesRep.user_id == user_id))
    rep = rep_r.scalar_one_or_none()
    if rep and invoice.rep_id != rep.id:
        raise HTTPException(403, "لا يمكنك تنفيذ عملية على فاتورة مندوب آخر")


async def update_invoice(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str, data: dict):
    """تحديث كامل لمسودة أو فاتورة مرفوضة، بما يشمل خطوطها وإجمالياتها."""
    invoice = await get_invoice(db, tenant_id, invoice_id)
    await _assert_rep_owns_invoice(db, user_id, invoice)
    if invoice.status not in (InvoiceStatus.DRAFT, InvoiceStatus.REJECTED):
        raise HTTPException(400, "لا يمكن تعديل فاتورة بعد إرسالها أو اعتمادها")

    def as_datetime(value):
        if value is None or value == "":
            return None
        if isinstance(value, datetime):
            return value.replace(tzinfo=None)
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)

    if data.get("customer_id"):
        customer = await get_customer(db, tenant_id, data["customer_id"])
        invoice.customer_id = customer.id
        invoice.buyer_name_ar = customer.name_ar
        invoice.buyer_vat_number = customer.vat_number
        invoice.buyer_address = "، ".join(p for p in [customer.address_street, customer.address_district, customer.address_city, customer.address_postal] if p)

    allowed = {"notes", "terms", "invoice_payment_method", "credit_days", "cheque_number", "cheque_date", "bank_name", "invoice_type"}
    for key in allowed:
        if key in data:
            setattr(invoice, key, data[key])
    for key in ("issue_date", "supply_date", "due_date"):
        if key in data:
            setattr(invoice, key, as_datetime(data[key]))

    if "lines" in data:
        rows = data.get("lines") or []
        if not rows:
            raise HTTPException(400, "يجب أن تحتوي الفاتورة على صنف واحد على الأقل")
        await db.execute(delete(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id))
        subtotal = Decimal("0")
        total_discount = Decimal("0")
        total_vat = Decimal("0")
        total = Decimal("0")
        for i, raw in enumerate(rows):
            quantity = Decimal(str(raw.get("quantity", 1)))
            unit_price = Decimal(str(raw.get("unit_price", 0)))
            discount_pct = Decimal(str(raw.get("discount_pct", 0)))
            vat_rate = Decimal(str(raw.get("vat_rate", 15)))
            sub, disc, taxable, vat, tot = _calc_line(quantity, unit_price, discount_pct, vat_rate)
            subtotal += sub
            total_discount += disc
            total_vat += vat
            total += tot
            serial_ids = raw.get("serial_ids")
            db.add(InvoiceLine(
                id=str(uuid.uuid4()), invoice_id=invoice.id, line_order=i,
                description_ar=raw.get("description_ar") or "صنف",
                description_en=raw.get("description_en"), quantity=quantity,
                unit=raw.get("unit"), unit_price=unit_price,
                discount_pct=discount_pct, discount_amount=disc,
                vat_rate=vat_rate, vat_category=raw.get("vat_category") or "S",
                subtotal=sub, vat_amount=vat, total=tot,
                inventory_item_id=raw.get("inventory_item_id"),
                serial_item_id=raw.get("serial_item_id"),
                serial_ids_json=json.dumps(serial_ids) if serial_ids else None,
                variant_id=raw.get("variant_id"),
            ))
        invoice.subtotal = subtotal
        invoice.discount_amount = total_discount
        invoice.taxable_amount = subtotal - total_discount
        invoice.vat_amount = total_vat
        invoice.total = total

    # المسودة المرفوضة تعود قابلة للتعديل، لكن لا تُرسل إلا بإجراء submit صريح.
    if invoice.status == InvoiceStatus.REJECTED:
        invoice.rejection_note = invoice.rejection_note
    record_audit(db, tenant_id, user_id, "update", "invoice", invoice.id,
                 invoice_number=invoice.invoice_number, changed_fields=list(data.keys()))
    await db.commit()
    return await get_invoice(db, tenant_id, invoice_id)


async def delete_invoice_draft(db: AsyncSession, tenant_id: str, user_id: str, invoice_id: str):
    """حذف المسودة فقط؛ لا تمس المستندات التي دخلت دورة اعتماد أو ترحيل."""
    invoice = await get_invoice(db, tenant_id, invoice_id)
    await _assert_rep_owns_invoice(db, user_id, invoice)
    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(400, "يمكن حذف المسودات فقط؛ الفاتورة المرفوضة تعدّل ثم تعاد للإرسال")
    record_audit(db, tenant_id, user_id, "delete_draft", "invoice", invoice.id,
                 invoice_number=invoice.invoice_number)
    await db.delete(invoice)
    await db.commit()
    return {"message": "تم حذف المسودة", "id": invoice_id}
