from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
import enum
from app.core.database import Base


class AssetStatus(str, enum.Enum):
    ACTIVE = "active"           # نشط
    DISPOSED = "disposed"       # متخلص منه
    SCRAPPED = "scrapped"       # مهمل/خردة
    UNDER_MAINTENANCE = "under_maintenance"  # تحت الصيانة


class DepreciationMethod(str, enum.Enum):
    STRAIGHT_LINE = "straight_line"         # القسط الثابت
    DECLINING_BALANCE = "declining_balance"  # القسط المتناقص
    UNITS_OF_PRODUCTION = "units_of_production"  # وحدات الإنتاج


class AssetCategory(Base):
    """فئات الأصول الثابتة"""
    __tablename__ = "asset_categories"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str] = mapped_column(String(200))
    depreciation_method: Mapped[DepreciationMethod] = mapped_column(
        SAEnum(DepreciationMethod), default=DepreciationMethod.STRAIGHT_LINE
    )
    useful_life_years: Mapped[int] = mapped_column(Integer, default=5)
    depreciation_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=20)  # %
    # حسابات GL المرتبطة
    asset_account_id: Mapped[str | None] = mapped_column(String, ForeignKey("accounts.id"), nullable=True)
    accumulated_dep_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    depreciation_expense_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    gain_on_disposal_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    loss_on_disposal_account_id: Mapped[str | None] = mapped_column(String, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    assets: Mapped[list["Asset"]] = relationship("Asset", back_populates="category")


class Asset(Base):
    """سجل الأصول الثابتة"""
    __tablename__ = "assets"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    asset_number: Mapped[str] = mapped_column(String(50), index=True)  # رقم الأصل
    name_ar: Mapped[str] = mapped_column(String(300))
    name_en: Mapped[str | None] = mapped_column(String(300), nullable=True)
    category_id: Mapped[str] = mapped_column(String, ForeignKey("asset_categories.id"))
    status: Mapped[AssetStatus] = mapped_column(SAEnum(AssetStatus), default=AssetStatus.ACTIVE)

    # بيانات الشراء
    purchase_date: Mapped[datetime] = mapped_column(DateTime)
    purchase_cost: Mapped[Decimal] = mapped_column(Numeric(18, 2))       # تكلفة الشراء
    salvage_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)  # القيمة التخريدية
    useful_life_years: Mapped[int] = mapped_column(Integer)               # العمر الإنتاجي
    depreciation_method: Mapped[DepreciationMethod] = mapped_column(SAEnum(DepreciationMethod))
    depreciation_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))    # نسبة الاستهلاك %

    # بيانات إضافية
    serial_number: Mapped[str | None] = mapped_column(String(100), nullable=True)   # الرقم التسلسلي
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)        # الموقع
    responsible_person: Mapped[str | None] = mapped_column(String(200), nullable=True)  # المسؤول
    cost_center_id: Mapped[str | None] = mapped_column(String, ForeignKey("cost_centers.id"), nullable=True)
    vendor_name: Mapped[str | None] = mapped_column(String(200), nullable=True)     # اسم المورد
    invoice_number: Mapped[str | None] = mapped_column(String(100), nullable=True)  # رقم الفاتورة
    warranty_expiry: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # انتهاء الضمان
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # أرصدة محسوبة
    accumulated_depreciation: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)
    book_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=0)  # القيمة الدفترية
    last_depreciation_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # تاريخ التخلص
    disposal_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    disposal_amount: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    disposal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    category: Mapped["AssetCategory"] = relationship("AssetCategory", back_populates="assets")
    depreciation_lines: Mapped[list["DepreciationLine"]] = relationship(
        "DepreciationLine", back_populates="asset", cascade="all, delete-orphan"
    )


class DepreciationLine(Base):
    """سجل الاستهلاك الشهري/السنوي"""
    __tablename__ = "depreciation_lines"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    asset_id: Mapped[str] = mapped_column(String, ForeignKey("assets.id"), index=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    period_date: Mapped[datetime] = mapped_column(DateTime)          # تاريخ الفترة
    depreciation_amount: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    accumulated_depreciation: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    book_value: Mapped[Decimal] = mapped_column(Numeric(18, 2))
    journal_entry_id: Mapped[str | None] = mapped_column(String, nullable=True)  # رقم القيد
    is_posted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    asset: Mapped["Asset"] = relationship("Asset", back_populates="depreciation_lines")
