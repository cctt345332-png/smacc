"""
Super Admin Router
──────────────────
لوحة المدير العام — إدارة الشركات، الباقات، الأنشطة، وصفحة الهبوط.
الوصول: role == "super_admin" فقط.
"""
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.core.tenant import get_current_user
from app.models.tenant import Tenant
from app.models.user import User
from app.models.system_config import SystemConfig

router = APIRouter(prefix="/admin", tags=["super-admin"])


# ─── Guard: super_admin فقط ───────────────────────────────────────────
async def require_super_admin(user=Depends(get_current_user)):
    if user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


# ══════════════════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════════════════

class TenantUpdateAdmin(BaseModel):
    name: Optional[str] = None
    name_en: Optional[str] = None
    plan: Optional[str] = None
    plan_expires_at: Optional[datetime] = None
    business_type: Optional[str] = None
    is_active: Optional[bool] = None
    admin_notes: Optional[str] = None
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class PlanConfigSchema(BaseModel):
    key: str
    label_ar: str
    label_en: str
    price_monthly: float
    price_yearly: float
    color: str
    bg: str
    popular: bool = False
    limits: Dict[str, Any]
    modules: List[str]
    features_ar: List[str]
    features_en: List[str]


class ActivityConfigSchema(BaseModel):
    key: str
    label_ar: str
    label_en: str
    desc_ar: str
    desc_en: str
    icon: str
    color: str
    bg: str
    tracking: str
    allow_purchase_from_pos: bool
    modules: List[str]
    inventory_features: Dict[str, bool]


class LandingConfigSchema(BaseModel):
    hero_title_ar: Optional[str] = None
    hero_title_en: Optional[str] = None
    hero_subtitle_ar: Optional[str] = None
    hero_subtitle_en: Optional[str] = None
    hero_badge_ar: Optional[str] = None
    hero_badge_en: Optional[str] = None
    hero_cta_ar: Optional[str] = None
    hero_cta_en: Optional[str] = None
    trust_text_ar: Optional[str] = None
    trust_text_en: Optional[str] = None
    features_title_ar: Optional[str] = None
    features_title_en: Optional[str] = None
    pricing_title_ar: Optional[str] = None
    pricing_title_en: Optional[str] = None
    pricing_subtitle_ar: Optional[str] = None
    pricing_subtitle_en: Optional[str] = None
    show_activities: bool = True
    show_features: bool = True
    show_pricing: bool = True


# ══════════════════════════════════════════════════════════════════════
# TENANTS (الشركات)
# ══════════════════════════════════════════════════════════════════════

@router.get("/tenants")
async def list_tenants(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    plan: Optional[str] = None,
    is_active: Optional[bool] = None,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """قائمة جميع الشركات مع إمكانية الفلترة والبحث"""
    q = select(Tenant)
    if search:
        q = q.where(
            (Tenant.name.ilike(f"%{search}%")) |
            (Tenant.name_en.ilike(f"%{search}%")) |
            (Tenant.email.ilike(f"%{search}%"))
        )
    if plan:
        q = q.where(Tenant.plan == plan)
    if is_active is not None:
        q = q.where(Tenant.is_active == is_active)

    # العدد الكلي
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()

    q = q.order_by(Tenant.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    tenants = result.scalars().all()

    # إضافة عدد المستخدمين لكل شركة
    tenant_list = []
    for t in tenants:
        users_count = (await db.execute(
            select(func.count()).where(User.tenant_id == t.id)
        )).scalar()
        tenant_list.append({
            "id": t.id,
            "name": t.name,
            "name_en": t.name_en,
            "email": t.email,
            "phone": t.phone,
            "business_type": t.business_type,
            "plan": t.plan,
            "plan_expires_at": t.plan_expires_at,
            "is_active": t.is_active,
            "admin_notes": t.admin_notes,
            "vat_number": t.vat_number,
            "cr_number": t.cr_number,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
            "users_count": users_count,
        })

    return {"total": total, "items": tenant_list}


@router.get("/tenants/{tenant_id}")
async def get_tenant(
    tenant_id: str,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """تفاصيل شركة محددة"""
    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    # المستخدمون
    users_r = await db.execute(select(User).where(User.tenant_id == tenant_id))
    users = users_r.scalars().all()

    return {
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "name_en": tenant.name_en,
            "email": tenant.email,
            "phone": tenant.phone,
            "website": tenant.website,
            "vat_number": tenant.vat_number,
            "cr_number": tenant.cr_number,
            "address_city": tenant.address_city,
            "address_street": tenant.address_street,
            "business_type": tenant.business_type,
            "plan": tenant.plan,
            "plan_expires_at": tenant.plan_expires_at,
            "is_active": tenant.is_active,
            "admin_notes": tenant.admin_notes,
            "currency": tenant.currency,
            "created_at": tenant.created_at,
            "updated_at": tenant.updated_at,
        },
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at,
            }
            for u in users
        ],
    }


@router.put("/tenants/{tenant_id}")
async def update_tenant(
    tenant_id: str,
    data: TenantUpdateAdmin,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """تعديل بيانات شركة (الباقة، النشاط، التفعيل...)"""
    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    update_data = data.model_dump(exclude_none=True)

    # إذا تغيرت الباقة لـ trial، احسب تاريخ الانتهاء تلقائياً
    if "plan" in update_data and update_data["plan"] == "trial" and "plan_expires_at" not in update_data:
        update_data["plan_expires_at"] = datetime.utcnow() + timedelta(days=14)

    for k, v in update_data.items():
        setattr(tenant, k, v)
    tenant.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tenant)
    return {"message": "Tenant updated", "tenant_id": tenant.id}


@router.post("/tenants/{tenant_id}/extend-plan")
async def extend_plan(
    tenant_id: str,
    days: int = 30,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """تمديد صلاحية الباقة"""
    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    base = tenant.plan_expires_at or datetime.utcnow()
    tenant.plan_expires_at = base + timedelta(days=days)
    tenant.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": f"Plan extended by {days} days", "new_expiry": tenant.plan_expires_at}


@router.delete("/tenants/{tenant_id}")
async def deactivate_tenant(
    tenant_id: str,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """إيقاف تفعيل شركة (soft delete)"""
    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    tenant.is_active = False
    tenant.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "Tenant deactivated"}


# ══════════════════════════════════════════════════════════════════════
# STATS (إحصائيات)
# ══════════════════════════════════════════════════════════════════════

@router.get("/stats")
async def get_stats(
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """إحصائيات عامة للوحة المدير العام"""
    total_tenants = (await db.execute(select(func.count()).select_from(Tenant))).scalar()
    active_tenants = (await db.execute(select(func.count()).where(Tenant.is_active == True))).scalar()
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()

    # توزيع الباقات
    plans_dist = {}
    for plan_key in ["trial", "starter", "professional", "enterprise"]:
        count = (await db.execute(
            select(func.count()).where(Tenant.plan == plan_key, Tenant.is_active == True)
        )).scalar()
        plans_dist[plan_key] = count

    # توزيع الأنشطة
    activities_dist = {}
    for act in ["mobile_phones", "spare_parts", "pharmacy", "grocery", "spices", "clothing", "construction", "general"]:
        count = (await db.execute(
            select(func.count()).where(Tenant.business_type == act, Tenant.is_active == True)
        )).scalar()
        activities_dist[act] = count

    # شركات منتهية الصلاحية
    expired = (await db.execute(
        select(func.count()).where(
            Tenant.plan_expires_at < datetime.utcnow(),
            Tenant.is_active == True
        )
    )).scalar()

    # شركات جديدة هذا الشهر
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0)
    new_this_month = (await db.execute(
        select(func.count()).where(Tenant.created_at >= month_start)
    )).scalar()

    return {
        "total_tenants": total_tenants,
        "active_tenants": active_tenants,
        "inactive_tenants": total_tenants - active_tenants,
        "total_users": total_users,
        "expired_plans": expired,
        "new_this_month": new_this_month,
        "plans_distribution": plans_dist,
        "activities_distribution": activities_dist,
    }


# ══════════════════════════════════════════════════════════════════════
# PLANS CONFIG (إدارة الباقات) — محفوظة في DB
# ══════════════════════════════════════════════════════════════════════

async def _get_config(db: AsyncSession, key: str) -> dict:
    r = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    cfg = r.scalar_one_or_none()
    if cfg:
        import json
        return json.loads(cfg.value)
    return {}


async def _set_config(db: AsyncSession, key: str, value: dict) -> None:
    import json
    from datetime import datetime
    r = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    cfg = r.scalar_one_or_none()
    if cfg:
        cfg.value = json.dumps(value, ensure_ascii=False)
        cfg.updated_at = datetime.utcnow()
    else:
        cfg = SystemConfig(key=key, value=json.dumps(value, ensure_ascii=False), updated_at=datetime.utcnow())
        db.add(cfg)
    await db.commit()


@router.get("/plans-config")
async def get_plans_config(_=Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    data = await _get_config(db, "plans_config")
    return {"plans": data, "source": "db" if data else "default"}


@router.put("/plans-config")
async def update_plans_config(data: dict, _=Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    await _set_config(db, "plans_config", data)
    return {"message": "Plans config updated"}


@router.get("/plans-config/public")
async def get_plans_config_public(db: AsyncSession = Depends(get_db)):
    data = await _get_config(db, "plans_config")
    return {"plans": data, "has_override": bool(data)}


# ══════════════════════════════════════════════════════════════════════
# ACTIVITIES CONFIG — محفوظة في DB
# ══════════════════════════════════════════════════════════════════════

@router.get("/activities-config")
async def get_activities_config(_=Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    data = await _get_config(db, "activities_config")
    return {"activities": data, "source": "db" if data else "default"}


@router.put("/activities-config")
async def update_activities_config(data: dict, _=Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    await _set_config(db, "activities_config", data)
    return {"message": "Activities config updated"}


@router.get("/activities-config/public")
async def get_activities_config_public(db: AsyncSession = Depends(get_db)):
    data = await _get_config(db, "activities_config")
    return {"activities": data, "has_override": bool(data)}


# ══════════════════════════════════════════════════════════════════════
# LANDING PAGE CONFIG — محفوظة في DB
# ══════════════════════════════════════════════════════════════════════

@router.get("/landing-config")
async def get_landing_config(_=Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    return await _get_config(db, "landing_config")


@router.put("/landing-config")
async def update_landing_config(data: dict, _=Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    existing = await _get_config(db, "landing_config")
    existing.update(data)
    await _set_config(db, "landing_config", existing)
    return {"message": "Landing config updated", "config": existing}


@router.get("/landing-config/public")
async def get_landing_config_public(db: AsyncSession = Depends(get_db)):
    return await _get_config(db, "landing_config")


# ══════════════════════════════════════════════════════════════════════
# SUPER ADMIN USER MANAGEMENT
# ══════════════════════════════════════════════════════════════════════

@router.get("/users")
async def list_all_users(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """قائمة جميع المستخدمين في النظام"""
    q = select(User)
    if search:
        q = q.where(
            (User.email.ilike(f"%{search}%")) |
            (User.full_name.ilike(f"%{search}%"))
        )
    count_q = select(func.count()).select_from(q.subquery())
    total = (await db.execute(count_q)).scalar()

    q = q.order_by(User.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    users = result.scalars().all()

    return {
        "total": total,
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "tenant_id": u.tenant_id,
                "is_active": u.is_active,
                "created_at": u.created_at,
            }
            for u in users
        ],
    }


@router.put("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    _=Depends(require_super_admin),
    db: AsyncSession = Depends(get_db),
):
    """تفعيل/إيقاف مستخدم"""
    r = await db.execute(select(User).where(User.id == user_id))
    user = r.scalar_one_or_none()
    if not user:
        raise HTTPException(404, "User not found")
    user.is_active = not user.is_active
    await db.commit()
    return {"message": "User status toggled", "is_active": user.is_active}
