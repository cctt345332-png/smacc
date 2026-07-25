from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import datetime
from app.models.assets import AssetStatus, DepreciationMethod


class AssetCategoryCreate(BaseModel):
    name_ar: str
    name_en: str
    depreciation_method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE
    useful_life_years: int = 5
    depreciation_rate: Decimal = Decimal("20")
    asset_account_id: Optional[str] = None
    accumulated_dep_account_id: Optional[str] = None
    depreciation_expense_account_id: Optional[str] = None
    gain_on_disposal_account_id: Optional[str] = None
    loss_on_disposal_account_id: Optional[str] = None


class AssetCategoryOut(BaseModel):
    id: str
    name_ar: str
    name_en: str
    depreciation_method: DepreciationMethod
    useful_life_years: int
    depreciation_rate: Decimal
    is_active: bool
    model_config = {"from_attributes": True}


class AssetCreate(BaseModel):
    asset_number: str
    name_ar: str
    name_en: Optional[str] = None
    category_id: str
    purchase_date: datetime
    purchase_cost: Decimal
    salvage_value: Decimal = Decimal("0")
    useful_life_years: int
    depreciation_method: DepreciationMethod
    depreciation_rate: Decimal
    serial_number: Optional[str] = None
    location: Optional[str] = None
    responsible_person: Optional[str] = None
    cost_center_id: Optional[str] = None
    vendor_name: Optional[str] = None
    invoice_number: Optional[str] = None
    warranty_expiry: Optional[datetime] = None
    notes: Optional[str] = None


class AssetUpdate(BaseModel):
    name_ar: Optional[str] = None
    name_en: Optional[str] = None
    location: Optional[str] = None
    responsible_person: Optional[str] = None
    serial_number: Optional[str] = None
    warranty_expiry: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[AssetStatus] = None


class AssetOut(BaseModel):
    id: str
    asset_number: str
    name_ar: str
    name_en: Optional[str]
    category_id: str
    status: AssetStatus
    purchase_date: datetime
    purchase_cost: Decimal
    salvage_value: Decimal
    useful_life_years: int
    depreciation_method: DepreciationMethod
    depreciation_rate: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    last_depreciation_date: Optional[datetime]
    serial_number: Optional[str]
    location: Optional[str]
    responsible_person: Optional[str]
    vendor_name: Optional[str]
    invoice_number: Optional[str]
    warranty_expiry: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    model_config = {"from_attributes": True}


class DepreciationLineOut(BaseModel):
    id: str
    asset_id: str
    period_date: datetime
    depreciation_amount: Decimal
    accumulated_depreciation: Decimal
    book_value: Decimal
    is_posted: bool
    created_at: datetime
    model_config = {"from_attributes": True}


class AssetDisposalRequest(BaseModel):
    disposal_date: datetime
    disposal_amount: Decimal = Decimal("0")
    disposal_notes: Optional[str] = None
    fiscal_year_id: str


class DepreciationRunRequest(BaseModel):
    period_date: datetime   # الشهر المراد احتساب استهلاكه
    fiscal_year_id: str
    post_entries: bool = False  # ترحيل القيود تلقائياً
