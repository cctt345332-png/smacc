from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from app.models.accounting import AccountType, AccountNature, JournalEntryStatus, FiscalYearStatus


# ─── Account ─────────────────────────────────────────────────────────
class AccountCreate(BaseModel):
    code: str
    name_ar: str
    name_en: str
    account_type: AccountType
    nature: AccountNature
    parent_id: Optional[str] = None
    is_posting: bool = True
    allow_direct_posting: bool = True
    opening_balance: Decimal = Decimal("0")
    notes: Optional[str] = None


class AccountUpdate(BaseModel):
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    is_active: Optional[bool] = None
    is_posting: Optional[bool] = None
    notes: Optional[str] = None


class AccountOut(BaseModel):
    id: str
    code: str
    name_ar: str
    name_en: str
    account_type: AccountType
    nature: AccountNature
    parent_id: Optional[str]
    level: int
    is_active: bool
    is_posting: bool
    allow_direct_posting: bool
    is_customer_account: bool = False
    opening_balance: Decimal
    model_config = {"from_attributes": True}


# ─── Fiscal Year ─────────────────────────────────────────────────────
class FiscalYearCreate(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    is_default: bool = False


class FiscalYearOut(BaseModel):
    id: str
    name: str
    start_date: datetime
    end_date: datetime
    status: FiscalYearStatus
    is_default: bool
    model_config = {"from_attributes": True}


# ─── Cost Center ─────────────────────────────────────────────────────
class CostCenterCreate(BaseModel):
    code: str
    name_ar: str
    name_en: str
    parent_id: Optional[str] = None


class CostCenterOut(BaseModel):
    id: str
    code: str
    name_ar: str
    name_en: str
    parent_id: Optional[str]
    is_active: bool
    model_config = {"from_attributes": True}


# ─── Currency ────────────────────────────────────────────────────────
class CurrencyCreate(BaseModel):
    code: str
    name_ar: str
    name_en: str
    symbol: str
    exchange_rate: Decimal = Decimal("1")
    is_base: bool = False


class CurrencyOut(BaseModel):
    id: str
    code: str
    name_ar: str
    name_en: str
    symbol: str
    exchange_rate: Decimal
    is_base: bool
    is_active: bool
    model_config = {"from_attributes": True}


# ─── Journal Entry ───────────────────────────────────────────────────
class JournalLineCreate(BaseModel):
    account_id: str
    cost_center_id: Optional[str] = None
    description: Optional[str] = None
    debit: Decimal = Decimal("0")
    credit: Decimal = Decimal("0")
    line_order: int = 0


class JournalEntryCreate(BaseModel):
    entry_date: datetime
    fiscal_year_id: str
    description_ar: str
    description_en: Optional[str] = None
    reference: Optional[str] = None
    currency_id: Optional[str] = None
    exchange_rate: Decimal = Decimal("1")
    notes: Optional[str] = None
    lines: List[JournalLineCreate] = Field(min_length=2)


class JournalLineOut(BaseModel):
    id: str
    account_id: str
    cost_center_id: Optional[str]
    description: Optional[str]
    debit: Decimal
    credit: Decimal
    line_order: int
    model_config = {"from_attributes": True}


class JournalEntryOut(BaseModel):
    id: str
    entry_number: str
    entry_date: datetime
    fiscal_year_id: str
    description_ar: str
    description_en: Optional[str]
    status: JournalEntryStatus
    reference: Optional[str]
    source: Optional[str]
    total_debit: Decimal
    total_credit: Decimal
    notes: Optional[str]
    created_at: datetime
    lines: List[JournalLineOut] = []
    model_config = {"from_attributes": True}


# ─── Bank Account ────────────────────────────────────────────────────
class BankAccountCreate(BaseModel):
    bank_name: str
    account_name: str
    account_number: str
    iban: Optional[str] = None
    currency_id: Optional[str] = None
    gl_account_id: Optional[str] = None
    opening_balance: Decimal = Decimal("0")


class BankAccountOut(BaseModel):
    id: str
    bank_name: str
    account_name: str
    account_number: str
    iban: Optional[str]
    opening_balance: Decimal
    is_active: bool
    model_config = {"from_attributes": True}


# ─── Budget ──────────────────────────────────────────────────────────
class BudgetLineCreate(BaseModel):
    account_id: str
    cost_center_id: Optional[str] = None
    jan: Decimal = Decimal("0"); feb: Decimal = Decimal("0"); mar: Decimal = Decimal("0")
    apr: Decimal = Decimal("0"); may: Decimal = Decimal("0"); jun: Decimal = Decimal("0")
    jul: Decimal = Decimal("0"); aug: Decimal = Decimal("0"); sep: Decimal = Decimal("0")
    oct: Decimal = Decimal("0"); nov: Decimal = Decimal("0"); dec: Decimal = Decimal("0")


class BudgetCreate(BaseModel):
    fiscal_year_id: str
    name: str
    lines: List[BudgetLineCreate] = []


class BudgetOut(BaseModel):
    id: str
    fiscal_year_id: str
    name: str
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── VAT ─────────────────────────────────────────────────────────────
class VATSettingUpdate(BaseModel):
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None
    vat_rate: Optional[Decimal] = None
    vat_account_id: Optional[str] = None
    zatca_env: Optional[str] = None
    is_zatca_enabled: Optional[bool] = None


class VATSettingOut(BaseModel):
    id: str
    vat_number: Optional[str]
    cr_number: Optional[str]
    vat_rate: Decimal
    zatca_env: str
    is_zatca_enabled: bool
    model_config = {"from_attributes": True}


# ─── Reports ─────────────────────────────────────────────────────────
class TrialBalanceLine(BaseModel):
    account_id: str
    account_code: str
    account_name_ar: str
    account_name_en: str
    account_type: str
    opening_debit: Decimal
    opening_credit: Decimal
    period_debit: Decimal
    period_credit: Decimal
    closing_debit: Decimal
    closing_credit: Decimal


class LedgerLine(BaseModel):
    entry_id: str
    entry_number: str
    entry_date: datetime
    description: str
    reference: Optional[str]
    debit: Decimal
    credit: Decimal
    balance: Decimal


# ─── Accounting Setup & Operational Mapping ──────────────────────────
class AccountMappingUpdate(BaseModel):
    account_id: str


class AccountMappingOut(BaseModel):
    id: str
    mapping_key: str
    account_id: str
    account_code: Optional[str] = None
    account_name_ar: Optional[str] = None
    updated_at: datetime


class AccountingReadinessOut(BaseModel):
    chart_initialized: bool
    chart_initialized_at: Optional[datetime] = None
    legacy_chart_imported: bool
    legacy_chart_imported_at: Optional[datetime] = None
    auto_posting_enabled: bool
    account_count: int
    mapping_count: int
    active_mapping_count: int
    missing_required_keys: List[str]
    invalid_mapping_keys: List[str]
    customer_without_ar: int
    vendor_without_ap: int
    bank_without_gl: int
    financial_invoice_without_journal: int
    payment_without_journal: int
    bill_without_journal: int
    legacy_transactions_untouched: bool


class DefaultPartyMappingResult(BaseModel):
    customers_linked: int
    vendors_linked: int
    journal_entries_created: int
    invoices_changed: int
    payments_changed: int


class LegacyChartReplacementReadinessOut(BaseModel):
    account_count: int
    accounts_with_opening_balance: int
    journal_line_references: int
    customer_account_references: int
    vendor_account_references: int
    bank_account_references: int
    budget_line_references: int
    asset_category_references: int
    pos_terminal_references: int
    voucher_account_references: int
    removable_mapping_references: int
    removable_vat_account_references: int
    legacy_chart_imported: bool
    can_replace: bool
