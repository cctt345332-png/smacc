"""
AI Admin Router — للمدير العام فقط
────────────────────────────────────
/admin/ai/system-config    — إعدادات النظام الداخلي
/admin/ai/tenants          — إعدادات AI لكل الشركات
/admin/ai/usage-stats      — إحصائيات الاستخدام الكلية
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.tenant import get_current_user
from app.models.ai import AISystemConfig, AITenantSettings, AIUsage
from app.models.tenant import Tenant
from app.modules.ai.encryption import encrypt_key, decrypt_key, mask_key
from app.modules.ai.providers import get_provider, ALL_MODELS

router = APIRouter(prefix="/admin/ai", tags=["admin-ai"])


# ─── Guard ────────────────────────────────────────────────────────────
async def require_super_admin(user=Depends(get_current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(403, "Super admin access required")
    return user


# ─── Schemas ──────────────────────────────────────────────────────────
class SystemConfigUpdate(BaseModel):
    internal_provider: Optional[str] = None
    internal_api_key: Optional[str] = None   # يُشفَّر قبل الحفظ
    internal_model: Optional[str] = None
    internal_enabled: Optional[bool] = None
    plan_limits: Optional[dict] = None
    plan_features: Optional[dict] = None


class TenantAIUpdate(BaseModel):
    is_enabled: Optional[bool] = None
    enabled_features: Optional[list[str]] = None
    provider: Optional[str] = None
    model: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════
# System Config
# ══════════════════════════════════════════════════════════════════════
@router.get("/system-config")
async def get_ai_system_config(
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """جلب إعدادات AI الداخلية"""
    from app.modules.ai.service import get_system_config as _get_sys_cfg
    r = await db.execute(select(AISystemConfig).where(AISystemConfig.id == 1))
    config = r.scalar_one_or_none()

    if not config:
        return {
            "internal_provider": "openai",
            "internal_model": "gpt-4o-mini",
            "internal_enabled": False,
            "has_api_key": False,
            "api_key_masked": "",
            "plan_limits": {"trial": 20, "starter": 100, "professional": 500, "enterprise": -1},
            "plan_features": {
                "trial":        ["general"],
                "starter":      ["general", "accounting", "inventory"],
                "professional": ["general", "accounting", "inventory", "sales", "pos", "reports"],
                "enterprise":   ["general", "accounting", "inventory", "sales", "pos", "reports", "purchases", "treasury"],
            },
        }

    masked = ""
    if config.internal_api_key_encrypted:
        plain = decrypt_key(config.internal_api_key_encrypted)
        masked = mask_key(plain) if plain else ""

    return {
        "internal_provider": config.internal_provider,
        "internal_model": config.internal_model,
        "internal_enabled": config.internal_enabled,
        "has_api_key": bool(config.internal_api_key_encrypted),
        "api_key_masked": masked,
        "plan_limits": config.plan_limits,
        "plan_features": config.plan_features,
        "updated_at": config.updated_at,
    }


@router.put("/system-config")
async def update_system_config(
    data: SystemConfigUpdate,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """تحديث إعدادات AI الداخلية"""
    r = await db.execute(select(AISystemConfig).where(AISystemConfig.id == 1))
    config = r.scalar_one_or_none()

    if not config:
        config = AISystemConfig(id=1)
        db.add(config)

    if data.internal_provider is not None:
        if data.internal_provider not in ("openai", "gemini"):
            raise HTTPException(400, "provider يجب أن يكون openai أو gemini")
        config.internal_provider = data.internal_provider

    if data.internal_api_key:
        config.internal_api_key_encrypted = encrypt_key(data.internal_api_key)

    if data.internal_model is not None:
        config.internal_model = data.internal_model

    if data.internal_enabled is not None:
        config.internal_enabled = data.internal_enabled

    if data.plan_limits is not None:
        config.plan_limits = data.plan_limits

    if data.plan_features is not None:
        config.plan_features = data.plan_features

    config.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "تم تحديث إعدادات AI الداخلية"}


@router.post("/system-config/validate-key")
async def validate_internal_key(
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """التحقق من صحة المفتاح الداخلي المحفوظ"""
    r = await db.execute(select(AISystemConfig).where(AISystemConfig.id == 1))
    config = r.scalar_one_or_none()

    if not config or not config.internal_api_key_encrypted:
        return {"valid": False, "message": "لا يوجد مفتاح محفوظ"}

    api_key = decrypt_key(config.internal_api_key_encrypted)
    if not api_key:
        return {"valid": False, "message": "تعذّر فك تشفير المفتاح"}

    try:
        provider = get_provider(config.internal_provider, api_key, config.internal_model)
        is_valid = await provider.validate_key()
        return {"valid": is_valid, "message": "المفتاح صالح" if is_valid else "المفتاح غير صالح"}
    except Exception as e:
        return {"valid": False, "message": str(e)}


# ══════════════════════════════════════════════════════════════════════
# Tenants AI Management
# ══════════════════════════════════════════════════════════════════════
@router.get("/tenants")
async def list_tenants_ai(
    skip: int = 0,
    limit: int = 50,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """قائمة إعدادات AI لكل الشركات"""
    # جلب كل الشركات
    tenants_r = await db.execute(
        select(Tenant).where(Tenant.is_active == True).offset(skip).limit(limit)
    )
    tenants = tenants_r.scalars().all()

    result = []
    month_year = datetime.utcnow().strftime("%Y-%m")

    for tenant in tenants:
        # إعدادات AI
        ai_r = await db.execute(
            select(AITenantSettings).where(AITenantSettings.tenant_id == tenant.id)
        )
        ai_settings = ai_r.scalar_one_or_none()

        # استخدام الشهر الحالي
        usage_r = await db.execute(
            select(func.sum(AIUsage.messages_count)).where(
                AIUsage.tenant_id == tenant.id,
                AIUsage.month_year == month_year,
            )
        )
        total_messages = usage_r.scalar() or 0

        result.append({
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "plan": tenant.plan,
            "ai_enabled": ai_settings.is_enabled if ai_settings else False,
            "provider": ai_settings.provider if ai_settings else "internal",
            "model": ai_settings.model if ai_settings else "gpt-4o-mini",
            "enabled_features": ai_settings.enabled_features if ai_settings else [],
            "messages_this_month": total_messages,
        })

    return {"items": result, "total": len(result)}


@router.put("/tenants/{tenant_id}")
async def update_tenant_ai(
    tenant_id: str,
    data: TenantAIUpdate,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """تعديل إعدادات AI لشركة محددة (من المدير العام)"""
    from app.modules.ai.service import get_or_create_tenant_settings

    settings = await get_or_create_tenant_settings(tenant_id, db)

    if data.is_enabled is not None:
        settings.is_enabled = data.is_enabled
    if data.enabled_features is not None:
        settings.enabled_features = data.enabled_features
    if data.provider is not None:
        settings.provider = data.provider
    if data.model is not None:
        settings.model = data.model

    settings.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "تم تحديث إعدادات AI للشركة"}


@router.post("/sync-plans")
async def sync_plans_to_tenants(
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    مزامنة إعدادات AI مع الشركات حسب باقاتها.
    يفعّل AI لكل الشركات النشطة ويضبط الميزات حسب الباقة.
    """
    from app.modules.ai.service import get_or_create_tenant_settings

    sys_config_r = await db.execute(select(AISystemConfig).where(AISystemConfig.id == 1))
    sys_config = sys_config_r.scalar_one_or_none()
    if not sys_config:
        raise HTTPException(400, "لم يتم إعداد AI الداخلي بعد")

    plan_features: dict = sys_config.plan_features or {}

    tenants_r = await db.execute(select(Tenant).where(Tenant.is_active == True))
    tenants = tenants_r.scalars().all()

    updated = 0
    for tenant in tenants:
        features = plan_features.get(tenant.plan, ["general"])
        settings = await get_or_create_tenant_settings(tenant.id, db)
        settings.is_enabled = True
        settings.enabled_features = features
        settings.provider = "internal"
        settings.updated_at = datetime.utcnow()
        updated += 1

    await db.commit()
    return {"message": f"تم تحديث {updated} شركة", "updated": updated}


# ══════════════════════════════════════════════════════════════════════
# Usage Stats
# ══════════════════════════════════════════════════════════════════════
@router.get("/usage-stats")
async def get_usage_stats(
    month_year: Optional[str] = None,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """إحصائيات استخدام AI الكلية"""
    if not month_year:
        month_year = datetime.utcnow().strftime("%Y-%m")

    # إجمالي الرسائل
    total_r = await db.execute(
        select(func.sum(AIUsage.messages_count), func.sum(AIUsage.tokens_used))
        .where(AIUsage.month_year == month_year)
    )
    total_msgs, total_tokens = total_r.one()

    # توزيع حسب الـ feature
    feature_r = await db.execute(
        select(AIUsage.feature, func.sum(AIUsage.messages_count))
        .where(AIUsage.month_year == month_year)
        .group_by(AIUsage.feature)
    )
    by_feature = {row[0]: row[1] for row in feature_r.all()}

    # عدد الشركات المستخدمة
    active_tenants_r = await db.execute(
        select(func.count(func.distinct(AIUsage.tenant_id)))
        .where(AIUsage.month_year == month_year)
    )
    active_tenants = active_tenants_r.scalar() or 0

    # عدد الشركات التي فعّلت AI
    enabled_r = await db.execute(
        select(func.count()).where(AITenantSettings.is_enabled == True)
    )
    enabled_count = enabled_r.scalar() or 0

    return {
        "month": month_year,
        "total_messages": total_msgs or 0,
        "total_tokens": total_tokens or 0,
        "active_tenants": active_tenants,
        "enabled_tenants": enabled_count,
        "by_feature": by_feature,
    }


@router.get("/models")
async def get_all_models(_=Depends(require_super_admin)):
    """قائمة كل الموديلات المتاحة"""
    return ALL_MODELS
