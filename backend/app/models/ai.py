"""
AI Models
─────────
ai_tenant_settings  — إعدادات AI لكل شركة (provider, key, features)
ai_usage            — تتبع الاستخدام الشهري لكل شركة
ai_system_config    — إعدادات النظام الداخلي (يديرها المدير العام)
"""
from sqlalchemy import String, Boolean, DateTime, Text, Integer, BigInteger, JSON
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
from app.core.database import Base


class AITenantSettings(Base):
    """إعدادات AI لكل شركة"""
    __tablename__ = "ai_tenant_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True, unique=True)

    # نوع الـ provider
    # "internal"  → يستخدم مفتاح النظام (محدود بالباقة)
    # "openai"    → مفتاح الشركة الخاص
    # "gemini"    → مفتاح الشركة الخاص
    provider: Mapped[str] = mapped_column(String(50), default="internal")

    # مفتاح API الخاص بالشركة (مشفر) — فارغ إذا كانوا يستخدمون internal
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    # الموديل المختار
    # النماذج الداخلية المتاحة في المعاينة تبدأ بـ GPT-5 Mini.
    model: Mapped[str] = mapped_column(String(100), default="gpt-5-mini")

    # الميزات المفعّلة لهذه الشركة (JSON array)
    # ["accounting", "inventory", "sales", "general", "pos", "reports"]
    enabled_features: Mapped[list] = mapped_column(JSON, default=list)

    # هل AI مفعّل لهذه الشركة؟
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AIUsage(Base):
    """تتبع استخدام AI الشهري لكل شركة"""
    __tablename__ = "ai_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, index=True)

    # الميزة المستخدمة
    feature: Mapped[str] = mapped_column(String(50))  # accounting, inventory, general...

    # الشهر والسنة (YYYY-MM)
    month_year: Mapped[str] = mapped_column(String(7), index=True)

    # عدد الرسائل المرسلة هذا الشهر
    messages_count: Mapped[int] = mapped_column(Integer, default=0)

    # عدد الـ tokens المستخدمة (تقريبي)
    tokens_used: Mapped[int] = mapped_column(BigInteger, default=0)

    # آخر استخدام
    last_used_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AISystemConfig(Base):
    """
    إعدادات AI على مستوى النظام — يديرها المدير العام فقط.
    صف واحد فقط في الجدول (singleton).
    """
    __tablename__ = "ai_system_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    # الـ provider الداخلي للنظام
    internal_provider: Mapped[str] = mapped_column(String(50), default="openai")

    # مفتاح API الداخلي (مشفر)
    internal_api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)

    # الموديل الداخلي
    internal_model: Mapped[str] = mapped_column(String(100), default="gpt-5-mini")

    # حدود الرسائل الشهرية لكل باقة (JSON)
    # {"trial": 20, "starter": 100, "professional": 500, "enterprise": -1}
    # -1 = غير محدود
    plan_limits: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "trial": 20,
        "starter": 100,
        "professional": 500,
        "enterprise": -1,
    })

    # الميزات المتاحة لكل باقة (JSON)
    # {"trial": ["general"], "starter": ["general", "accounting"], ...}
    plan_features: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "trial":        ["general"],
        "starter":      ["general", "accounting", "inventory"],
        "professional": ["general", "accounting", "inventory", "sales", "pos", "reports"],
        "enterprise":   ["general", "accounting", "inventory", "sales", "pos", "reports", "purchases", "treasury"],
    })

    # هل الـ AI الداخلي مفعّل؟
    internal_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
