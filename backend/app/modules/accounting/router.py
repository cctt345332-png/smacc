from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.accounting import service
from app.modules.accounting.schemas import (
    AccountCreate, AccountUpdate, AccountOut,
    FiscalYearCreate, FiscalYearOut,
    CostCenterCreate, CostCenterOut,
    CurrencyCreate, CurrencyOut,
    JournalEntryCreate, JournalEntryOut,
    BankAccountCreate, BankAccountOut,
    BudgetCreate, BudgetOut,
    VATSettingUpdate, VATSettingOut,
    TrialBalanceLine, LedgerLine,
)

router = APIRouter(prefix="/accounting", tags=["accounting"])


# ─── Chart of Accounts ───────────────────────────────────────────────
@router.get("/accounts", response_model=list[AccountOut])
async def list_accounts(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_accounts(db, tenant_id)


@router.post("/accounts", response_model=AccountOut, status_code=201)
async def create_account(data: AccountCreate, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_account(db, user["tenant_id"], data)


@router.patch("/accounts/{account_id}", response_model=AccountOut)
async def update_account(account_id: str, data: AccountUpdate, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.update_account(db, user["tenant_id"], account_id, data)


@router.delete("/accounts/{account_id}", status_code=204)
async def delete_account(account_id: str, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    await service.delete_account(db, user["tenant_id"], account_id)


# ─── Fiscal Years ────────────────────────────────────────────────────
@router.get("/fiscal-years", response_model=list[FiscalYearOut])
async def list_fiscal_years(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_fiscal_years(db, tenant_id)


@router.post("/fiscal-years", response_model=FiscalYearOut, status_code=201)
async def create_fiscal_year(data: FiscalYearCreate, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.create_fiscal_year(db, tenant_id, data)


@router.post("/fiscal-years/{fy_id}/close", response_model=FiscalYearOut)
async def close_fiscal_year(fy_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.close_fiscal_year(db, tenant_id, fy_id)


# ─── Cost Centers ────────────────────────────────────────────────────
@router.get("/cost-centers", response_model=list[CostCenterOut])
async def list_cost_centers(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_cost_centers(db, tenant_id)


@router.post("/cost-centers", response_model=CostCenterOut, status_code=201)
async def create_cost_center(data: CostCenterCreate, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.create_cost_center(db, tenant_id, data)


# ─── Currencies ──────────────────────────────────────────────────────
@router.get("/currencies", response_model=list[CurrencyOut])
async def list_currencies(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_currencies(db, tenant_id)


@router.post("/currencies", response_model=CurrencyOut, status_code=201)
async def create_currency(data: CurrencyCreate, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.create_currency(db, tenant_id, data)


# ─── Journal Entries ─────────────────────────────────────────────────
@router.get("/journal-entries", response_model=list[JournalEntryOut])
async def list_journal_entries(
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_journal_entries(db, tenant_id, status, from_date, to_date)


@router.get("/journal-entries/{entry_id}", response_model=JournalEntryOut)
async def get_journal_entry(entry_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_journal_entry(db, tenant_id, entry_id)


@router.post("/journal-entries", response_model=JournalEntryOut, status_code=201)
async def create_journal_entry(
    data: JournalEntryCreate,
    user=Depends(require_role(["manager","accountant"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_journal_entry(db, user["tenant_id"], user["user_id"], data)


@router.post("/journal-entries/{entry_id}/post", response_model=JournalEntryOut)
async def post_entry(entry_id: str, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.post_journal_entry(db, user["tenant_id"], user["user_id"], entry_id)


@router.post("/journal-entries/{entry_id}/cancel", response_model=JournalEntryOut)
async def cancel_entry(entry_id: str, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.cancel_journal_entry(db, user["tenant_id"], entry_id)


@router.post("/journal-entries/{entry_id}/reverse", response_model=JournalEntryOut)
async def reverse_entry(entry_id: str, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.reverse_journal_entry(db, user["tenant_id"], user["user_id"], entry_id)


# ─── Bank Accounts ───────────────────────────────────────────────────
@router.get("/bank-accounts", response_model=list[BankAccountOut])
async def list_bank_accounts(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_bank_accounts(db, tenant_id)


@router.post("/bank-accounts", response_model=BankAccountOut, status_code=201)
async def create_bank_account(data: BankAccountCreate, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.create_bank_account(db, tenant_id, data)


# ─── Budgets ─────────────────────────────────────────────────────────
@router.get("/budgets", response_model=list[BudgetOut])
async def list_budgets(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_budgets(db, tenant_id)


@router.post("/budgets", response_model=BudgetOut, status_code=201)
async def create_budget(data: BudgetCreate, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.create_budget(db, tenant_id, data)


# ─── VAT Settings ────────────────────────────────────────────────────
@router.get("/vat-settings", response_model=VATSettingOut)
async def get_vat_settings(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    vat = await service.get_vat_settings(db, tenant_id)
    if not vat:
        from fastapi import HTTPException
        raise HTTPException(404, "VAT settings not configured")
    return vat


@router.put("/vat-settings", response_model=VATSettingOut)
async def upsert_vat_settings(data: VATSettingUpdate, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.upsert_vat_settings(db, tenant_id, data)


# ─── Reports ─────────────────────────────────────────────────────────
@router.get("/reports/trial-balance")
async def trial_balance(
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_trial_balance(db, tenant_id, from_date, to_date)


@router.get("/reports/ledger/{account_id}")
async def general_ledger(
    account_id: str,
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_ledger(db, tenant_id, account_id, from_date, to_date)


@router.get("/reports/vat")
async def vat_report(
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    from app.modules.accounting.vat_report import get_vat_report
    return await get_vat_report(db, tenant_id, from_date, to_date)
