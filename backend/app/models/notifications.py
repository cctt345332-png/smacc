from sqlalchemy import String, Boolean, ForeignKey, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import enum
from app.core.database import Base


class NotificationType(str, enum.Enum):
    # ── الأصول الثابتة ────────────────────────────────────────────────
    ASSET_WARRANTY_EXPIRY    = "asset_warranty_expiry"
    ASSET_FULLY_DEPRECIATED  = "asset_fully_depreciated"
    ASSET_DEPRECIATION_DUE   = "asset_depreciation_due"
    ASSET_HIGH_DEPRECIATION  = "asset_high_depreciation"
    # ── المخزون ──────────────────────────────────────────────────────
    INVENTORY_LOW_STOCK      = "inventory_low_stock"
    INVENTORY_EXPIRY         = "inventory_expiry"
    # ── المبيعات ─────────────────────────────────────────────────────
    SALES_OVERDUE_INVOICE    = "sales_overdue_invoice"
    SALES_CREDIT_LIMIT       = "sales_credit_limit"
    # ── المشتريات ────────────────────────────────────────────────────
    PURCHASES_OVERDUE_BILL   = "purchases_overdue_bill"
    # ── الموارد البشرية ───────────────────────────────────────────────
    HR_LEAVE_REQUEST         = "hr_leave_request"
    HR_CONTRACT_EXPIRY       = "hr_contract_expiry"
    # ── المحاسبة ─────────────────────────────────────────────────────
    ACCOUNTING_VAT_DUE       = "accounting_vat_due"
    ACCOUNTING_FISCAL_YEAR   = "accounting_fiscal_year"
    # ── عام ──────────────────────────────────────────────────────────
    GENERAL                  = "general"


class NotificationSeverity(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)  # None = لكل المستخدمين
    type: Mapped[NotificationType] = mapped_column(SAEnum(NotificationType))
    severity: Mapped[NotificationSeverity] = mapped_column(SAEnum(NotificationSeverity), default=NotificationSeverity.INFO)
    title_ar: Mapped[str] = mapped_column(String(300))
    title_en: Mapped[str] = mapped_column(String(300))
    message_ar: Mapped[str] = mapped_column(Text)
    message_en: Mapped[str] = mapped_column(Text)
    reference_id: Mapped[str | None] = mapped_column(String, nullable=True)   # asset_id مثلاً
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # "asset"
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AlertSetting(Base):
    """إعدادات التنبيهات العامة لكل شركة — تشمل كل الأقسام"""
    __tablename__ = "alert_settings"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), unique=True)

    # ── الأصول الثابتة ────────────────────────────────────────────────
    asset_warranty_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    asset_warranty_days: Mapped[int] = mapped_column(default=30)
    asset_full_depreciation_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    asset_depreciation_due_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    asset_depreciation_due_days: Mapped[int] = mapped_column(default=35)
    asset_high_depreciation_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    asset_high_depreciation_threshold: Mapped[int] = mapped_column(default=90)

    # ── المخزون ──────────────────────────────────────────────────────
    inventory_low_stock_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    inventory_expiry_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    inventory_expiry_days: Mapped[int] = mapped_column(default=30)

    # ── المبيعات ─────────────────────────────────────────────────────
    sales_overdue_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    sales_overdue_days: Mapped[int] = mapped_column(default=7)
    sales_credit_limit_alert: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── المشتريات ────────────────────────────────────────────────────
    purchases_overdue_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    purchases_overdue_days: Mapped[int] = mapped_column(default=7)

    # ── الموارد البشرية ───────────────────────────────────────────────
    hr_leave_request_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    hr_contract_expiry_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    hr_contract_expiry_days: Mapped[int] = mapped_column(default=30)

    # ── المحاسبة ─────────────────────────────────────────────────────
    vat_due_alert: Mapped[bool] = mapped_column(Boolean, default=True)
    vat_due_days: Mapped[int] = mapped_column(default=7)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


# للتوافق مع الكود القديم
AssetAlertSetting = AlertSetting
