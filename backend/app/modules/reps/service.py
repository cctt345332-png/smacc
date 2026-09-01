"""
خدمة المناديب — إنشاء المنديب + مستودعه + فلترة المخزون والمبيعات
"""
import json
import math
import uuid
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, select, func, delete
from fastapi import HTTPException

from app.models.reps import RepAttendance, RepGeoEvent, RepGeoZone, RepLocation, SalesRep
from app.models.user import User
from app.models.inventory import Warehouse, InventoryStock, StockMovement
from app.models.sales import Customer, Invoice, Payment
from app.models.accounting import Account, AccountType, AccountNature, JournalEntry, JournalEntryLine, JournalEntryStatus
from app.models.notifications import Notification, NotificationSeverity, NotificationType


# ─── إنشاء مندوب ─────────────────────────────────────────────────────
async def _validate_rep_account_parent(db: AsyncSession, tenant_id: str, account_id: str | None):
    if not account_id:
        return None
    account = await db.get(Account, account_id)
    if not account or account.tenant_id != tenant_id or not account.is_active:
        raise HTTPException(400, "فرع حساب المندوب غير صالح أو غير تابع للشركة")
    if account.account_type != AccountType.ASSET or account.nature != AccountNature.DEBIT:
        raise HTTPException(400, "يجب اختيار فرع مدينة ضمن حسابات العملاء والأصول المدينة")
    # التحقق من أن الفرع داخل مجموعة العملاء، حتى لا يُربط المندوب بحساب مخزون أو نقد بالخطأ.
    current = account
    is_customer_branch = False
    for _ in range(30):
        if current.is_customer_account or str(current.code).startswith("113") or "عملاء" in (current.name_ar or "") or "customer" in (current.name_en or "").lower():
            is_customer_branch = True
            break
        if not current.parent_id:
            break
        current = await db.get(Account, current.parent_id)
        if not current:
            break
    if not is_customer_branch:
        raise HTTPException(400, "يجب اختيار فرع مدينة تحت حساب العملاء")
    return account


async def _next_rep_account_code(db: AsyncSession, tenant_id: str, parent: Account) -> str:
    result = await db.execute(select(Account.code).where(
        Account.tenant_id == tenant_id, Account.parent_id == parent.id
    ))
    used = {str(code) for code in result.scalars().all()}
    suffix = 1
    while f"{parent.code}{suffix:03d}" in used:
        suffix += 1
    return f"{parent.code}{suffix:03d}"


async def create_rep(db: AsyncSession, tenant_id: str, data: dict) -> dict:

    """
    إنشاء مندوب جديد:
    1. إنشاء مستخدم بدور sales_rep
    2. إنشاء مستودع خاص بالمندوب
    3. إنشاء سجل SalesRep يربطهما
    """
    from app.core.security import hash_password

    # التحقق من البريد
    existing = await db.execute(select(User).where(User.email == data["email"]))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "البريد الإلكتروني مستخدم بالفعل")

    # إنشاء المستخدم
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        tenant_id=tenant_id,
        email=data["email"],
        hashed_password=hash_password(data["password"]),
        full_name=data["full_name"],
        role="sales_rep",
        created_at=datetime.utcnow(),
    )
    db.add(user)

    # رقم المندوب التسلسلي
    count_r = await db.execute(
        select(func.count(SalesRep.id)).where(SalesRep.tenant_id == tenant_id)
    )
    rep_count = (count_r.scalar() or 0) + 1
    rep_code = f"REP-{str(rep_count).zfill(3)}"

    # إنشاء مستودع خاص بالمندوب
    wh_id = str(uuid.uuid4())
    warehouse = Warehouse(
        id=wh_id,
        tenant_id=tenant_id,
        name_ar=f"مستودع المندوب — {data['full_name']}",
        name_en=f"Rep Warehouse — {data['full_name']}",
        branch_name=rep_code,
        is_default=False,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(warehouse)

    # إنشاء سجل المندوب
    customer_account_parent_id = data.get("customer_account_parent_id")
    if not customer_account_parent_id:
        raise HTTPException(400, "يجب اختيار فرع المدينة تحت حساب العملاء للمندوب")
    parent_account = await _validate_rep_account_parent(
        db, tenant_id, customer_account_parent_id
    )
    rep_id = str(uuid.uuid4())
    rep = SalesRep(
        id=rep_id,
        tenant_id=tenant_id,
        user_id=user_id,
        warehouse_id=wh_id,
        rep_code=rep_code,
        customer_account_id=None,
        phone=data.get("phone"),
        zone=data.get("zone"),
        notes=data.get("notes"),
        # بيانات الهوية
        id_number=data.get("id_number"),
        id_expiry=data.get("id_expiry"),
        license_expiry=data.get("license_expiry"),
        # بيانات السيارة
        vehicle_plate=data.get("vehicle_plate"),
        vehicle_type=data.get("vehicle_type"),
        vehicle_color=data.get("vehicle_color"),
        # الأهداف والعمولة
        target_monthly=Decimal(str(data.get("target_monthly", 0))),
        commission_pct=Decimal(str(data.get("commission_pct", 0))),
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(rep)
    if parent_account:
        rep_account = Account(
            id=str(uuid.uuid4()), tenant_id=tenant_id,
            code=await _next_rep_account_code(db, tenant_id, parent_account),
            name_ar=f"عملاء المندوب — {data['full_name']}",
            name_en=f"Rep Customers — {data['full_name']}",
            account_type=AccountType.ASSET, nature=AccountNature.DEBIT,
            parent_id=parent_account.id, level=parent_account.level + 1,
            is_active=True, is_posting=False, allow_direct_posting=False,
            is_customer_account=True, opening_balance=Decimal("0"),
            notes=f"حساب عملاء المندوب {rep_code}",
        )
        db.add(rep_account)
        rep.customer_account_id = rep_account.id
    await db.commit()

    return {
        "id": rep_id,
        "rep_code": rep_code,
        "user_id": user_id,
        "warehouse_id": wh_id,
        "customer_account_id": rep.customer_account_id,
        "full_name": data["full_name"],
        "email": data["email"],
        "phone": data.get("phone"),
        "zone": data.get("zone"),
        "id_number": data.get("id_number"),
        "vehicle_plate": data.get("vehicle_plate"),
        "vehicle_type": data.get("vehicle_type"),
        "target_monthly": float(data.get("target_monthly", 0)),
        "commission_pct": float(data.get("commission_pct", 0)),
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
    }


# ─── قائمة المناديب ───────────────────────────────────────────────────

async def get_reps(db: AsyncSession, tenant_id: str) -> list:
    r = await db.execute(
        select(SalesRep, User, Warehouse)
        .join(User, SalesRep.user_id == User.id)
        .outerjoin(Warehouse, SalesRep.warehouse_id == Warehouse.id)
        .where(SalesRep.tenant_id == tenant_id)
        .order_by(SalesRep.rep_code)
    )
    rows = r.all()
    result = []
    for rep, user, wh in rows:
        rep_account = await db.get(Account, rep.customer_account_id) if rep.customer_account_id else None
        result.append({
            "id": rep.id,
            "rep_code": rep.rep_code,
            "user_id": rep.user_id,
            "warehouse_id": rep.warehouse_id,
            "customer_account_id": rep.customer_account_id,
            "customer_account_parent_id": rep_account.parent_id if rep_account else None,
            "warehouse_name": wh.name_ar if wh else None,
            "full_name": user.full_name,
            "email": user.email,
            "phone": rep.phone,
            "zone": rep.zone,
            "notes": rep.notes,
            "id_number": rep.id_number,
            "id_expiry": rep.id_expiry.isoformat() if rep.id_expiry else None,
            "license_expiry": rep.license_expiry.isoformat() if rep.license_expiry else None,
            "vehicle_plate": rep.vehicle_plate,
            "vehicle_type": rep.vehicle_type,
            "vehicle_color": rep.vehicle_color,
            "target_monthly": float(rep.target_monthly or 0),
            "commission_pct": float(rep.commission_pct or 0),
            "is_active": rep.is_active,
            "created_at": rep.created_at,
        })
    return result


async def get_rep(db: AsyncSession, tenant_id: str, rep_id: str) -> dict:
    r = await db.execute(
        select(SalesRep, User, Warehouse)
        .join(User, SalesRep.user_id == User.id)
        .outerjoin(Warehouse, SalesRep.warehouse_id == Warehouse.id)
        .where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    row = r.one_or_none()
    if not row:
        raise HTTPException(404, "المندوب غير موجود")
    rep, user, wh = row
    rep_account = await db.get(Account, rep.customer_account_id) if rep.customer_account_id else None
    return {
        "id": rep.id,
        "rep_code": rep.rep_code,
        "user_id": rep.user_id,
        "warehouse_id": rep.warehouse_id,
        "customer_account_id": rep.customer_account_id,
        "customer_account_parent_id": rep_account.parent_id if rep_account else None,
        "warehouse_name": wh.name_ar if wh else None,
        "full_name": user.full_name,
        "email": user.email,
        "phone": rep.phone,
        "zone": rep.zone,
        "notes": rep.notes,
        "id_number": rep.id_number,
        "id_expiry": rep.id_expiry.isoformat() if rep.id_expiry else None,
        "license_expiry": rep.license_expiry.isoformat() if rep.license_expiry else None,
        "vehicle_plate": rep.vehicle_plate,
        "vehicle_type": rep.vehicle_type,
        "vehicle_color": rep.vehicle_color,
        "target_monthly": float(rep.target_monthly or 0),
        "commission_pct": float(rep.commission_pct or 0),
        "is_active": rep.is_active,
        "created_at": rep.created_at,
    }


async def import_rep_customers_from_tree(
    db: AsyncSession, tenant_id: str, rep_id: str, actor_user_id: str,
) -> dict:
    """استيراد العملاء من الحسابات النهائية الموجودة تحت حساب مندوب محدد."""
    rep = await db.get(SalesRep, rep_id)
    if not rep or rep.tenant_id != tenant_id:
        raise HTTPException(404, "المندوب غير موجود")
    if not rep.customer_account_id:
        raise HTTPException(400, "لم يتم ربط حساب محاسبي بهذا المندوب")

    rep_account = await db.get(Account, rep.customer_account_id)
    if not rep_account or rep_account.tenant_id != tenant_id:
        raise HTTPException(400, "الحساب المحاسبي المرتبط بالمندوب غير موجود")

    accounts = (await db.execute(
        select(Account).where(Account.tenant_id == tenant_id).order_by(Account.code)
    )).scalars().all()
    account_by_id = {account.id: account for account in accounts}

    def is_descendant(account: Account) -> bool:
        current = account
        visited: set[str] = set()
        while current.parent_id:
            if current.parent_id == rep_account.id:
                return True
            if current.parent_id in visited:
                break
            visited.add(current.parent_id)
            current = account_by_id.get(current.parent_id)
            if not current:
                break
        return False

    customer_accounts = [
        account for account in accounts
        if account.id != rep_account.id
        and account.is_customer_account
        and account.is_posting
        and is_descendant(account)
    ]

    existing = (await db.execute(
        select(Customer).where(Customer.tenant_id == tenant_id)
    )).scalars().all()
    existing_by_account = {
        customer.ar_account_id: customer
        for customer in existing
        if customer.ar_account_id
    }
    existing_rep_names = {
        _normalize_rep_customer_name(customer.name_ar)
        for customer in existing
        if customer.rep_id == rep_id
    }
    # سجلات قديمة أُنشئت بالاسم فقط؛ لا نربطها إلا عند وجود تطابق
    # وحيد، حتى لا نربط عميلين متشابهين بالحساب الخطأ.
    unlinked_by_name: dict[str, list[Customer]] = {}
    for customer in existing:
        if not customer.ar_account_id:
            unlinked_by_name.setdefault(_normalize_rep_customer_name(customer.name_ar), []).append(customer)

    from app.modules.sales.service import _create_customer_opening_journal

    next_number = (await db.execute(
        select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id)
    )).scalar() or 0
    created = []
    linked = 0
    opening_repaired = 0
    opening_already_journaled = 0
    opening_without_source_balance = 0
    skipped = 0
    details = []
    for account in customer_accounts:
        normalized_name = _normalize_rep_customer_name(account.name_ar)
        existing_customer = existing_by_account.get(account.id)
        if existing_customer:
            # المزامنة لا تغيّر الشجرة أو الكود أو الرصيد؛ تصلح فقط
            # ربط سجل العميل بالمندوب الذي يملك الحساب الأب.
            if existing_customer.rep_id != rep_id:
                existing_customer.rep_id = rep_id
                linked += 1
            else:
                skipped += 1
            details.append({
                "account_id": account.id, "account_code": account.code,
                "name_ar": account.name_ar, "status": "already_linked",
                "customer_id": existing_customer.id,
            })
            existing_rep_names.add(normalized_name)
            continue
        legacy_matches = unlinked_by_name.get(normalized_name, [])
        if len(legacy_matches) == 1:
            legacy_customer = legacy_matches[0]
            legacy_customer.ar_account_id = account.id
            legacy_customer.rep_id = rep_id
            existing_by_account[account.id] = legacy_customer
            existing_rep_names.add(normalized_name)
            unlinked_by_name.pop(normalized_name, None)
            linked += 1
            details.append({
                "account_id": account.id, "account_code": account.code,
                "name_ar": account.name_ar, "status": "legacy_linked",
                "customer_id": legacy_customer.id,
            })
            continue
        if len(legacy_matches) > 1 or normalized_name in existing_rep_names:
            skipped += 1
            continue
        next_number += 1
        customer = Customer(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            customer_number=f"CUS-{next_number:05d}",
            customer_type="company",
            name_ar=account.name_ar,
            name_en=account.name_en or account.name_ar,
            rep_id=rep.id,
            ar_account_id=account.id,
            credit_limit=Decimal("0"),
            payment_terms_days=30,
            currency_code="SAR",
            is_active=True,
            notes=f"مستورد تلقائياً من شجرة حسابات المندوب {rep.rep_code}",
        )
        db.add(customer)
        await db.flush()
        # يتم ترحيل opening_balance لاحقًا بعد اكتمال ربط العميل؛
        # لا نلمس parent_id أو code أو level أثناء المزامنة.
        existing_by_account[account.id] = customer
        existing_rep_names.add(normalized_name)
        created.append({
            "customer_id": customer.id,
            "account_id": account.id,
            "account_code": account.code,
            "name_ar": account.name_ar,
        })
        details.append({
            "account_id": account.id, "account_code": account.code,
            "name_ar": account.name_ar, "status": "created",
            "customer_id": customer.id,
        })

    # ترحيل الرصيد الموجود في account.opening_balance إلى قيد فعلي
    # بعد التأكد من وجود سجل عميل مرتبط. العملية idempotent ولا تمس
    # parent_id أو code أو level أو أي حركة سابقة.
    for account in customer_accounts:
        customer = existing_by_account.get(account.id)
        amount = Decimal(str(account.opening_balance or 0)).quantize(Decimal("0.01"))
        if not customer:
            details.append({
                "account_id": account.id, "account_code": account.code,
                "name_ar": account.name_ar, "status": "no_customer_record",
            })
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
            if amount != 0:
                account.opening_balance = Decimal("0")
            opening_already_journaled += 1
            details.append({
                "account_id": account.id, "account_code": account.code,
                "name_ar": account.name_ar, "status": "opening_journal_exists",
                "customer_id": customer.id,
            })
            continue
        if amount == 0:
            opening_without_source_balance += 1
            details.append({
                "account_id": account.id, "account_code": account.code,
                "name_ar": account.name_ar, "status": "no_opening_balance_source",
                "customer_id": customer.id,
            })
            continue
        await _create_customer_opening_journal(
            db, tenant_id, actor_user_id, customer, account, amount,
        )
        account.opening_balance = Decimal("0")
        opening_repaired += 1
        details.append({
            "account_id": account.id, "account_code": account.code,
            "name_ar": account.name_ar, "status": "opening_journal_created",
            "customer_id": customer.id,
        })

    await db.commit()
    return {
        "rep_id": rep.id,
        "rep_code": rep.rep_code,
        "account_id": rep_account.id,
        "account_name": rep_account.name_ar,
        "total_accounts": len(customer_accounts),
        "created": len(created),
        "linked": linked,
        "opening_repaired": opening_repaired,
        "opening_already_journaled": opening_already_journaled,
        "opening_without_source_balance": opening_without_source_balance,
        "skipped": skipped,
        "items": created,
        "details": details,
    }


def _normalize_rep_customer_name(value: str | None) -> str:
    return " ".join((value or "").replace("ـ", "").split()).strip().lower()


async def get_rep_by_user(db: AsyncSession, user_id: str) -> SalesRep | None:
    """جلب بيانات المندوب من user_id — يُستخدم في الفلترة"""
    r = await db.execute(select(SalesRep).where(SalesRep.user_id == user_id))
    return r.scalar_one_or_none()


# ─── تحديث مندوب ─────────────────────────────────────────────────────

async def delete_rep(db: AsyncSession, tenant_id: str, rep_id: str) -> dict:
    """حذف فعلي لبيانات المندوب التجريبية مع حذف القيود التابعة وتعطيل مستخدمه."""
    from app.models.reps import RepAttendance, RepGeoZone, RepGeoEvent, RepLocation, SupervisorRep
    from app.models.sales import InvoiceLine, CreditNote, CreditNoteLine, RefundRequest, Quotation, QuotationLine
    from app.models.sales_orders import SalesOrder, SalesOrderLine
    from app.models.inventory import InventoryStock, SerialItem, BatchItem

    rep = (await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )).scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    customer_rows = await db.execute(
        select(Customer.id, Customer.ar_account_id).where(
            Customer.tenant_id == tenant_id, Customer.rep_id == rep_id
        )
    )
    customer_data = customer_rows.all()
    customer_ids = [row[0] for row in customer_data]
    account_ids = [row[1] for row in customer_data if row[1]]

    invoice_ids = list((await db.execute(
        select(Invoice.id).where(Invoice.tenant_id == tenant_id, Invoice.rep_id == rep_id)
    )).scalars().all())
    credit_note_ids = list((await db.execute(
        select(CreditNote.id).where(
            CreditNote.tenant_id == tenant_id,
            CreditNote.customer_id.in_(customer_ids) if customer_ids else False,
        )
    )).scalars().all())

    # حذف المستندات التابعة قبل حذف العملاء والفواتير احترامًا للـ FK.
    quotation_ids = list((await db.execute(
        select(Quotation.id).where(
            Quotation.tenant_id == tenant_id,
            Quotation.customer_id.in_(customer_ids) if customer_ids else False,
        )
    )).scalars().all())
    order_ids = list((await db.execute(
        select(SalesOrder.id).where(
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.customer_id.in_(customer_ids) if customer_ids else False,
        )
    )).scalars().all())
    if quotation_ids:
        await db.execute(delete(QuotationLine).where(QuotationLine.quotation_id.in_(quotation_ids)))
        await db.execute(delete(Quotation).where(Quotation.id.in_(quotation_ids)))
    if order_ids:
        await db.execute(delete(SalesOrderLine).where(SalesOrderLine.order_id.in_(order_ids)))
        await db.execute(delete(SalesOrder).where(SalesOrder.id.in_(order_ids)))
    if credit_note_ids:
        await db.execute(delete(RefundRequest).where(RefundRequest.credit_note_id.in_(credit_note_ids)))
        await db.execute(delete(CreditNoteLine).where(CreditNoteLine.credit_note_id.in_(credit_note_ids)))
        await db.execute(delete(CreditNote).where(CreditNote.id.in_(credit_note_ids)))
    if invoice_ids:
        await db.execute(delete(RefundRequest).where(RefundRequest.original_invoice_id.in_(invoice_ids)))
        await db.execute(delete(Payment).where(Payment.invoice_id.in_(invoice_ids)))
        await db.execute(delete(InvoiceLine).where(InvoiceLine.invoice_id.in_(invoice_ids)))
        await db.execute(delete(Invoice).where(Invoice.id.in_(invoice_ids)))
    if customer_ids:
        await db.execute(delete(Payment).where(Payment.customer_id.in_(customer_ids)))
        await db.execute(delete(RefundRequest).where(RefundRequest.customer_id.in_(customer_ids)))

    # حذف قيود الرصيد الافتتاحي المرتبطة بحسابات العملاء ثم سطورها.
    journal_ids: list[str] = []
    if account_ids:
        journal_ids = list((await db.execute(
            select(JournalEntryLine.entry_id).where(JournalEntryLine.account_id.in_(account_ids))
        )).scalars().all())
        if journal_ids:
            await db.execute(delete(JournalEntryLine).where(JournalEntryLine.entry_id.in_(journal_ids)))
            await db.execute(delete(JournalEntry).where(JournalEntry.id.in_(journal_ids)))
        await db.execute(delete(Account).where(Account.id.in_(account_ids), Account.tenant_id == tenant_id))
    if customer_ids:
        await db.execute(delete(Customer).where(Customer.id.in_(customer_ids), Customer.tenant_id == tenant_id))

    # حذف بيانات المستودع التابعة للمندوب.
    if rep.warehouse_id:
        wid = rep.warehouse_id
        await db.execute(delete(StockMovement).where(
            (StockMovement.warehouse_id == wid) | (StockMovement.to_warehouse_id == wid)
        ))
        await db.execute(delete(InventoryStock).where(InventoryStock.warehouse_id == wid))
        await db.execute(delete(SerialItem).where(SerialItem.warehouse_id == wid))
        await db.execute(delete(BatchItem).where(BatchItem.warehouse_id == wid))
        await db.execute(delete(Warehouse).where(Warehouse.id == wid, Warehouse.tenant_id == tenant_id))

    await db.execute(delete(SupervisorRep).where(SupervisorRep.rep_id == rep_id))
    await db.execute(delete(RepAttendance).where(RepAttendance.rep_id == rep_id))
    await db.execute(delete(RepGeoZone).where(RepGeoZone.rep_id == rep_id))
    await db.execute(delete(RepGeoEvent).where(RepGeoEvent.rep_id == rep_id))
    await db.execute(delete(RepLocation).where(RepLocation.rep_id == rep_id))
    user = await db.get(User, rep.user_id)
    await db.delete(rep)
    # تعطيل حساب الدخول بدل حذفه حتى لا تنكسر سجلات التدقيق العامة.
    if user:
        user.is_active = False
    await db.commit()
    return {
        "id": rep_id,
        "deleted": True,
        "customers_deleted": len(customer_ids),
        "invoices_deleted": len(invoice_ids),
        "journals_deleted": len(journal_ids),
        "quotations_deleted": len(quotation_ids),
        "orders_deleted": len(order_ids),
        "message": "تم حذف توابع المندوب والقيود التابعة وتعطيل حساب الدخول",
    }


async def update_rep(db: AsyncSession, tenant_id: str, rep_id: str, data: dict) -> dict:
    r = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    rep = r.scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    if "phone" in data: rep.phone = data["phone"]
    if "zone" in data: rep.zone = data["zone"]
    if "notes" in data: rep.notes = data["notes"]
    if "is_active" in data:
        rep.is_active = data["is_active"]
        u_r = await db.execute(select(User).where(User.id == rep.user_id))
        user = u_r.scalar_one_or_none()
        if user: user.is_active = data["is_active"]
    if "full_name" in data:
        u_r = await db.execute(select(User).where(User.id == rep.user_id))
        user = u_r.scalar_one_or_none()
        if user:
            user.full_name = data["full_name"]
            wh_r = await db.execute(select(Warehouse).where(Warehouse.id == rep.warehouse_id))
            wh = wh_r.scalar_one_or_none()
            if wh: wh.name_ar = f"مستودع المندوب — {data['full_name']}"
    # عند تعديل مندوب موجود لا نلمس parent_id لحسابه المحاسبي؛
    # اختيار فرع المدينة كان يسبب نقل الحساب وفصل الشجرة عن ترتيبها.
    # إنشاء الحساب الجديد يتم في create_rep فقط. هنا نسمح بتغيير الرابط
    # إلى حساب مندوب موجود بشكل صريح، بدون إعادة ربطه أو نقل فروعه.
    if "customer_account_id" in data:
        account_id = data.get("customer_account_id")
        if not account_id:
            raise HTTPException(400, "لا يمكن إزالة حساب المندوب")
        linked_account = await db.get(Account, account_id)
        if not linked_account or linked_account.tenant_id != tenant_id:
            raise HTTPException(400, "حساب المندوب غير موجود لهذه الشركة")
        if not linked_account.is_active or not linked_account.is_customer_account:
            raise HTTPException(400, "يجب اختيار حساب مندوب نشط من شجرة الحسابات")
        rep.customer_account_id = linked_account.id

    # حقول جديدة
    for field in ["id_number", "id_expiry", "license_expiry",
                  "vehicle_plate", "vehicle_type", "vehicle_color",
                  "target_monthly", "commission_pct"]:
        if field in data:
            setattr(rep, field, data[field])

    await db.commit()
    return await get_rep(db, tenant_id, rep_id)


# ─── مخزون المندوب ────────────────────────────────────────────────────

async def _get_rep_stock_quantity(db: AsyncSession, tenant_id: str, warehouse_id: str | None) -> Decimal:
    """إجمالي الكمية الفعلية، بما فيها السريالات، من نفس مصدر قائمة المخزون."""
    if not warehouse_id:
        return Decimal("0")
    from app.modules.inventory.service import get_stock_by_warehouse
    rows = await get_stock_by_warehouse(db, tenant_id, warehouse_id)
    return sum((Decimal(str(row.get("quantity", 0))) for row in rows), Decimal("0"))


async def get_rep_stock(db: AsyncSession, tenant_id: str, rep_id: str) -> list:
    """جلب مخزون المندوب من مستودعه الخاص"""
    r = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    rep = r.scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    from app.modules.inventory.service import get_stock_by_warehouse
    return await get_stock_by_warehouse(db, tenant_id, rep.warehouse_id)


async def get_my_stock(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """جلب مخزون المندوب الحالي (من توكنه)"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    from app.modules.inventory.service import get_stock_by_warehouse
    return await get_stock_by_warehouse(db, tenant_id, rep.warehouse_id)


async def _get_rep_opening_balance(db: AsyncSession, tenant_id: str, rep_id: str) -> Decimal:
    """الرصيد الافتتاحي الحقيقي لعملاء المندوب من الحسابات والقيود المرحّلة."""
    account_ids = (await db.execute(
        select(Customer.ar_account_id).where(
            Customer.tenant_id == tenant_id,
            Customer.rep_id == rep_id,
            Customer.ar_account_id.is_not(None),
        )
    )).scalars().all()
    account_ids = [account_id for account_id in account_ids if account_id]
    if not account_ids:
        return Decimal("0")
    account_opening = (await db.execute(
        select(func.coalesce(func.sum(Account.opening_balance), 0)).where(
            Account.tenant_id == tenant_id, Account.id.in_(account_ids)
        )
    )).scalar() or 0
    journal_opening = (await db.execute(
        select(func.coalesce(func.sum(JournalEntryLine.debit - JournalEntryLine.credit), 0))
        .join(JournalEntry, JournalEntry.id == JournalEntryLine.entry_id)
        .where(
            JournalEntry.tenant_id == tenant_id,
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.source == "customer_opening_balance",
            JournalEntryLine.account_id.in_(account_ids),
        )
    )).scalar() or 0
    return Decimal(str(account_opening or 0)) + Decimal(str(journal_opening or 0))


async def get_my_summary(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """ملخص أداء المندوب الحالي — فقط الفواتير المؤكدة/المدفوعة"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    # إجمالي المبيعات — فقط confirmed/paid/partial
    sales_r = await db.execute(
        select(func.sum(Invoice.total), func.count(Invoice.id))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.rep_id == rep.id,
            Invoice.status.in_(["confirmed", "paid", "partial", "overdue"]),
        )
    )
    total_sales, invoice_count = sales_r.one()

    # المقبوضات
    pay_r = await db.execute(
        select(func.sum(Payment.amount))
        .where(Payment.tenant_id == tenant_id, Payment.rep_id == rep.id)
    )
    total_collected = pay_r.scalar() or Decimal("0")
    opening_balance = await _get_rep_opening_balance(db, tenant_id, rep.id)
    operational_outstanding = (total_sales or 0) - total_collected

    # إجمالي المخزون من المصدر الموحد، ويشمل الكميات والسريالات
    stock_qty = await _get_rep_stock_quantity(db, tenant_id, rep.warehouse_id)

    return {
        "rep_id": rep.id,
        "total_sales": float(total_sales or 0),
        "invoice_count": invoice_count or 0,
        "total_collected": float(total_collected),
        "opening_balance": float(opening_balance),
        "operational_outstanding": float(operational_outstanding),
        "outstanding": float(opening_balance + operational_outstanding),
        "stock_qty": float(stock_qty),
        "target_monthly": float(rep.target_monthly or 0),
        "commission_pct": float(rep.commission_pct or 0),
    }



    """جلب مخزون المندوب الحالي (من توكنه)"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    from app.modules.inventory.service import get_stock_by_warehouse
    return await get_stock_by_warehouse(db, tenant_id, rep.warehouse_id)


# ─── فواتير المندوب ───────────────────────────────────────────────────

async def get_rep_invoices(db: AsyncSession, tenant_id: str, rep_id: str) -> list:
    """جلب فواتير مندوب محدد — للمدير"""
    r = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    rep = r.scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    from sqlalchemy.orm import selectinload
    inv_r = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.lines))
        .where(Invoice.tenant_id == tenant_id, Invoice.rep_id == rep_id)
        .order_by(Invoice.created_at.desc())
    )
    return inv_r.scalars().all()


async def get_my_invoices(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """جلب فواتير المندوب الحالي"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    from sqlalchemy.orm import selectinload
    inv_r = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.lines))
        .where(Invoice.tenant_id == tenant_id, Invoice.rep_id == rep.id)
        .order_by(Invoice.created_at.desc())
    )
    return inv_r.scalars().all()


# ─── سندات القبض للمندوب ─────────────────────────────────────────────

async def get_my_payments(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """جلب سندات قبض المندوب الحالي"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    pay_r = await db.execute(
        select(Payment)
        .where(Payment.tenant_id == tenant_id, Payment.rep_id == rep.id)
        .order_by(Payment.created_at.desc())
    )
    return pay_r.scalars().all()


# ─── تحويل مخزون للمندوب ─────────────────────────────────────────────

async def allocate_stock_to_rep(
    db: AsyncSession, tenant_id: str, user_id: str,
    rep_id: str, items: list
) -> dict:
    """
    تحميل بضاعة للمندوب:
    items = [{"item_id": "...", "quantity": 10}, ...]
    تنقل من المستودع الرئيسي لمستودع المندوب
    """
    # جلب المندوب
    r = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    rep = r.scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    # جلب المستودع الرئيسي
    wh_r = await db.execute(
        select(Warehouse).where(Warehouse.tenant_id == tenant_id, Warehouse.is_default == True)
    )
    default_wh = wh_r.scalar_one_or_none()
    if not default_wh:
        raise HTTPException(400, "لا يوجد مستودع رئيسي. يرجى تعيين مستودع كافتراضي أولاً")

    from app.modules.inventory.service import transfer_stock

    transferred = []
    for item in items:
        result = await transfer_stock(
            db, tenant_id, user_id,
            item_id=item["item_id"],
            from_warehouse_id=default_wh.id,
            to_warehouse_id=rep.warehouse_id,
            quantity=Decimal(str(item["quantity"])),
            notes=f"تحميل مخزون للمندوب {rep.rep_code}",
        )
        transferred.append({
            "item_id": item["item_id"],
            "quantity": item["quantity"],
            **result,
        })

    return {
        "rep_id": rep_id,
        "rep_code": rep.rep_code,
        "warehouse_id": rep.warehouse_id,
        "transferred": transferred,
    }


# ─── ملخص أداء المندوب ───────────────────────────────────────────────

async def get_rep_summary(db: AsyncSession, tenant_id: str, rep_id: str) -> dict:
    """ملخص أداء المندوب: مبيعات + مخزون + مقبوضات"""
    r = await db.execute(
        select(SalesRep, User, Warehouse)
        .join(User, SalesRep.user_id == User.id)
        .join(Warehouse, SalesRep.warehouse_id == Warehouse.id)
        .where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    row = r.one_or_none()
    if not row:
        raise HTTPException(404, "المندوب غير موجود")
    rep, user, wh = row

    # إجمالي المبيعات — فقط الفواتير المؤكدة والمدفوعة
    sales_r = await db.execute(
        select(func.sum(Invoice.total), func.count(Invoice.id))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.rep_id == rep_id,
            Invoice.status.in_(["confirmed", "paid", "partial", "overdue"]),
        )
    )
    total_sales, invoice_count = sales_r.one()

    # إجمالي المقبوضات
    pay_r = await db.execute(
        select(func.sum(Payment.amount))
        .where(Payment.tenant_id == tenant_id, Payment.rep_id == rep_id)
    )
    total_collected = pay_r.scalar() or Decimal("0")
    opening_balance = await _get_rep_opening_balance(db, tenant_id, rep_id)
    operational_outstanding = (total_sales or 0) - total_collected
    # إجمالي المخزون من مصدر المخزون الموحد، ويشمل السريالات
    stock_qty = await _get_rep_stock_quantity(db, tenant_id, rep.warehouse_id)


    return {
        "rep_id": rep_id,
        "rep_code": rep.rep_code,
        "full_name": user.full_name,
        "zone": rep.zone,
        "warehouse_name": wh.name_ar,
        "total_sales": float(total_sales or 0),
        "invoice_count": invoice_count or 0,
        "total_collected": float(total_collected),
        "opening_balance": float(opening_balance),
        "operational_outstanding": float(operational_outstanding),
        "outstanding": float(opening_balance + operational_outstanding),
        "stock_qty": float(stock_qty),
    }


# ─── حضور المناديب اليومي ──────────────────────────────────────────────
SAUDI_TZ = ZoneInfo("Asia/Riyadh")
ATTENDANCE_START = time(17, 0)


def _saudi_now() -> datetime:
    """وقت السعودية الموثوق من الخادم، لا من جهاز المندوب."""
    return datetime.now(SAUDI_TZ)


def _is_attendance_window_open(local_now: datetime) -> bool:
    """نافذة التسجيل اليومية: 5 مساءً حتى قبل منتصف الليل."""
    return ATTENDANCE_START <= local_now.timetz().replace(tzinfo=None) <= time(23, 59, 59, 999999)


def _as_saudi_iso(value: datetime | None) -> str | None:
    if not value:
        return None
    # كل التواريخ في قاعدة النظام تُخزن UTC بلا tzinfo.
    from datetime import timezone
    return value.replace(tzinfo=timezone.utc).astimezone(SAUDI_TZ).isoformat()


async def _current_rep_for_user(db: AsyncSession, tenant_id: str, user_id: str) -> SalesRep:
    result = await db.execute(
        select(SalesRep).where(
            SalesRep.tenant_id == tenant_id,
            SalesRep.user_id == user_id,
            SalesRep.is_active == True,
        )
    )
    rep = result.scalar_one_or_none()
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً نشطاً")
    return rep


async def get_my_attendance_status(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """حالة حضور اليوم للمندوب، ويستخدمها مربع الحضور الإلزامي في لوحة المندوب."""
    rep = await _current_rep_for_user(db, tenant_id, user_id)
    local_now = _saudi_now()
    attendance_date = local_now.date()
    result = await db.execute(
        select(RepAttendance).where(
            RepAttendance.tenant_id == tenant_id,
            RepAttendance.rep_id == rep.id,
            RepAttendance.attendance_date == attendance_date,
        )
    )
    record = result.scalar_one_or_none()
    window_open = _is_attendance_window_open(local_now)
    return {
        "rep_id": rep.id,
        "attendance_date": attendance_date.isoformat(),
        "server_time": local_now.isoformat(),
        "window_open": window_open,
        "already_checked_in": bool(record),
        "requires_check_in": bool(window_open and not record),
        "check_in_at": _as_saudi_iso(record.check_in_at) if record else None,
        "status": record.status if record else "absent",
    }


async def check_in_my_attendance(db: AsyncSession, tenant_id: str, user_id: str, location: dict | None = None) -> dict:
    """يسجل الحضور بموقع الجهاز الحالي، أو بآخر نقطة تتبع حديثة أُرسلت تلقائياً."""
    rep = await _current_rep_for_user(db, tenant_id, user_id)
    requested_location = location or {}
    has_fresh_device_location = (
        requested_location.get("latitude") is not None
        and requested_location.get("longitude") is not None
    )

    if has_fresh_device_location:
        latitude, longitude = _validate_coordinates(
            requested_location.get("latitude"), requested_location.get("longitude")
        )
        try:
            accuracy = float(requested_location.get("accuracy")) if requested_location.get("accuracy") is not None else None
        except (TypeError, ValueError):
            raise HTTPException(400, "دقة موقع الحضور غير صحيحة")
        if accuracy is not None and (accuracy < 0 or accuracy > 10_000):
            raise HTTPException(400, "دقة موقع الحضور خارج النطاق")
        source = "rep_dashboard"
    else:
        latest_location_result = await db.execute(
            select(RepLocation)
            .where(RepLocation.tenant_id == tenant_id, RepLocation.rep_id == rep.id)
            .order_by(RepLocation.recorded_at.desc())
            .limit(1)
        )
        latest_location = latest_location_result.scalar_one_or_none()
        latest_allowed_at = datetime.utcnow() - timedelta(minutes=5)
        if not latest_location or latest_location.recorded_at < latest_allowed_at:
            raise HTTPException(400, "تعذر تسجيل الحضور تلقائياً، حاول مرة أخرى بعد لحظات")
        latitude = float(latest_location.latitude)
        longitude = float(latest_location.longitude)
        accuracy = float(latest_location.accuracy) if latest_location.accuracy is not None else None
        source = "rep_dashboard_tracking"
    local_now = _saudi_now()
    if not _is_attendance_window_open(local_now):
        raise HTTPException(400, "يبدأ تسجيل الحضور الساعة 5:00 مساءً بتوقيت السعودية")

    attendance_date = local_now.date()
    existing_result = await db.execute(
        select(RepAttendance).where(
            RepAttendance.tenant_id == tenant_id,
            RepAttendance.rep_id == rep.id,
            RepAttendance.attendance_date == attendance_date,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing:
        return {
            "id": existing.id,
            "attendance_date": attendance_date.isoformat(),
            "check_in_at": _as_saudi_iso(existing.check_in_at),
            "status": existing.status,
            "check_in_latitude": float(existing.check_in_latitude) if existing.check_in_latitude is not None else None,
            "check_in_longitude": float(existing.check_in_longitude) if existing.check_in_longitude is not None else None,
            "already_checked_in": True,
        }

    record = RepAttendance(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        rep_id=rep.id,
        attendance_date=attendance_date,
        check_in_at=local_now.astimezone(ZoneInfo("UTC")).replace(tzinfo=None),
        status="present",
        source=source,
        check_in_latitude=latitude,
        check_in_longitude=longitude,
        check_in_accuracy=accuracy,
        created_at=datetime.utcnow(),
    )
    db.add(record)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        # في حال ضغط المستخدم مرتين أو وصل طلبان معاً، نعيد السجل الموحّد.
        existing_result = await db.execute(
            select(RepAttendance).where(
                RepAttendance.tenant_id == tenant_id,
                RepAttendance.rep_id == rep.id,
                RepAttendance.attendance_date == attendance_date,
            )
        )
        existing = existing_result.scalar_one_or_none()
        if not existing:
            raise
        return {
            "id": existing.id,
            "attendance_date": attendance_date.isoformat(),
            "check_in_at": _as_saudi_iso(existing.check_in_at),
            "status": existing.status,
            "check_in_latitude": float(existing.check_in_latitude) if existing.check_in_latitude is not None else None,
            "check_in_longitude": float(existing.check_in_longitude) if existing.check_in_longitude is not None else None,
            "already_checked_in": True,
        }

    return {
        "id": record.id,
        "attendance_date": attendance_date.isoformat(),
        "check_in_at": _as_saudi_iso(record.check_in_at),
        "status": record.status,
        "check_in_latitude": latitude,
        "check_in_longitude": longitude,
        "check_in_accuracy": accuracy,
        "already_checked_in": False,
    }


async def get_rep_attendance(
    db: AsyncSession,
    tenant_id: str,
    attendance_date: str | None = None,
    rep_id: str | None = None,
) -> dict:
    """قائمة إدارية للحضور تعرض الحاضرين وغير المسجلين في تاريخ محدد."""
    local_today = _saudi_now().date()
    try:
        target_date = datetime.strptime(attendance_date, "%Y-%m-%d").date() if attendance_date else local_today
    except ValueError:
        raise HTTPException(400, "صيغة التاريخ يجب أن تكون YYYY-MM-DD")

    query = (
        select(SalesRep, User, RepAttendance)
        .join(User, User.id == SalesRep.user_id)
        .outerjoin(
            RepAttendance,
            and_(
                RepAttendance.tenant_id == SalesRep.tenant_id,
                RepAttendance.rep_id == SalesRep.id,
                RepAttendance.attendance_date == target_date,
            ),
        )
        .where(SalesRep.tenant_id == tenant_id, SalesRep.is_active == True)
        .order_by(User.full_name.asc())
    )
    if rep_id:
        query = query.where(SalesRep.id == rep_id)

    rows = (await db.execute(query)).all()
    records = []
    for rep, user, attendance in rows:
        records.append({
            "rep_id": rep.id,
            "rep_code": rep.rep_code,
            "rep_name": user.full_name,
            "attendance_date": target_date.isoformat(),
            "status": attendance.status if attendance else "absent",
            "check_in_at": _as_saudi_iso(attendance.check_in_at) if attendance else None,
            "check_in_latitude": float(attendance.check_in_latitude) if attendance and attendance.check_in_latitude is not None else None,
            "check_in_longitude": float(attendance.check_in_longitude) if attendance and attendance.check_in_longitude is not None else None,
            "check_in_accuracy": float(attendance.check_in_accuracy) if attendance and attendance.check_in_accuracy is not None else None,
            "source": attendance.source if attendance else None,
        })

    return {
        "attendance_date": target_date.isoformat(),
        "records": records,
        "summary": {
            "total": len(records),
            "present": sum(1 for item in records if item["status"] == "present"),
            "absent": sum(1 for item in records if item["status"] == "absent"),
        },
    }


# ─── حدود مناطق عمل المناديب ───────────────────────────────────────────
def _validate_coordinates(latitude: float, longitude: float) -> tuple[float, float]:
    try:
        lat, lng = float(latitude), float(longitude)
    except (TypeError, ValueError):
        raise HTTPException(400, "إحداثيات الموقع غير صحيحة")
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise HTTPException(400, "إحداثيات الموقع خارج النطاق المسموح")
    return lat, lng


def _distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """حساب المسافة الجغرافية بالمتر باستخدام Haversine."""
    earth_radius = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return earth_radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _point_in_polygon(latitude: float, longitude: float, points: list[dict]) -> bool:
    """اختبار شعاع بسيط للمضلع؛ النقاط بصيغة {lat, lng}."""
    inside = False
    j = len(points) - 1
    for i, point in enumerate(points):
        yi, xi = float(point["lat"]), float(point["lng"])
        yj, xj = float(points[j]["lat"]), float(points[j]["lng"])
        intersects = ((yi > latitude) != (yj > latitude)) and (
            longitude < (xj - xi) * (latitude - yi) / ((yj - yi) or 1e-15) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def _location_inside_zone(zone: RepGeoZone, latitude: float, longitude: float) -> bool:
    if zone.boundary_type == "circle":
        if zone.center_latitude is None or zone.center_longitude is None or zone.radius_meters is None:
            return False
        return _distance_meters(latitude, longitude, float(zone.center_latitude), float(zone.center_longitude)) <= float(zone.radius_meters)

    if zone.boundary_type == "polygon" and zone.polygon_json:
        try:
            points = json.loads(zone.polygon_json)
            return isinstance(points, list) and len(points) >= 3 and _point_in_polygon(latitude, longitude, points)
        except (ValueError, TypeError, KeyError):
            return False
    return False


def _serialize_geo_zone(zone: RepGeoZone | None) -> dict | None:
    if not zone:
        return None
    return {
        "id": zone.id,
        "rep_id": zone.rep_id,
        "name": zone.name,
        "boundary_type": zone.boundary_type,
        "center_latitude": float(zone.center_latitude) if zone.center_latitude is not None else None,
        "center_longitude": float(zone.center_longitude) if zone.center_longitude is not None else None,
        "radius_meters": float(zone.radius_meters) if zone.radius_meters is not None else None,
        "polygon": json.loads(zone.polygon_json) if zone.polygon_json else None,
        "is_active": zone.is_active,
    }


async def get_rep_geo_zone(db: AsyncSession, tenant_id: str, rep_id: str) -> dict | None:
    result = await db.execute(
        select(RepGeoZone).where(RepGeoZone.tenant_id == tenant_id, RepGeoZone.rep_id == rep_id)
    )
    return _serialize_geo_zone(result.scalar_one_or_none())


async def save_rep_geo_zone(db: AsyncSession, tenant_id: str, rep_id: str, data: dict) -> dict:
    rep_result = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id, SalesRep.is_active == True)
    )
    if not rep_result.scalar_one_or_none():
        raise HTTPException(404, "المندوب غير موجود أو غير نشط")

    boundary_type = data.get("boundary_type")
    if boundary_type not in {"circle", "polygon"}:
        raise HTTPException(400, "نوع المنطقة يجب أن يكون دائرة أو مضلعاً")

    center_latitude = center_longitude = radius_meters = polygon_json = None
    if boundary_type == "circle":
        center_latitude, center_longitude = _validate_coordinates(data.get("center_latitude"), data.get("center_longitude"))
        try:
            radius_meters = float(data.get("radius_meters"))
        except (TypeError, ValueError):
            raise HTTPException(400, "نصف القطر مطلوب بالمتر")
        if radius_meters < 10 or radius_meters > 100_000:
            raise HTTPException(400, "نصف القطر يجب أن يكون بين 10 و100000 متر")
    else:
        points = data.get("polygon")
        if not isinstance(points, list) or len(points) < 3:
            raise HTTPException(400, "المضلع يحتاج ثلاث نقاط على الأقل")
        safe_points = []
        for point in points:
            lat, lng = _validate_coordinates(point.get("lat"), point.get("lng"))
            safe_points.append({"lat": lat, "lng": lng})
        polygon_json = json.dumps(safe_points, ensure_ascii=False)

    existing_result = await db.execute(
        select(RepGeoZone).where(RepGeoZone.tenant_id == tenant_id, RepGeoZone.rep_id == rep_id)
    )
    zone = existing_result.scalar_one_or_none()
    if not zone:
        zone = RepGeoZone(id=str(uuid.uuid4()), tenant_id=tenant_id, rep_id=rep_id)
        db.add(zone)

    zone.name = str(data.get("name") or "منطقة عمل المندوب")[:200]
    zone.boundary_type = boundary_type
    zone.center_latitude = center_latitude
    zone.center_longitude = center_longitude
    zone.radius_meters = radius_meters
    zone.polygon_json = polygon_json
    zone.is_active = bool(data.get("is_active", True))
    zone.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(zone)
    return _serialize_geo_zone(zone) or {}


async def record_geo_transition(
    db: AsyncSession,
    tenant_id: str,
    rep: SalesRep,
    location_id: str,
    latitude: float,
    longitude: float,
    occurred_at: datetime,
) -> dict | None:
    """يفحص المنطقة عند وصول موقع جديد فقط؛ لا يغير حفظ الموقع ولا يولد تنبيهاً مكرراً."""
    zone_result = await db.execute(
        select(RepGeoZone).where(
            RepGeoZone.tenant_id == tenant_id,
            RepGeoZone.rep_id == rep.id,
            RepGeoZone.is_active == True,
        )
    )
    zone = zone_result.scalar_one_or_none()
    if not zone:
        return None

    inside = _location_inside_zone(zone, latitude, longitude)
    new_type = "entered" if inside else "exited"
    last_result = await db.execute(
        select(RepGeoEvent)
        .where(
            RepGeoEvent.tenant_id == tenant_id,
            RepGeoEvent.rep_id == rep.id,
            RepGeoEvent.zone_id == zone.id,
            RepGeoEvent.occurred_at >= zone.updated_at,
        )
        .order_by(RepGeoEvent.occurred_at.desc())
        .limit(1)
    )
    last_event = last_result.scalar_one_or_none()
    if last_event and last_event.event_type == new_type:
        return None

    initial = last_event is None
    event = RepGeoEvent(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        rep_id=rep.id,
        zone_id=zone.id,
        event_type=new_type,
        is_initial=initial,
        latitude=latitude,
        longitude=longitude,
        source_location_id=location_id,
        occurred_at=occurred_at,
        created_at=datetime.utcnow(),
    )
    db.add(event)

    if not initial:
        managers = await db.execute(
            select(User.id).where(User.tenant_id == tenant_id, User.role.in_(["manager", "accountant"]))
        )
        rep_name_result = await db.execute(select(User.full_name).where(User.id == rep.user_id))
        rep_name = rep_name_result.scalar_one_or_none() or rep.rep_code
        verb_ar, verb_en = ("دخل", "entered") if new_type == "entered" else ("خرج", "left")
        for manager_id in managers.scalars().all():
            db.add(Notification(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                user_id=manager_id,
                type=NotificationType.GENERAL,
                severity=NotificationSeverity.WARNING,
                title_ar=f"{verb_ar} المندوب منطقة العمل",
                title_en=f"Rep {verb_en} work zone",
                message_ar=f"المندوب {rep_name} {verb_ar} منطقة العمل: {zone.name}.",
                message_en=f"Rep {rep_name} {verb_en} the work zone: {zone.name}.",
                reference_id=event.id,
                reference_type="rep_geo_event",
                created_at=datetime.utcnow(),
            ))

    return {"event_type": new_type, "is_initial": initial, "zone_id": zone.id}


async def get_rep_geo_events(
    db: AsyncSession,
    tenant_id: str,
    rep_id: str,
    date_value: str | None = None,
) -> list[dict]:
    query = select(RepGeoEvent).where(RepGeoEvent.tenant_id == tenant_id, RepGeoEvent.rep_id == rep_id)
    if date_value:
        try:
            target = datetime.strptime(date_value, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(400, "صيغة التاريخ يجب أن تكون YYYY-MM-DD")
        from datetime import timedelta
        start = datetime.combine(target, time.min)
        end = start + timedelta(days=1)
        query = query.where(RepGeoEvent.occurred_at >= start, RepGeoEvent.occurred_at < end)
    result = await db.execute(query.order_by(RepGeoEvent.occurred_at.asc()))
    return [{
        "id": event.id,
        "event_type": event.event_type,
        "is_initial": event.is_initial,
        "latitude": float(event.latitude),
        "longitude": float(event.longitude),
        "occurred_at": _as_saudi_iso(event.occurred_at),
    } for event in result.scalars().all()]
