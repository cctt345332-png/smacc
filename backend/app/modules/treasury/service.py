import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.treasury import Voucher, VoucherType, VoucherStatus, PaymentMethod


async def _next_number(db: AsyncSession, tenant_id: str, vtype: VoucherType) -> str:
    prefix = {"receipt": "RV", "discount": "DV", "payment": "PV", "expense": "EX", "transfer": "TR"}[vtype.value]
    r = await db.execute(
        select(func.count(Voucher.id)).where(
            Voucher.tenant_id == tenant_id,
            Voucher.voucher_type == vtype
        )
    )
    return f"{prefix}-{str((r.scalar() or 0) + 1).zfill(5)}"


async def get_vouchers(db: AsyncSession, tenant_id: str,
                        vtype: str | None = None, status: str | None = None):
    q = select(Voucher).where(Voucher.tenant_id == tenant_id)
    if vtype:
        q = q.where(Voucher.voucher_type == vtype)
    if status:
        q = q.where(Voucher.status == status)
    q = q.order_by(Voucher.voucher_date.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def get_voucher(db: AsyncSession, tenant_id: str, voucher_id: str):
    v = await db.get(Voucher, voucher_id)
    if not v or v.tenant_id != tenant_id:
        raise HTTPException(404, "Voucher not found")
    return v


async def create_voucher(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    vtype = VoucherType(data["voucher_type"])
    voucher_date = datetime.fromisoformat(data["voucher_date"]).replace(tzinfo=None)
    cheque_date = datetime.fromisoformat(data["cheque_date"]).replace(tzinfo=None) if data.get("cheque_date") else None

    # مصروف الشركة يستخدم روابط الحسابات التشغيلية تلقائيًا، مع إبقاء
    # الحسابات المرسلة من الواجهة نافذة إذا أراد المحاسب تخصيص القيد.
    debit_account_id = data.get("debit_account_id")
    credit_account_id = data.get("credit_account_id")
    vat_account_id = data.get("vat_account_id")
    if vtype == VoucherType.EXPENSE:
        from app.modules.accounting.service import get_operational_account
        payment_mapping = {"cash": "default_cash", "bank_transfer": "default_bank", "cheque": "default_bank"}
        if not debit_account_id:
            debit_account_id = (await get_operational_account(db, tenant_id, "operating_expenses")).id
        if not credit_account_id:
            credit_account_id = (await get_operational_account(
                db, tenant_id, payment_mapping.get(data.get("payment_method", "cash"), "default_cash")
            )).id
        if data.get("vat_amount", 0) and not vat_account_id:
            vat_account_id = (await get_operational_account(db, tenant_id, "vat_input")).id

    voucher = Voucher(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        voucher_number=await _next_number(db, tenant_id, vtype),
        voucher_type=vtype,
        voucher_date=voucher_date,
        cheque_date=cheque_date,
        amount=Decimal(str(data["amount"])),
        vat_amount=Decimal(str(data.get("vat_amount", 0))),
        currency_code=data.get("currency_code", "SAR"),
        payment_method=PaymentMethod(data.get("payment_method", "cash")),
        bank_account_id=data.get("bank_account_id"),
        cheque_number=data.get("cheque_number"),
        party_type=data.get("party_type"),
        party_id=data.get("party_id"),
        party_name=data.get("party_name"),
        invoice_id=data.get("invoice_id"),
        purchase_id=data.get("purchase_id"),
        asset_id=data.get("asset_id"),
        expense_category=data.get("expense_category"),
        debit_account_id=debit_account_id,
        credit_account_id=credit_account_id,
        cost_center_id=data.get("cost_center_id"),
        fiscal_year_id=data.get("fiscal_year_id"),
        to_bank_account_id=data.get("to_bank_account_id"),
        description_ar=data["description_ar"],
        description_en=data.get("description_en"),
        notes=data.get("notes"),
        reference=data.get("reference"),
        vat_account_id=vat_account_id,
        created_by=user_id,
    )
    db.add(voucher)
    await db.commit()
    await db.refresh(voucher)
    return voucher


async def create_expense_batch(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    """إنشاء عدة مصروفات وترحيلها داخل قيد يومية واحد."""
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import _next_entry_number, get_operational_account
    items = data.get("items") or []
    if not items:
        raise HTTPException(400, "يجب إضافة مصروف واحد على الأقل")
    fiscal_year_id = data.get("fiscal_year_id")
    if not fiscal_year_id:
        raise HTTPException(400, "السنة المالية مطلوبة")
    payment_mapping = {"cash": "default_cash", "bank_transfer": "default_bank", "cheque": "default_bank"}
    prepared, total = [], Decimal("0")
    for index, item in enumerate(items):
        gross = Decimal(str(item.get("total_amount") or item.get("amount") or 0))
        if gross <= 0:
            raise HTTPException(400, f"مبلغ المصروف رقم {index + 1} غير صحيح")
        net = (gross / Decimal("1.15")).quantize(Decimal("0.01")); vat = gross - net
        method = item.get("payment_method", "cash")
        debit = item.get("debit_account_id") or (await get_operational_account(db, tenant_id, "operating_expenses")).id
        credit = item.get("credit_account_id") or (await get_operational_account(db, tenant_id, payment_mapping.get(method, "default_cash"))).id
        vat_account = item.get("vat_account_id")
        if vat > 0 and not vat_account:
            vat_account = (await get_operational_account(db, tenant_id, "vat_input")).id
        description = (item.get("description_ar") or "").strip()
        if not description:
            raise HTTPException(400, f"بيان المصروف رقم {index + 1} مطلوب")
        prepared.append({"item": item, "gross": gross, "net": net, "vat": vat, "debit": debit, "credit": credit, "vat_account": vat_account, "method": method, "description": description})
        total += gross
    entry_id = str(uuid.uuid4())
    entry = JournalEntry(id=entry_id, tenant_id=tenant_id, entry_number=await _next_entry_number(db, tenant_id), entry_date=datetime.fromisoformat(data["voucher_date"]).replace(tzinfo=None), fiscal_year_id=fiscal_year_id, description_ar=data.get("description_ar") or f"ترحيل {len(prepared)} مصروفات", description_en=data.get("description_en"), status=JournalEntryStatus.POSTED, source="expense_batch", reference=data.get("reference"), total_debit=total, total_credit=total, created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow())
    db.add(entry); vouchers, order, credits = [], 0, {}
    for index, row in enumerate(prepared):
        item = row["item"]
        voucher = Voucher(id=str(uuid.uuid4()), tenant_id=tenant_id, voucher_number=f"EX-B-{datetime.utcnow().strftime('%y%m%d')}-{index + 1:03d}", voucher_type=VoucherType.EXPENSE, status=VoucherStatus.POSTED, voucher_date=datetime.fromisoformat(item.get("voucher_date", data["voucher_date"])).replace(tzinfo=None), amount=row["net"], vat_amount=row["vat"], currency_code="SAR", payment_method=PaymentMethod(row["method"]), party_type="other", party_name=item.get("party_name"), expense_category=item.get("expense_category", "other"), debit_account_id=row["debit"], credit_account_id=row["credit"], vat_account_id=row["vat_account"], cost_center_id=item.get("cost_center_id"), fiscal_year_id=fiscal_year_id, journal_entry_id=entry_id, description_ar=row["description"], notes=item.get("notes"), reference=item.get("reference"), created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow())
        db.add(voucher); vouchers.append(voucher)
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry_id, account_id=row["debit"], cost_center_id=item.get("cost_center_id"), description=row["description"], debit=row["net"], credit=Decimal("0"), line_order=order)); order += 1
        if row["vat"] > 0:
            db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry_id, account_id=row["vat_account"], description="ضريبة القيمة المضافة", debit=row["vat"], credit=Decimal("0"), line_order=order)); order += 1
        key = (row["credit"], row["method"]); credits[key] = credits.get(key, Decimal("0")) + row["gross"]
    for (account_id, method), amount in credits.items():
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry_id, account_id=account_id, description=f"مصروفات مجمعة — {method}", debit=Decimal("0"), credit=amount, line_order=order)); order += 1
    await db.commit()
    return {"journal_entry_id": entry_id, "count": len(vouchers), "total": total, "vouchers": vouchers}


async def post_voucher(db: AsyncSession, tenant_id: str, user_id: str, voucher_id: str):
    """ترحيل السند وإنشاء القيد المحاسبي"""
    voucher = await get_voucher(db, tenant_id, voucher_id)
    if voucher.status != VoucherStatus.DRAFT:
        raise HTTPException(400, "Only draft vouchers can be posted")

    if not voucher.debit_account_id or not voucher.credit_account_id:
        raise HTTPException(400, "Debit and credit accounts are required to post")

    if not voucher.fiscal_year_id:
        raise HTTPException(400, "Fiscal year is required to post")

    journal_id = await _create_voucher_journal(db, tenant_id, user_id, voucher)
    voucher.journal_entry_id = journal_id
    voucher.status = VoucherStatus.POSTED
    voucher.posted_by = user_id
    voucher.posted_at = datetime.utcnow()

    # ── ربط الأصول الثابتة ──────────────────────────────────────────
    # إذا السند مرتبط بأصل → نحدث تكلفة الأصل أو ننشئ أصل جديد
    if voucher.asset_id and voucher.voucher_type == VoucherType.PAYMENT:
        await _link_asset_purchase(db, tenant_id, voucher)

    await db.commit()
    await db.refresh(voucher)
    return voucher


async def _link_asset_purchase(db: AsyncSession, tenant_id: str, voucher: Voucher):
    """
    ربط سند الصرف بالأصل الثابت:
    - يُسجَّل الدفع في ملاحظات الأصل
    - إذا كان شراء أصل جديد → يُحدَّث تكلفة الشراء
    """
    from app.models.assets import Asset
    asset = await db.get(Asset, voucher.asset_id)
    if not asset or asset.tenant_id != tenant_id:
        return

    note = f"دفعة بتاريخ {voucher.voucher_date.strftime('%Y-%m-%d')} — {voucher.amount} ر.س — سند {voucher.voucher_number}"
    asset.notes = (asset.notes + "\n" + note) if asset.notes else note


async def _link_asset_purchase(db: AsyncSession, tenant_id: str, voucher: "Voucher"):
    """ربط سند الصرف بالأصل الثابت — تحديث تكلفة الأصل"""
    from app.models.assets import Asset
    asset = await db.get(Asset, voucher.asset_id)
    if not asset or asset.tenant_id != tenant_id:
        return
    # إضافة مبلغ السند لتكلفة الأصل (في حالة مصاريف إضافية)
    asset.purchase_cost += voucher.amount
    asset.book_value = asset.purchase_cost - asset.accumulated_depreciation


async def _create_voucher_journal(db: AsyncSession, tenant_id: str, user_id: str, voucher: Voucher) -> str:
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import _next_entry_number

    total = voucher.amount + voucher.vat_amount

    entry_number = await _next_entry_number(db, tenant_id)
    entry = JournalEntry(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=voucher.voucher_date,
        fiscal_year_id=voucher.fiscal_year_id,
        description_ar=voucher.description_ar,
        description_en=voucher.description_en,
        status=JournalEntryStatus.POSTED,
        source=voucher.voucher_type.value,
        reference=voucher.voucher_number,
        total_debit=total,
        total_credit=total,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(entry)

    # مدين
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=voucher.debit_account_id,
        cost_center_id=voucher.cost_center_id,
        description=voucher.description_ar,
        debit=voucher.amount, credit=Decimal("0"), line_order=0,
    ))

    # ضريبة القيمة المضافة (للمصروفات)
    if voucher.vat_amount > 0 and voucher.vat_account_id:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=voucher.vat_account_id,
            description="ضريبة القيمة المضافة",
            debit=voucher.vat_amount, credit=Decimal("0"), line_order=1,
        ))

    # دائن
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=voucher.credit_account_id,
        description=voucher.description_ar,
        debit=Decimal("0"), credit=total, line_order=2,
    ))

    return entry.id


async def cancel_voucher(db: AsyncSession, tenant_id: str, voucher_id: str):
    voucher = await get_voucher(db, tenant_id, voucher_id)
    if voucher.status == VoucherStatus.CANCELLED:
        raise HTTPException(400, "Already cancelled")
    if voucher.status == VoucherStatus.POSTED:
        raise HTTPException(400, "Cannot cancel a posted voucher — create a reversal entry instead")
    voucher.status = VoucherStatus.CANCELLED
    await db.commit()
    return voucher


async def get_summary(db: AsyncSession, tenant_id: str):
    """ملخص الخزينة"""
    r = await db.execute(
        select(Voucher).where(
            Voucher.tenant_id == tenant_id,
            Voucher.status == VoucherStatus.POSTED
        )
    )
    vouchers = r.scalars().all()

    total_receipts = sum(v.amount for v in vouchers if v.voucher_type == VoucherType.RECEIPT)
    total_payments = sum(v.amount for v in vouchers if v.voucher_type == VoucherType.PAYMENT)
    total_expenses = sum(v.amount for v in vouchers if v.voucher_type == VoucherType.EXPENSE)
    draft_count = 0
    r2 = await db.execute(select(func.count(Voucher.id)).where(Voucher.tenant_id == tenant_id, Voucher.status == VoucherStatus.DRAFT))
    draft_count = r2.scalar() or 0

    return {
        "total_receipts": float(total_receipts),
        "total_payments": float(total_payments),
        "total_expenses": float(total_expenses),
        "net_cash": float(total_receipts - total_payments - total_expenses),
        "draft_count": draft_count,
    }
