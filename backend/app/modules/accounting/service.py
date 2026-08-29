import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, delete, update
from fastapi import HTTPException

from app.models.accounting import (
    Account, FiscalYear, CostCenter, Currency,
    JournalEntry, JournalEntryLine, BankAccount,
    Budget, BudgetLine, VATSetting, AccountingSetup, AccountingAccountMapping,
    JournalEntryStatus, AccountType, AccountNature
)
from app.modules.accounting.default_chart import DEFAULT_CHART, DEFAULT_MAPPING_CODES, REQUIRED_MAPPING_KEYS
from app.modules.accounting.legacy_company_chart import (
    LEGACY_COMPANY_CHART,
    LEGACY_CUSTOMER_ACCOUNT_SOURCE_KEYS,
)
from app.modules.accounting.schemas import (
    AccountCreate, AccountUpdate, FiscalYearCreate, CostCenterCreate,
    CurrencyCreate, JournalEntryCreate, BankAccountCreate,
    BudgetCreate, VATSettingUpdate
)


# ─── Accounts ────────────────────────────────────────────────────────
async def get_accounts(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(Account).where(Account.tenant_id == tenant_id).order_by(Account.code)
    )
    return r.scalars().all()


async def get_customer_receivable_accounts(db: AsyncSession, tenant_id: str):
    """يعيد حسابات العملاء وفروعها الرئيسية لاختيار مكان الحساب الفرعي."""
    result = await db.execute(
        select(Account).where(
            Account.tenant_id == tenant_id,
            Account.is_active.is_(True),
            Account.account_type == AccountType.ASSET,
            Account.nature == AccountNature.DEBIT,
            Account.is_posting.is_(False),
            or_(Account.is_customer_account.is_(True), Account.code.like("113%")),
        ).order_by(Account.code, Account.name_ar)
    )
    return result.scalars().all()


async def create_account(db: AsyncSession, tenant_id: str, data: AccountCreate):
    level = 1
    if data.parent_id:
        parent = await db.get(Account, data.parent_id)
        if not parent or parent.tenant_id != tenant_id:
            raise HTTPException(404, "Parent account not found")
        level = parent.level + 1

    # Check code uniqueness per tenant
    existing = await db.execute(
        select(Account).where(Account.tenant_id == tenant_id, Account.code == data.code)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Account code already exists")

    acc = Account(id=str(uuid.uuid4()), tenant_id=tenant_id, level=level, **data.model_dump())
    db.add(acc)
    await db.commit()
    await db.refresh(acc)
    return acc


async def update_account(db: AsyncSession, tenant_id: str, account_id: str, data: AccountUpdate):
    acc = await db.get(Account, account_id)
    if not acc or acc.tenant_id != tenant_id:
        raise HTTPException(404, "Account not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(acc, k, v)
    await db.commit()
    await db.refresh(acc)
    return acc


async def delete_account(db: AsyncSession, tenant_id: str, account_id: str):
    acc = await db.get(Account, account_id)
    if not acc or acc.tenant_id != tenant_id:
        raise HTTPException(404, "Account not found")
    # Check if used in journal lines
    used = await db.execute(
        select(JournalEntryLine).where(JournalEntryLine.account_id == account_id).limit(1)
    )
    if used.scalar_one_or_none():
        raise HTTPException(400, "Cannot delete account with journal entries")
    await db.delete(acc)
    await db.commit()


# ─── Fiscal Years ────────────────────────────────────────────────────
async def get_fiscal_years(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(FiscalYear).where(FiscalYear.tenant_id == tenant_id).order_by(FiscalYear.start_date.desc())
    )
    return r.scalars().all()


async def create_fiscal_year(db: AsyncSession, tenant_id: str, data: FiscalYearCreate):
    # Strip timezone info to store as naive datetime
    start = data.start_date.replace(tzinfo=None)
    end = data.end_date.replace(tzinfo=None)
    fy = FiscalYear(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        name=data.name,
        start_date=start,
        end_date=end,
        is_default=data.is_default,
    )
    db.add(fy)
    await db.commit()
    await db.refresh(fy)
    return fy


async def close_fiscal_year(db: AsyncSession, tenant_id: str, fy_id: str):
    fy = await db.get(FiscalYear, fy_id)
    if not fy or fy.tenant_id != tenant_id:
        raise HTTPException(404, "Fiscal year not found")
    from app.models.accounting import FiscalYearStatus
    fy.status = FiscalYearStatus.CLOSED
    await db.commit()
    return fy


# ─── Cost Centers ────────────────────────────────────────────────────
async def get_cost_centers(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(CostCenter).where(CostCenter.tenant_id == tenant_id).order_by(CostCenter.code)
    )
    return r.scalars().all()


async def create_cost_center(db: AsyncSession, tenant_id: str, data: CostCenterCreate):
    cc = CostCenter(id=str(uuid.uuid4()), tenant_id=tenant_id, **data.model_dump())
    db.add(cc)
    await db.commit()
    await db.refresh(cc)
    return cc


# ─── Currencies ──────────────────────────────────────────────────────
async def get_currencies(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(Currency).where(Currency.tenant_id == tenant_id)
    )
    return r.scalars().all()


async def create_currency(db: AsyncSession, tenant_id: str, data: CurrencyCreate):
    cur = Currency(id=str(uuid.uuid4()), tenant_id=tenant_id, updated_at=datetime.utcnow(), **data.model_dump())
    db.add(cur)
    await db.commit()
    await db.refresh(cur)
    return cur


# ─── Journal Entries ─────────────────────────────────────────────────
async def _next_entry_number(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(
        select(func.count(JournalEntry.id)).where(JournalEntry.tenant_id == tenant_id)
    )
    count = r.scalar() or 0
    return f"JE-{str(count + 1).zfill(5)}"


async def get_journal_entries(db: AsyncSession, tenant_id: str, status: str | None = None,
                               from_date: datetime | None = None, to_date: datetime | None = None):
    q = select(JournalEntry).where(JournalEntry.tenant_id == tenant_id)
    if status:
        q = q.where(JournalEntry.status == status)
    if from_date:
        q = q.where(JournalEntry.entry_date >= from_date)
    if to_date:
        q = q.where(JournalEntry.entry_date <= to_date)
    q = q.order_by(JournalEntry.entry_date.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def get_journal_entry(db: AsyncSession, tenant_id: str, entry_id: str):
    entry = await db.get(JournalEntry, entry_id)
    if not entry or entry.tenant_id != tenant_id:
        raise HTTPException(404, "Journal entry not found")
    return entry


async def create_journal_entry(db: AsyncSession, tenant_id: str, user_id: str, data: JournalEntryCreate):
    # Validate balanced entry
    total_debit = sum(l.debit for l in data.lines)
    total_credit = sum(l.credit for l in data.lines)
    if abs(total_debit - total_credit) > Decimal("0.01"):
        raise HTTPException(400, f"Entry not balanced: debit={total_debit} credit={total_credit}")

    account_ids = {line.account_id for line in data.lines}
    account_rows = await db.execute(
        select(Account).where(Account.tenant_id == tenant_id, Account.id.in_(account_ids))
    )
    accounts_by_id = {account.id: account for account in account_rows.scalars().all()}
    if len(accounts_by_id) != len(account_ids):
        raise HTTPException(400, "يوجد حساب غير تابع للشركة الحالية")
    invalid_accounts = [
        account.code for account in accounts_by_id.values()
        if not account.is_active or not account.is_posting or not account.allow_direct_posting
    ]
    if invalid_accounts:
        raise HTTPException(400, f"الحسابات التالية غير قابلة للقيد: {', '.join(invalid_accounts)}")

    entry_number = await _next_entry_number(db, tenant_id)
    entry_date = data.entry_date.replace(tzinfo=None)
    entry = JournalEntry(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        entry_number=entry_number,
        created_by=user_id,
        total_debit=total_debit,
        total_credit=total_credit,
        entry_date=entry_date,
        fiscal_year_id=data.fiscal_year_id,
        description_ar=data.description_ar,
        description_en=data.description_en,
        reference=data.reference,
        currency_id=data.currency_id,
        exchange_rate=data.exchange_rate,
        notes=data.notes,
    )
    db.add(entry)

    for i, line in enumerate(data.lines):
        jl = JournalEntryLine(
            id=str(uuid.uuid4()),
            entry_id=entry.id,
            line_order=i,
            **line.model_dump(),
        )
        db.add(jl)

    await db.commit()
    await db.refresh(entry)
    return entry


async def post_journal_entry(db: AsyncSession, tenant_id: str, user_id: str, entry_id: str):
    entry = await get_journal_entry(db, tenant_id, entry_id)
    if entry.status != JournalEntryStatus.DRAFT:
        raise HTTPException(400, "Only draft entries can be posted")
    entry.status = JournalEntryStatus.POSTED
    entry.posted_by = user_id
    entry.posted_at = datetime.utcnow()
    await db.commit()
    await db.refresh(entry)
    return entry


async def cancel_journal_entry(db: AsyncSession, tenant_id: str, entry_id: str):
    entry = await get_journal_entry(db, tenant_id, entry_id)
    if entry.status == JournalEntryStatus.CANCELLED:
        raise HTTPException(400, "Already cancelled")
    entry.status = JournalEntryStatus.CANCELLED
    await db.commit()
    return entry


async def reverse_journal_entry(db: AsyncSession, tenant_id: str, user_id: str, entry_id: str):
    """Create a reversal entry (swap debit/credit)"""
    original = await get_journal_entry(db, tenant_id, entry_id)
    if original.status != JournalEntryStatus.POSTED:
        raise HTTPException(400, "Only posted entries can be reversed")

    # Load lines
    lines_r = await db.execute(
        select(JournalEntryLine).where(JournalEntryLine.entry_id == entry_id)
    )
    lines = lines_r.scalars().all()

    entry_number = await _next_entry_number(db, tenant_id)
    reversal = JournalEntry(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=datetime.utcnow(),
        fiscal_year_id=original.fiscal_year_id,
        description_ar=f"عكس قيد: {original.entry_number}",
        description_en=f"Reversal of: {original.entry_number}",
        status=JournalEntryStatus.POSTED,
        source="reversal",
        reference=original.entry_number,
        total_debit=original.total_credit,
        total_credit=original.total_debit,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(reversal)

    for line in lines:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()),
            entry_id=reversal.id,
            account_id=line.account_id,
            cost_center_id=line.cost_center_id,
            description=line.description,
            debit=line.credit,
            credit=line.debit,
            line_order=line.line_order,
        ))

    await db.commit()
    await db.refresh(reversal)
    return reversal


# ─── Bank Accounts ───────────────────────────────────────────────────
async def get_bank_accounts(db: AsyncSession, tenant_id: str):
    r = await db.execute(select(BankAccount).where(BankAccount.tenant_id == tenant_id))
    return r.scalars().all()


async def create_bank_account(db: AsyncSession, tenant_id: str, data: BankAccountCreate):
    ba = BankAccount(id=str(uuid.uuid4()), tenant_id=tenant_id, **data.model_dump())
    db.add(ba)
    await db.commit()
    await db.refresh(ba)
    return ba


# ─── Budgets ─────────────────────────────────────────────────────────
async def get_budgets(db: AsyncSession, tenant_id: str):
    r = await db.execute(select(Budget).where(Budget.tenant_id == tenant_id))
    return r.scalars().all()


async def create_budget(db: AsyncSession, tenant_id: str, data: BudgetCreate):
    budget = Budget(id=str(uuid.uuid4()), tenant_id=tenant_id,
                    fiscal_year_id=data.fiscal_year_id, name=data.name)
    db.add(budget)
    for line in data.lines:
        db.add(BudgetLine(id=str(uuid.uuid4()), budget_id=budget.id, **line.model_dump()))
    await db.commit()
    await db.refresh(budget)
    return budget


# ─── VAT Settings ────────────────────────────────────────────────────
async def get_vat_settings(db: AsyncSession, tenant_id: str):
    r = await db.execute(select(VATSetting).where(VATSetting.tenant_id == tenant_id))
    return r.scalar_one_or_none()


async def upsert_vat_settings(db: AsyncSession, tenant_id: str, data: VATSettingUpdate):
    vat = await get_vat_settings(db, tenant_id)
    if not vat:
        vat = VATSetting(id=str(uuid.uuid4()), tenant_id=tenant_id)
        db.add(vat)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(vat, k, v)
    vat.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(vat)
    return vat


# ─── Reports ─────────────────────────────────────────────────────────
async def get_trial_balance(db: AsyncSession, tenant_id: str,
                             from_date: datetime, to_date: datetime,
                             account_id: str | None = None):
    from_date = from_date.replace(tzinfo=None)
    to_date = to_date.replace(tzinfo=None)
    account_query = select(Account).where(Account.tenant_id == tenant_id, Account.is_posting == True)
    if account_id:
        account_query = account_query.where(Account.id == account_id)
    accounts_r = await db.execute(account_query.order_by(Account.code))
    accounts = accounts_r.scalars().all()

    result = []
    for acc in accounts:
        # Period movements (posted entries only)
        lines_r = await db.execute(
            select(
                func.coalesce(func.sum(JournalEntryLine.debit), 0).label("debit"),
                func.coalesce(func.sum(JournalEntryLine.credit), 0).label("credit"),
            ).join(JournalEntry, JournalEntryLine.entry_id == JournalEntry.id)
            .where(
                JournalEntryLine.account_id == acc.id,
                JournalEntry.status == JournalEntryStatus.POSTED,
                JournalEntry.entry_date >= from_date,
                JournalEntry.entry_date <= to_date,
            )
        )
        row = lines_r.one()
        period_debit = Decimal(str(row.debit))
        period_credit = Decimal(str(row.credit))

        opening = acc.opening_balance or Decimal("0")
        if acc.nature.value == "debit":
            closing = opening + period_debit - period_credit
            closing_debit = closing if closing >= 0 else Decimal("0")
            closing_credit = -closing if closing < 0 else Decimal("0")
        else:
            closing = opening + period_credit - period_debit
            closing_credit = closing if closing >= 0 else Decimal("0")
            closing_debit = -closing if closing < 0 else Decimal("0")

        result.append({
            "account_id": acc.id,
            "account_code": acc.code,
            "account_name_ar": acc.name_ar,
            "account_name_en": acc.name_en,
            "account_type": acc.account_type.value,
            "opening_debit": opening if acc.nature.value == "debit" else Decimal("0"),
            "opening_credit": opening if acc.nature.value == "credit" else Decimal("0"),
            "period_debit": period_debit,
            "period_credit": period_credit,
            "closing_debit": closing_debit,
            "closing_credit": closing_credit,
        })
    return result


async def get_ledger(db: AsyncSession, tenant_id: str, account_id: str,
                     from_date: datetime, to_date: datetime):
    from_date = from_date.replace(tzinfo=None)
    to_date = to_date.replace(tzinfo=None)
    acc = await db.get(Account, account_id)
    if not acc or acc.tenant_id != tenant_id:
        raise HTTPException(404, "Account not found")

    lines_r = await db.execute(
        select(JournalEntryLine, JournalEntry)
        .join(JournalEntry, JournalEntryLine.entry_id == JournalEntry.id)
        .where(
            JournalEntryLine.account_id == account_id,
            JournalEntry.status == JournalEntryStatus.POSTED,
            JournalEntry.entry_date >= from_date,
            JournalEntry.entry_date <= to_date,
        )
        .order_by(JournalEntry.entry_date, JournalEntry.entry_number)
    )
    rows = lines_r.all()

    balance = acc.opening_balance or Decimal("0")
    result = []
    for line, entry in rows:
        if acc.nature.value == "debit":
            balance += line.debit - line.credit
        else:
            balance += line.credit - line.debit
        result.append({
            "entry_id": entry.id,
            "entry_number": entry.entry_number,
            "entry_date": entry.entry_date,
            "description": line.description or entry.description_ar,
            "reference": entry.reference,
            "debit": line.debit,
            "credit": line.credit,
            "balance": balance,
        })
    return result


# ─── Default Chart & Operational Mapping ─────────────────────────────
async def _get_accounting_setup(db: AsyncSession, tenant_id: str) -> AccountingSetup | None:
    result = await db.execute(
        select(AccountingSetup).where(AccountingSetup.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def _get_account_mapping_rows(db: AsyncSession, tenant_id: str) -> list[AccountingAccountMapping]:
    from sqlalchemy.orm import selectinload

    result = await db.execute(
        select(AccountingAccountMapping)
        .options(selectinload(AccountingAccountMapping.account))
        .where(AccountingAccountMapping.tenant_id == tenant_id)
        .order_by(AccountingAccountMapping.mapping_key)
    )
    return list(result.scalars().all())


async def get_accounting_readiness(db: AsyncSession, tenant_id: str) -> dict:
    """فحص قراءة فقط. لا ينشئ حسابات ولا يغير بيانات الشركات القائمة."""
    from app.models.sales import Customer, Invoice, Payment, InvoiceStatus
    from app.models.purchases import Vendor, Bill, BillStatus

    setup = await _get_accounting_setup(db, tenant_id)
    mappings = await _get_account_mapping_rows(db, tenant_id)
    mapping_by_key = {mapping.mapping_key: mapping for mapping in mappings}
    active_mappings = [mapping for mapping in mappings if mapping.account and mapping.account.is_active and mapping.account.is_posting]

    account_count = (await db.execute(
        select(func.count(Account.id)).where(Account.tenant_id == tenant_id)
    )).scalar() or 0
    customer_without_ar = (await db.execute(
        select(func.count(Customer.id)).where(
            Customer.tenant_id == tenant_id,
            Customer.ar_account_id.is_(None),
        )
    )).scalar() or 0
    vendor_without_ap = (await db.execute(
        select(func.count(Vendor.id)).where(
            Vendor.tenant_id == tenant_id,
            Vendor.ap_account_id.is_(None),
        )
    )).scalar() or 0
    bank_without_gl = (await db.execute(
        select(func.count(BankAccount.id)).where(
            BankAccount.tenant_id == tenant_id,
            BankAccount.gl_account_id.is_(None),
        )
    )).scalar() or 0
    financial_statuses = (
        InvoiceStatus.CONFIRMED,
        InvoiceStatus.PAID,
        InvoiceStatus.PARTIAL,
        InvoiceStatus.OVERDUE,
    )
    invoice_without_journal = (await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.tenant_id == tenant_id,
            Invoice.status.in_(financial_statuses),
            Invoice.journal_entry_id.is_(None),
        )
    )).scalar() or 0
    payment_without_journal = (await db.execute(
        select(func.count(Payment.id)).where(
            Payment.tenant_id == tenant_id,
            Payment.journal_entry_id.is_(None),
        )
    )).scalar() or 0
    financial_bill_statuses = (
        BillStatus.CONFIRMED,
        BillStatus.PAID,
        BillStatus.PARTIAL,
        BillStatus.OVERDUE,
    )
    bill_without_journal = (await db.execute(
        select(func.count(Bill.id)).where(
            Bill.tenant_id == tenant_id,
            Bill.status.in_(financial_bill_statuses),
            Bill.journal_entry_id.is_(None),
        )
    )).scalar() or 0

    missing_required_keys = [key for key in REQUIRED_MAPPING_KEYS if key not in mapping_by_key]
    invalid_mapping_keys = [
        mapping.mapping_key for mapping in mappings
        if not mapping.account or not mapping.account.is_active or not mapping.account.is_posting
    ]

    return {
        "chart_initialized": bool(setup and setup.chart_initialized_at),
        "chart_initialized_at": setup.chart_initialized_at if setup else None,
        "legacy_chart_imported": bool(setup and setup.legacy_chart_imported_at),
        "legacy_chart_imported_at": setup.legacy_chart_imported_at if setup else None,
        "auto_posting_enabled": bool(setup and setup.auto_posting_enabled),
        "account_count": int(account_count),
        "mapping_count": len(mappings),
        "active_mapping_count": len(active_mappings),
        "missing_required_keys": missing_required_keys,
        "invalid_mapping_keys": invalid_mapping_keys,
        "customer_without_ar": int(customer_without_ar),
        "vendor_without_ap": int(vendor_without_ap),
        "bank_without_gl": int(bank_without_gl),
        "financial_invoice_without_journal": int(invoice_without_journal),
        "payment_without_journal": int(payment_without_journal),
        "bill_without_journal": int(bill_without_journal),
        "legacy_transactions_untouched": True,
    }


async def initialize_default_chart(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """ينشئ قالب الشجرة للشركة الفارغة فقط، بأرصدة صفرية ومن دون تفعيل قيود تلقائية."""
    existing_setup = await _get_accounting_setup(db, tenant_id)
    account_count = (await db.execute(
        select(func.count(Account.id)).where(Account.tenant_id == tenant_id)
    )).scalar() or 0

    if existing_setup and existing_setup.chart_initialized_at:
        raise HTTPException(409, "شجرة الحسابات الافتراضية مهيأة بالفعل لهذه الشركة")
    if account_count:
        raise HTTPException(
            409,
            "توجد حسابات حالية لهذه الشركة؛ لن ينشئ النظام شجرة تلقائية فوقها. استخدم مطابقة الحسابات اليدوية أولًا.",
        )

    accounts_by_code: dict[str, Account] = {}
    for code, name_ar, name_en, account_type, nature, parent_code, is_posting, allow_direct_posting in DEFAULT_CHART:
        account = Account(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            code=code,
            name_ar=name_ar,
            name_en=name_en,
            account_type=account_type,
            nature=nature,
            parent_id=accounts_by_code[parent_code].id if parent_code else None,
            level=1 if parent_code is None else accounts_by_code[parent_code].level + 1,
            is_active=True,
            is_posting=is_posting,
            allow_direct_posting=allow_direct_posting,
            is_customer_account=code.startswith("113"),
            opening_balance=Decimal("0"),
        )
        accounts_by_code[code] = account
        db.add(account)

    setup = existing_setup or AccountingSetup(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        chart_initialized_by=user_id,
    )
    setup.chart_initialized_at = datetime.utcnow()
    setup.chart_initialized_by = user_id
    setup.auto_posting_enabled = False
    setup.updated_at = datetime.utcnow()
    if not existing_setup:
        db.add(setup)

    for mapping_key, account_code in DEFAULT_MAPPING_CODES.items():
        db.add(AccountingAccountMapping(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            mapping_key=mapping_key,
            account_id=accounts_by_code[account_code].id,
            updated_at=datetime.utcnow(),
        ))

    # تهيئة إعداد الضريبة المرجعي فقط. لا يغير مبالغ أو حالات فواتير سابقة.
    vat = await get_vat_settings(db, tenant_id)
    if not vat:
        vat = VATSetting(id=str(uuid.uuid4()), tenant_id=tenant_id)
        db.add(vat)
    vat.vat_account_id = accounts_by_code[DEFAULT_MAPPING_CODES["vat_output"]].id
    vat.vat_receivable_account_id = accounts_by_code[DEFAULT_MAPPING_CODES["vat_input"]].id
    vat.updated_at = datetime.utcnow()

    await db.commit()
    return await get_accounting_readiness(db, tenant_id)


async def _add_legacy_company_chart_records(db: AsyncSession, tenant_id: str) -> None:
    """يبني حسابات الشجرة المخصصة في الذاكرة قبل حفظ المعاملة."""
    accounts_by_source_key: dict[str, Account] = {}
    for source_key, code, name_ar, account_type, nature, parent_source_key, level, is_posting, allow_direct_posting in LEGACY_COMPANY_CHART:
        account = Account(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            code=code,
            name_ar=name_ar,
            # المصدر عربي؛ الاحتفاظ بالاسم نفسه في الحقل الثاني يمنع اختراع ترجمة
            # غير معتمدة من المستخدم ويحافظ على ظهور الحساب في كل لغات الواجهة.
            name_en=name_ar,
            account_type=account_type,
            nature=nature,
            parent_id=accounts_by_source_key[parent_source_key].id if parent_source_key else None,
            level=level,
            is_active=True,
            is_posting=is_posting,
            allow_direct_posting=allow_direct_posting,
            is_customer_account=source_key in LEGACY_CUSTOMER_ACCOUNT_SOURCE_KEYS,
            opening_balance=Decimal("0"),
            notes=f"مجلوب من شجرة النظام السابق — السطر {source_key.removeprefix('legacy_')}",
        )
        accounts_by_source_key[source_key] = account
        db.add(account)


async def _mark_legacy_chart_imported(
    db: AsyncSession, tenant_id: str, user_id: str, existing_setup: AccountingSetup | None,
) -> None:
    setup = existing_setup or AccountingSetup(id=str(uuid.uuid4()), tenant_id=tenant_id)
    setup.chart_initialized_at = None
    setup.chart_initialized_by = None
    setup.legacy_chart_imported_at = datetime.utcnow()
    setup.legacy_chart_imported_by = user_id
    setup.auto_posting_enabled = False
    setup.updated_at = datetime.utcnow()
    if not existing_setup:
        db.add(setup)


async def get_legacy_chart_replacement_readiness(db: AsyncSession, tenant_id: str) -> dict:
    """فحص قراءة فقط قبل استبدال دليل قديم؛ لا يغير أي سجل."""
    from app.models.assets import AssetCategory
    from app.models.pos import POSTerminal
    from app.models.purchases import Vendor
    from app.models.sales import Customer
    from app.models.treasury import Voucher

    setup = await _get_accounting_setup(db, tenant_id)
    account_ids = select(Account.id).where(Account.tenant_id == tenant_id)

    async def count_references(statement) -> int:
        return int((await db.execute(statement)).scalar() or 0)

    account_count = await count_references(select(func.count(Account.id)).where(Account.tenant_id == tenant_id))
    accounts_with_opening_balance = await count_references(
        select(func.count(Account.id)).where(Account.tenant_id == tenant_id, Account.opening_balance != 0)
    )
    journal_line_references = await count_references(
        select(func.count(JournalEntryLine.id)).where(JournalEntryLine.account_id.in_(account_ids))
    )
    customer_account_references = await count_references(
        select(func.count(Customer.id)).where(Customer.tenant_id == tenant_id, Customer.ar_account_id.in_(account_ids))
    )
    vendor_account_references = await count_references(
        select(func.count(Vendor.id)).where(Vendor.tenant_id == tenant_id, Vendor.ap_account_id.in_(account_ids))
    )
    bank_account_references = await count_references(
        select(func.count(BankAccount.id)).where(BankAccount.tenant_id == tenant_id, BankAccount.gl_account_id.in_(account_ids))
    )
    budget_line_references = await count_references(
        select(func.count(BudgetLine.id)).where(BudgetLine.account_id.in_(account_ids))
    )
    asset_category_references = await count_references(
        select(func.count(AssetCategory.id)).where(
            AssetCategory.tenant_id == tenant_id,
            or_(
                AssetCategory.asset_account_id.in_(account_ids),
                AssetCategory.accumulated_dep_account_id.in_(account_ids),
                AssetCategory.depreciation_expense_account_id.in_(account_ids),
                AssetCategory.gain_on_disposal_account_id.in_(account_ids),
                AssetCategory.loss_on_disposal_account_id.in_(account_ids),
            ),
        )
    )
    pos_terminal_references = await count_references(
        select(func.count(POSTerminal.id)).where(
            POSTerminal.tenant_id == tenant_id,
            or_(
                POSTerminal.cash_account_id.in_(account_ids),
                POSTerminal.sales_account_id.in_(account_ids),
                POSTerminal.vat_account_id.in_(account_ids),
            ),
        )
    )
    voucher_account_references = await count_references(
        select(func.count(Voucher.id)).where(
            Voucher.tenant_id == tenant_id,
            or_(
                Voucher.debit_account_id.in_(account_ids),
                Voucher.credit_account_id.in_(account_ids),
                Voucher.vat_account_id.in_(account_ids),
            ),
        )
    )
    removable_mapping_references = await count_references(
        select(func.count(AccountingAccountMapping.id)).where(
            AccountingAccountMapping.tenant_id == tenant_id,
            AccountingAccountMapping.account_id.in_(account_ids),
        )
    )
    removable_vat_account_references = await count_references(
        select(func.count(VATSetting.id)).where(
            VATSetting.tenant_id == tenant_id,
            or_(
                VATSetting.vat_account_id.in_(account_ids),
                VATSetting.vat_receivable_account_id.in_(account_ids),
            ),
        )
    )

    # روابط العملاء والموردين يمكن فصلها وإعادة اختيارها بعد جلب شجرة المدن؛
    # لا نحذف سجلات الأطراف ولا فواتيرها، لذلك لا تُعد مانعًا للاستبدال.
    blocking_counts = (
        accounts_with_opening_balance,
        journal_line_references,
        bank_account_references,
        budget_line_references,
        asset_category_references,
        pos_terminal_references,
        voucher_account_references,
    )
    return {
        "account_count": account_count,
        "accounts_with_opening_balance": accounts_with_opening_balance,
        "journal_line_references": journal_line_references,
        "customer_account_references": customer_account_references,
        "vendor_account_references": vendor_account_references,
        "bank_account_references": bank_account_references,
        "budget_line_references": budget_line_references,
        "asset_category_references": asset_category_references,
        "pos_terminal_references": pos_terminal_references,
        "voucher_account_references": voucher_account_references,
        "removable_mapping_references": removable_mapping_references,
        "removable_vat_account_references": removable_vat_account_references,
        "legacy_chart_imported": bool(setup and setup.legacy_chart_imported_at),
        "can_replace": bool(account_count) and not any(blocking_counts) and not bool(setup and setup.legacy_chart_imported_at),
    }


async def import_legacy_company_chart(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """يجلب شجرة النظام السابق للشركة الفارغة فقط."""
    existing_setup = await _get_accounting_setup(db, tenant_id)
    account_count = (await db.execute(
        select(func.count(Account.id)).where(Account.tenant_id == tenant_id)
    )).scalar() or 0
    if existing_setup and existing_setup.legacy_chart_imported_at:
        raise HTTPException(409, "تم جلب شجرة النظام السابق لهذه الشركة بالفعل")
    if account_count:
        raise HTTPException(409, "توجد حسابات حالية لهذه الشركة؛ استخدم الاستبدال المحمي إذا كانت خالية من الحركات والارتباطات.")

    await _add_legacy_company_chart_records(db, tenant_id)
    await _mark_legacy_chart_imported(db, tenant_id, user_id, existing_setup)
    await db.commit()
    return await get_accounting_readiness(db, tenant_id)


async def replace_empty_chart_with_legacy_company_chart(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """يستبدل دليلًا قديمًا غير مستخدم بعد فحص كل المراجع داخل الشركة."""
    readiness = await get_legacy_chart_replacement_readiness(db, tenant_id)
    if readiness["legacy_chart_imported"]:
        raise HTTPException(409, "تم جلب شجرة النظام السابق لهذه الشركة بالفعل")
    if not readiness["account_count"]:
        raise HTTPException(409, "لا يوجد دليل قائم لاستبداله؛ استخدم زر جلب الشجرة للشركة الفارغة")
    if not readiness["can_replace"]:
        raise HTTPException(409, "لا يمكن استبدال الدليل لأن بعض حساباته لها أرصدة أو حركات أو ارتباطات قائمة. لم يتم حذف أي حساب.")

    existing_setup = await _get_accounting_setup(db, tenant_id)
    old_account_result = await db.execute(select(Account.id).where(Account.tenant_id == tenant_id))
    old_account_ids = set(old_account_result.scalars().all())
    # روابط العملاء والموردين مراجع للحساب فقط؛ نفصلها ونترك سجلات الأطراف
    # والفواتير كما هي ليعاد اختيار حساب المدينة بعد جلب الشجرة.
    from app.models.purchases import Vendor
    from app.models.sales import Customer
    await db.execute(
        update(Customer)
        .where(Customer.tenant_id == tenant_id, Customer.ar_account_id.in_(old_account_ids))
        .values(ar_account_id=None)
    )
    await db.execute(
        update(Vendor)
        .where(Vendor.tenant_id == tenant_id, Vendor.ap_account_id.in_(old_account_ids))
        .values(ap_account_id=None)
    )
    # خريطة الربط وإعداد الضريبة مراجع إعدادات فقط. تزال قبل حذف الحسابات الفارغة
    # كي لا تبقى مراجع يتيمة، ولا يمس ذلك أي فاتورة أو قيد أو عميل أو مورد.
    await db.execute(delete(AccountingAccountMapping).where(AccountingAccountMapping.tenant_id == tenant_id))
    vat_rows = await db.execute(select(VATSetting).where(VATSetting.tenant_id == tenant_id))
    for vat in vat_rows.scalars().all():
        if vat.vat_account_id in old_account_ids or vat.vat_receivable_account_id in old_account_ids:
            vat.vat_account_id = None
            vat.vat_receivable_account_id = None
            vat.updated_at = datetime.utcnow()
    await db.execute(delete(Account).where(Account.tenant_id == tenant_id))
    await _add_legacy_company_chart_records(db, tenant_id)
    await _mark_legacy_chart_imported(db, tenant_id, user_id, existing_setup)
    await db.commit()
    return await get_accounting_readiness(db, tenant_id)


async def apply_default_party_mappings(db: AsyncSession, tenant_id: str) -> dict:
    """يربط فقط الأطراف بلا حساب بالذمم العامة؛ لا ينشئ قيدًا ولا يغير رصيدًا أو فاتورة."""
    from app.models.sales import Customer
    from app.models.purchases import Vendor

    mappings = {row.mapping_key: row for row in await _get_account_mapping_rows(db, tenant_id)}
    ar = mappings.get("default_ar")
    ap = mappings.get("default_ap")
    if not ar or not ap:
        raise HTTPException(409, "يجب تهيئة شجرة الحسابات وخريطة الربط أولًا")
    if not ar.account.is_active or not ar.account.is_posting or not ap.account.is_active or not ap.account.is_posting:
        raise HTTPException(409, "حسابات الذمم الافتراضية غير صالحة أو غير نشطة")

    customers_result = await db.execute(
        select(Customer).where(Customer.tenant_id == tenant_id, Customer.ar_account_id.is_(None))
    )
    customers = list(customers_result.scalars().all())
    for customer in customers:
        customer.ar_account_id = ar.account_id

    vendors_result = await db.execute(
        select(Vendor).where(Vendor.tenant_id == tenant_id, Vendor.ap_account_id.is_(None))
    )
    vendors = list(vendors_result.scalars().all())
    for vendor in vendors:
        vendor.ap_account_id = ap.account_id

    await db.commit()
    return {
        "customers_linked": len(customers),
        "vendors_linked": len(vendors),
        "journal_entries_created": 0,
        "invoices_changed": 0,
        "payments_changed": 0,
    }


async def get_operational_account_mappings(db: AsyncSession, tenant_id: str) -> list[AccountingAccountMapping]:
    return await _get_account_mapping_rows(db, tenant_id)


async def update_operational_account_mapping(
    db: AsyncSession, tenant_id: str, mapping_key: str, account_id: str
) -> AccountingAccountMapping:
    if mapping_key not in DEFAULT_MAPPING_CODES:
        raise HTTPException(404, "مفتاح الربط المحاسبي غير معروف")

    account = await db.get(Account, account_id)
    if not account or account.tenant_id != tenant_id:
        raise HTTPException(404, "الحساب غير موجود لهذه الشركة")
    if not account.is_active or not account.is_posting:
        raise HTTPException(400, "يجب اختيار حساب نشط ونهائي قابل للقيد")

    result = await db.execute(
        select(AccountingAccountMapping).where(
            AccountingAccountMapping.tenant_id == tenant_id,
            AccountingAccountMapping.mapping_key == mapping_key,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping:
        mapping = AccountingAccountMapping(
            id=str(uuid.uuid4()), tenant_id=tenant_id,
            mapping_key=mapping_key, account_id=account.id,
        )
        db.add(mapping)
    else:
        mapping.account_id = account.id
        mapping.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(mapping)
    return mapping


async def is_operational_auto_posting_enabled(db: AsyncSession, tenant_id: str) -> bool:
    """يحافظ على السلوك القديم للشركات غير المهيأة، ويوقف القيود التلقائية للشركة
    التي أنشأت الشجرة حتى تفعّلها صراحة في مرحلة لاحقة."""
    setup = await _get_accounting_setup(db, tenant_id)
    return setup is None or bool(setup.auto_posting_enabled)


async def get_operational_account(db: AsyncSession, tenant_id: str, mapping_key: str) -> Account:
    """يعيد حسابًا نهائيًا صالحًا من خريطة الربط، أو رسالة إعداد واضحة."""
    from sqlalchemy.orm import selectinload

    if mapping_key not in DEFAULT_MAPPING_CODES:
        raise HTTPException(404, "مفتاح الربط المحاسبي غير معروف")

    result = await db.execute(
        select(AccountingAccountMapping)
        .options(selectinload(AccountingAccountMapping.account))
        .where(
            AccountingAccountMapping.tenant_id == tenant_id,
            AccountingAccountMapping.mapping_key == mapping_key,
        )
    )
    mapping = result.scalar_one_or_none()
    if not mapping or not mapping.account:
        raise HTTPException(409, f"حساب الربط '{mapping_key}' غير مهيأ لهذه الشركة")
    account = mapping.account
    if account.tenant_id != tenant_id or not account.is_active or not account.is_posting:
        raise HTTPException(409, f"حساب الربط '{mapping_key}' غير نشط أو غير قابل للقيد")
    return account
