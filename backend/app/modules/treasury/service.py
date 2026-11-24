import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.treasury import Voucher, Treasury, VoucherType, VoucherStatus, PaymentMethod
from app.models.accounting import Account


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


async def _treasury_view(db: AsyncSession, treasury: Treasury, tenant_id: str):
    rows = (await db.execute(select(Voucher).where(
        Voucher.tenant_id == tenant_id,
        (Voucher.treasury_id == treasury.id) | (Voucher.to_treasury_id == treasury.id),
        Voucher.status == VoucherStatus.POSTED,
    ))).scalars().all()
    incoming = sum((v.amount for v in rows if v.voucher_type == VoucherType.RECEIPT or (v.voucher_type == VoucherType.TRANSFER and v.to_treasury_id == treasury.id)), Decimal("0"))
    outgoing = sum((v.amount + (v.vat_amount or 0) for v in rows if v.voucher_type in {VoucherType.PAYMENT, VoucherType.EXPENSE} or (v.voucher_type == VoucherType.TRANSFER and v.treasury_id == treasury.id)), Decimal("0"))
    return {
        "id": treasury.id, "name_ar": treasury.name_ar, "name_en": treasury.name_en,
        "branch_name": treasury.branch_name, "account_id": treasury.account_id,
        "opening_balance": float(treasury.opening_balance or 0), "incoming": float(incoming),
        "outgoing": float(outgoing), "balance": float((treasury.opening_balance or 0) + incoming - outgoing),
        "is_active": treasury.is_active, "notes": treasury.notes,
    }


async def get_treasuries(db: AsyncSession, tenant_id: str, include_inactive: bool = False):
    q = select(Treasury).where(Treasury.tenant_id == tenant_id).order_by(Treasury.name_ar)
    if not include_inactive:
        q = q.where(Treasury.is_active.is_(True))
    rows = (await db.execute(q)).scalars().all()
    return [await _treasury_view(db, row, tenant_id) for row in rows]


async def create_treasury(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    name = str(data.get("name_ar") or "").strip()
    account_id = data.get("account_id")
    if not name or not account_id:
        raise HTTPException(400, "اسم الخزينة والحساب المحاسبي مطلوبان")
    account = await db.get(Account, account_id)
    if not account or account.tenant_id != tenant_id or not account.is_active or not account.is_posting:
        raise HTTPException(400, "الحساب المحاسبي غير صالح أو غير قابل للترحيل")
    row = Treasury(id=str(uuid.uuid4()), tenant_id=tenant_id, name_ar=name,
                   name_en=data.get("name_en"), branch_name=data.get("branch_name"),
                   account_id=account_id, opening_balance=Decimal(str(data.get("opening_balance") or 0)),
                   is_active=bool(data.get("is_active", True)), notes=data.get("notes"),
                   created_by=user_id, created_at=datetime.utcnow())
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return await _treasury_view(db, row, tenant_id)


async def update_treasury(db: AsyncSession, tenant_id: str, treasury_id: str, data: dict):
    row = await db.scalar(select(Treasury).where(Treasury.id == treasury_id, Treasury.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "الخزينة غير موجودة")
    if "account_id" in data:
        account = await db.get(Account, data["account_id"])
        if not account or account.tenant_id != tenant_id or not account.is_active or not account.is_posting:
            raise HTTPException(400, "الحساب المحاسبي غير صالح أو غير قابل للترحيل")
        row.account_id = data["account_id"]
    for key in ("name_ar", "name_en", "branch_name", "notes"):
        if key in data:
            setattr(row, key, data[key])
    if "is_active" in data:
        row.is_active = bool(data["is_active"])
    await db.commit()
    await db.refresh(row)
    return await _treasury_view(db, row, tenant_id)


async def get_treasury_movements(db: AsyncSession, tenant_id: str, treasury_id: str):
    row = await db.scalar(select(Treasury).where(Treasury.id == treasury_id, Treasury.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "الخزينة غير موجودة")
    vouchers = (await db.execute(select(Voucher).where(
        Voucher.tenant_id == tenant_id, (Voucher.treasury_id == treasury_id) | (Voucher.to_treasury_id == treasury_id),
        Voucher.status == VoucherStatus.POSTED,
    ).order_by(Voucher.voucher_date, Voucher.created_at))).scalars().all()
    balance = Decimal(str(row.opening_balance or 0)); result = []
    if balance:
        result.append({"date": None, "voucher_number": "OPENING", "description_ar": "الرصيد الافتتاحي", "incoming": float(balance), "outgoing": 0, "balance": float(balance)})
    for voucher in vouchers:
        incoming = voucher.amount if voucher.voucher_type == VoucherType.RECEIPT or (voucher.voucher_type == VoucherType.TRANSFER and voucher.to_treasury_id == treasury_id) else Decimal("0")
        outgoing = voucher.amount + (voucher.vat_amount or 0) if voucher.voucher_type in {VoucherType.PAYMENT, VoucherType.EXPENSE} or (voucher.voucher_type == VoucherType.TRANSFER and voucher.treasury_id == treasury_id) else Decimal("0")
        balance += incoming - outgoing
        result.append({"date": voucher.voucher_date, "voucher_id": voucher.id, "voucher_number": voucher.voucher_number, "description_ar": voucher.description_ar, "voucher_type": voucher.voucher_type.value, "incoming": float(incoming), "outgoing": float(outgoing), "balance": float(balance)})
    return {"treasury": await _treasury_view(db, row, tenant_id), "movements": result}


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
    treasury_id = data.get("treasury_id")
    if treasury_id:
        treasury = await db.scalar(select(Treasury).where(Treasury.id == treasury_id, Treasury.tenant_id == tenant_id, Treasury.is_active.is_(True)))
        if not treasury:
            raise HTTPException(400, "الخزينة غير موجودة أو غير فعالة")
        if vtype == VoucherType.TRANSFER and data.get("to_treasury_id"):
            destination = await db.scalar(select(Treasury).where(Treasury.id == data["to_treasury_id"], Treasury.tenant_id == tenant_id, Treasury.is_active.is_(True)))
            if not destination or destination.id == treasury.id:
                raise HTTPException(400, "حدد خزينة وجهة فعالة ومختلفة عن خزينة المصدر")
            debit_account_id = destination.account_id
            credit_account_id = treasury.account_id
        elif vtype == VoucherType.RECEIPT:
            debit_account_id = treasury.account_id
        elif vtype in {VoucherType.PAYMENT, VoucherType.EXPENSE}:
            credit_account_id = treasury.account_id
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

    if vtype in {VoucherType.RECEIPT, VoucherType.PAYMENT}:
        # الجهة والحسابات التفصيلية اختيارية في السندات العامة.
        from app.modules.accounting.service import get_operational_account
        party_type = data.get("party_type")
        if vtype == VoucherType.RECEIPT:
            if not debit_account_id:
                debit_account_id = (await get_operational_account(db, tenant_id, "default_cash")).id
            if not credit_account_id:
                credit_account_id = (await get_operational_account(
                    db, tenant_id,
                    "default_ar" if party_type == "customer" and data.get("party_id") else "other_income"
                )).id
        else:
            if not credit_account_id:
                credit_account_id = (await get_operational_account(db, tenant_id, "default_cash")).id
            if not debit_account_id:
                debit_account_id = (await get_operational_account(
                    db, tenant_id,
                    "default_ap" if party_type == "vendor" and data.get("party_id")
                    else "default_ar" if party_type == "customer" and data.get("party_id")
                    else "operating_expenses"
                )).id

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
        treasury_id=treasury_id,
        to_treasury_id=data.get("to_treasury_id"),
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
