import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from fastapi import HTTPException

from app.models.accounting import (
    Account, FiscalYear, CostCenter, Currency,
    JournalEntry, JournalEntryLine, BankAccount,
    Budget, BudgetLine, VATSetting,
    JournalEntryStatus, AccountType
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
                             from_date: datetime, to_date: datetime):
    from_date = from_date.replace(tzinfo=None)
    to_date = to_date.replace(tzinfo=None)
    accounts_r = await db.execute(
        select(Account).where(Account.tenant_id == tenant_id, Account.is_posting == True).order_by(Account.code)
    )
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
