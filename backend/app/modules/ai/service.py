"""
AI Gateway Service
──────────────────
المنطق:
- إذا المدير العام فعّل AI الداخلي → كل الشركات تشتغل تلقائياً حسب باقتها
- الشركة تقدر تضيف مفتاحها الخاص (external) للاستخدام غير المحدود
- لا يحتاج تفعيل منفصل لكل شركة
"""
from __future__ import annotations
import os
from datetime import datetime
from typing import AsyncGenerator
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.ai import AITenantSettings, AIUsage, AISystemConfig
from app.models.tenant import Tenant
from app.modules.ai.providers import get_provider
from app.modules.ai.encryption import encrypt_key, decrypt_key
from app.modules.ai.prompts import get_system_prompt


# ══════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════

async def get_or_create_tenant_settings(tenant_id: str, db: AsyncSession) -> AITenantSettings:
    r = await db.execute(select(AITenantSettings).where(AITenantSettings.tenant_id == tenant_id))
    settings = r.scalar_one_or_none()
    if not settings:
        settings = AITenantSettings(
            tenant_id=tenant_id, provider="internal",
            model="gpt-5-mini", enabled_features=[], is_enabled=False,
        )
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


async def get_system_config(db: AsyncSession) -> AISystemConfig | None:
    r = await db.execute(select(AISystemConfig).where(AISystemConfig.id == 1))
    return r.scalar_one_or_none()


async def ensure_preview_internal_ai(db: AsyncSession) -> None:
    """يفعّل الذكاء الداخلي في بيئة المعاينة فقط عند تمرير علم صريح في البيئة.

    لا يُستدعى هذا المسار في الإنتاج. لا ينشئ قيودًا أو مستندات؛ هو فقط يضبط
    منفذ الذكاء وخصائص الاقتراح المسموح بها للحسابات التجريبية.
    """
    if os.getenv("SMACC_AI_PREVIEW_AUTOCONFIG") != "1":
        return

    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        return

    config = await get_system_config(db)
    if not config:
        config = AISystemConfig(id=1)
        db.add(config)
        await db.flush()

    # تفعيل المزود الداخلي للنماذج المتاحة في المعاينة.
    config.internal_provider = "openai"
    config.internal_model = os.getenv("SMACC_AI_PREVIEW_MODEL", "gpt-5-mini")
    config.internal_api_key_encrypted = encrypt_key(api_key)
    config.internal_enabled = True

    limits = dict(config.plan_limits or {})
    limits["trial"] = 100
    config.plan_limits = limits

    features = dict(config.plan_features or {})
    # تشمل المحاسبة كي يستطيع المستخدم طلب «مسودة قيد» ومراجعتها.
    features["trial"] = ["general", "accounting", "inventory", "sales", "purchases", "reports", "treasury", "pos"]
    config.plan_features = features
    config.updated_at = datetime.utcnow()
    await db.commit()


async def get_monthly_usage(tenant_id: str, feature: str, db: AsyncSession) -> AIUsage:
    month_year = datetime.utcnow().strftime("%Y-%m")
    r = await db.execute(
        select(AIUsage).where(and_(
            AIUsage.tenant_id == tenant_id,
            AIUsage.feature == feature,
            AIUsage.month_year == month_year,
        ))
    )
    usage = r.scalar_one_or_none()
    if not usage:
        usage = AIUsage(tenant_id=tenant_id, feature=feature,
                        month_year=month_year, messages_count=0, tokens_used=0)
        db.add(usage)
        await db.commit()
        await db.refresh(usage)
    return usage


async def record_usage(tenant_id: str, feature: str, tokens: int, db: AsyncSession) -> None:
    usage = await get_monthly_usage(tenant_id, feature, db)
    usage.messages_count += 1
    usage.tokens_used += tokens
    usage.last_used_at = datetime.utcnow()
    await db.commit()


# ══════════════════════════════════════════════════════════════════════
# check_access — المنطق الجديد
# ══════════════════════════════════════════════════════════════════════

async def check_access(tenant_id: str, feature: str, db: AsyncSession) -> tuple[str, str, str]:
    """
    يرجع (provider, api_key, model).
    المنطق:
    1. إذا الشركة عندها مفتاح خاص → استخدمه مباشرة
    2. إذا لا → تحقق من AI الداخلي + حدود الباقة
    """
    ai_settings = await get_or_create_tenant_settings(tenant_id, db)

    # ── External: مفتاح الشركة الخاص ─────────────────────────────────
    if ai_settings.provider in ("openai", "gemini", "unorouter") and ai_settings.api_key_encrypted:
        api_key = decrypt_key(ai_settings.api_key_encrypted)
        if api_key:
            return ai_settings.provider, api_key, ai_settings.model

    # ── Internal: مفتاح النظام ────────────────────────────────────────
    sys_config = await get_system_config(db)

    if not sys_config or not sys_config.internal_enabled:
        raise HTTPException(403, "خدمة AI غير متاحة حالياً. تواصل مع مدير النظام.")

    if not sys_config.internal_api_key_encrypted:
        raise HTTPException(503, "لم يتم إعداد خدمة AI بعد. تواصل مع مدير النظام.")

    # جلب الباقة
    tenant_r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "الشركة غير موجودة.")

    plan = tenant.plan or "trial"
    plan_features: dict = sys_config.plan_features or {}
    plan_limits: dict = sys_config.plan_limits or {}

    # تحقق من الـ feature
    allowed = plan_features.get(plan, ["general"])
    if feature not in allowed:
        raise HTTPException(403, f"ميزة '{feature}' غير متاحة في باقة {plan}. ترقّ للباقة الأعلى.")

    # تحقق من الحد الشهري
    limit = plan_limits.get(plan, 20)
    if limit != -1:
        usage = await get_monthly_usage(tenant_id, feature, db)
        if usage.messages_count >= limit:
            raise HTTPException(429, f"وصلت للحد الشهري ({limit} رسالة) في باقة {plan}.")

    api_key = decrypt_key(sys_config.internal_api_key_encrypted)
    return sys_config.internal_provider, api_key, sys_config.internal_model


# ══════════════════════════════════════════════════════════════════════
# Chat
# ══════════════════════════════════════════════════════════════════════

async def ai_chat(tenant_id: str, feature: str, messages: list[dict],
                  db: AsyncSession, context_data: dict | None = None,
                  user_id: str = "") -> dict:
    provider_name, api_key, model = await check_access(tenant_id, feature, db)
    from app.modules.ai.agent import agent_chat
    try:
        result = await agent_chat(
            provider_name=provider_name, api_key=api_key, model=model,
            feature=feature, messages=messages, tenant_id=tenant_id,
            db=db, user_id=user_id, context_data=context_data,
        )
    except Exception as e:
        err_str = str(e)
        if "429" in err_str:
            if provider_name == "unorouter":
                raise HTTPException(429, "UnoRouter رفض الطلب بسبب حد السرعة أو حد النموذج المجاني. هذا ليس حدًا من لوحة المدير العام؛ جرّب نموذجًا مجانيًا آخر أو انتظر قليلًا.")
            raise HTTPException(429, "تجاوزت حد الطلبات. انتظر قليلاً ثم حاول مرة أخرى.")
        if "401" in err_str or "403" in err_str:
            raise HTTPException(401, "مفتاح API غير صالح أو منتهي الصلاحية.")
        if "404" in err_str:
            raise HTTPException(400, f"الموديل '{model}' غير متاح. غيّر الموديل من الإعدادات.")
        raise HTTPException(500, f"خطأ في خدمة AI: {err_str[:100]}")
    await record_usage(tenant_id, feature, result.get("tokens_used", 0), db)
    return result


async def ai_stream(tenant_id: str, feature: str, messages: list[dict],
                    db: AsyncSession, context_data: dict | None = None,
                    user_id: str = "") -> AsyncGenerator[str, None]:
    provider_name, api_key, model = await check_access(tenant_id, feature, db)
    from app.modules.ai.agent import agent_stream
    total_chars = 0
    try:
        async for chunk in agent_stream(
            provider_name=provider_name, api_key=api_key, model=model,
            feature=feature, messages=messages, tenant_id=tenant_id,
            db=db, user_id=user_id, context_data=context_data,
        ):
            total_chars += len(chunk)
            yield chunk
    except Exception as e:
        err_str = str(e)
        if "429" in err_str:
            if provider_name == "unorouter":
                raise HTTPException(429, "UnoRouter رفض الطلب بسبب حد السرعة أو حد النموذج المجاني. هذا ليس حدًا من لوحة المدير العام؛ جرّب نموذجًا مجانيًا آخر أو انتظر قليلًا.")
            raise HTTPException(429, "تجاوزت حد الطلبات. انتظر قليلاً ثم حاول مرة أخرى.")
        if "401" in err_str or "403" in err_str:
            raise HTTPException(401, "مفتاح API غير صالح أو منتهي الصلاحية.")
        if "404" in err_str:
            raise HTTPException(400, f"الموديل '{model}' غير متاح.")
        raise HTTPException(500, f"خطأ في خدمة AI: {err_str[:100]}")
    await record_usage(tenant_id, feature, total_chars // 4, db)


# ══════════════════════════════════════════════════════════════════════
# Settings
# ══════════════════════════════════════════════════════════════════════

async def update_tenant_ai_settings(tenant_id: str, data: dict, db: AsyncSession) -> AITenantSettings:
    settings = await get_or_create_tenant_settings(tenant_id, db)
    if "provider" in data:
        settings.provider = data["provider"]
    if "api_key" in data and data["api_key"]:
        settings.api_key_encrypted = encrypt_key(data["api_key"])
    if "model" in data:
        settings.model = data["model"]
    if "enabled_features" in data:
        settings.enabled_features = data["enabled_features"]
    if "is_enabled" in data:
        settings.is_enabled = data["is_enabled"]
    settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(settings)
    return settings


async def get_tenant_ai_info(tenant_id: str, db: AsyncSession) -> dict:
    """
    is_enabled = True تلقائياً إذا:
    - AI الداخلي مفعّل من المدير العام (internal_enabled=True + مفتاح موجود)
    - أو الشركة عندها مفتاح خاص
    """
    from app.modules.ai.encryption import mask_key

    settings = await get_or_create_tenant_settings(tenant_id, db)
    sys_config = await get_system_config(db)

    month_year = datetime.utcnow().strftime("%Y-%m")
    usage_r = await db.execute(
        select(AIUsage).where(and_(AIUsage.tenant_id == tenant_id, AIUsage.month_year == month_year))
    )
    usages = usage_r.scalars().all()

    tenant_r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_r.scalar_one_or_none()
    plan = tenant.plan if tenant else "trial"

    # حساب الحالة الفعلية
    internal_available = bool(
        sys_config and sys_config.internal_enabled and sys_config.internal_api_key_encrypted
    )
    has_external_key = bool(
        settings.provider in ("openai", "gemini", "unorouter") and settings.api_key_encrypted
    )
    effective_enabled = internal_available or has_external_key

    plan_limit = -1
    plan_allowed_features: list = ["general"]
    if sys_config:
        plan_limit = (sys_config.plan_limits or {}).get(plan, 20)
        plan_allowed_features = (sys_config.plan_features or {}).get(plan, ["general"])

    masked_key = ""
    if settings.api_key_encrypted:
        plain = decrypt_key(settings.api_key_encrypted)
        masked_key = mask_key(plain) if plain else ""

    # عند اختيار المزود الداخلي، النموذج الفعلي يحدده إعداد النظام المركزي.
    effective_model = (
        sys_config.internal_model
        if settings.provider == "internal" and internal_available and sys_config
        else settings.model
    )

    return {
        "provider": settings.provider,
        "model": effective_model,
        "is_enabled": effective_enabled,
        "enabled_features": plan_allowed_features,
        "api_key_masked": masked_key,
        "has_api_key": bool(settings.api_key_encrypted),
        "has_external_key": has_external_key,
        "usage": {
            "month": month_year,
            "total_messages": sum(u.messages_count for u in usages),
            "total_tokens": sum(u.tokens_used for u in usages),
            "by_feature": {u.feature: {"messages": u.messages_count, "tokens": u.tokens_used} for u in usages},
        },
        "plan_info": {
            "plan": plan,
            "monthly_limit": plan_limit,
            "allowed_features": plan_allowed_features,
            "internal_available": internal_available,
        },
    }
