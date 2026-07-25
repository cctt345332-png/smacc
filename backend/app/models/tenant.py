from sqlalchemy import String, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import enum
from app.core.database import Base


class BusinessType(str, enum.Enum):
    MOBILE_PHONES = "mobile_phones"
    PHARMACY      = "pharmacy"
    GROCERY       = "grocery"
    SPICES        = "spices"
    CLOTHING      = "clothing"
    SPARE_PARTS   = "spare_parts"
    CONSTRUCTION  = "construction"
    GENERAL       = "general"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    # بيانات أساسية
    name: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # بيانات ضريبية — متطلبات زاتكا
    vat_number: Mapped[str | None] = mapped_column(String(20), nullable=True)
    cr_number: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # العنوان — متطلبات زاتكا
    address_street: Mapped[str | None] = mapped_column(String(300), nullable=True)
    address_building: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_district: Mapped[str | None] = mapped_column(String(100), nullable=True)
    address_postal: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address_country: Mapped[str] = mapped_column(String(3), default="SA")

    # بيانات التواصل
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    website: Mapped[str | None] = mapped_column(String(200), nullable=True)

    # الشعار
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    logo_data: Mapped[str | None] = mapped_column(Text, nullable=True)  # base64

    # إعدادات
    currency: Mapped[str] = mapped_column(String(3), default="SAR")
    fiscal_year_start: Mapped[int] = mapped_column(default=1)
    business_type: Mapped[str] = mapped_column(String(50), default="general")

    # الاشتراك — يُدار من لوحة المدير العام
    plan: Mapped[str] = mapped_column(String(50), default="trial")
    plan_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
