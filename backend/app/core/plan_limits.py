"""
plan_limits.py
──────────────
التحقق من حدود الباقة قبل إنشاء أي سجل.

الحدود لكل باقة:
  trial:        users=2,  warehouses=1, branches=1, pos_terminals=1, invoices_per_month=50
  starter:      users=3,  warehouses=1, branches=1, pos_terminals=1, invoices_per_month=300
  professional: users=10, warehouses=3, branches=3, pos_terminals=3, invoices_per_month=2000
  enterprise:   users=∞,  warehouses=∞, branches=∞, pos_terminals=∞, invoices_per_month=∞

الاستخدام:
    @router.post("/users")
    async def create_user(..., _=Depends(check_plan_limit("users"))):
        ...
"""
from datetime import datetime, date
from fastapi import HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.tenant import get_current_user
from app.models.tenant import Tenant
from app.models.user import User


# ─── حدود الباقات ────────────────────────────────────────────────────
PLAN_LIMITS: dict[str, dict] = {
    "trial": {
        "users":              2,
        "warehouses":         1,
        "branches":           1,
        "pos_terminals":      1,
        "invoices_per_month": 50,
    },
    "starter": {
        "users":              3,
        "warehouses":         1,
        "branches":           1,
        "pos_terminals":      1,
        "invoices_per_month": 300,
    },
    "professional": {
        "users":              10,
        "warehouses":         3,
        "branches":           3,
        "pos_terminals":      3,
        "invoices_per_month": 2000,
    },
    "enterprise": {
        "users":              None,   # None = غير محدود
        "warehouses":         None,
        "branches":           None,
        "pos_terminals":      None,
        "invoices_per_month": None,
    },
}

# رسائل الخطأ
LIMIT_MESSAGES = {
    "users": {
        "ar": "وصلت للحد الأقصى من المستخدمين في باقتك",
        "en": "You have reached the maximum number of users in your plan",
    },
    "warehouses": {
        "ar": "وصلت للحد الأقصى من المستودعات في باقتك",
        "en": "You have reached the maximum number of warehouses in your plan",
    },
    "branches": {
        "ar": "وصلت للحد الأقصى من الفروع في باقتك",
        "en": "You have reached the maximum number of branches in your plan",
    },
    "pos_terminals": {
        "ar": "وصلت للحد الأقصى من نقاط البيع في باقتك",
        "en": "You have reached the maximum number of POS terminals in your plan",
    },
    "invoices_per_month": {
        "ar": "وصلت للحد الأقصى من الفواتير هذا الشهر في باقتك",
        "en": "You have reached the maximum number of invoices this month in your plan",
    },
}


async def _get_tenant(db: AsyncSession, tenant_id: str) -> Tenant:
    """جلب بيانات الشركة مع التحقق من الاشتراك"""
    r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = r.scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "الشركة غير موجودة")
    if not tenant.is_active:
        raise HTTPException(403, "حساب الشركة موقوف. تواصل مع المدير العام")
    # التحقق من انتهاء الاشتراك (ما عدا enterprise)
    if tenant.plan != "enterprise" and tenant.plan_expires_at:
        if tenant.plan_expires_at < datetime.utcnow():
            raise HTTPException(
                403,
                "انتهت صلاحية اشتراكك. جدد اشتراكك للاستمرار في استخدام النظام"
            )
    return tenant


def _get_limit(plan: str, resource: str) -> int | None:
    """جلب الحد المسموح لباقة ومورد معين"""
    plan_cfg = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])
    return plan_cfg.get(resource)


def check_plan_limit(resource: str):
    """
    Dependency factory — يتحقق من حد الباقة قبل إنشاء سجل جديد.

    resource: "users" | "warehouses" | "branches" | "pos_terminals" | "invoices_per_month"

    مثال:
        @router.post("/users")
        async def create_user(
            data: dict,
            user=Depends(get_current_user),
            _=Depends(check_plan_limit("users")),
            db: AsyncSession = Depends(get_db),
        ):
    """
    async def _check(
        user=Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ):
        tenant = await _get_tenant(db, user["tenant_id"])
        limit = _get_limit(tenant.plan, resource)

        # غير محدود
        if limit is None:
            return user

        # حساب الاستخدام الحالي
        current = await _count_resource(db, user["tenant_id"], resource)

        if current >= limit:
            msg = LIMIT_MESSAGES.get(resource, {})
            raise HTTPException(
                status_code=402,
                detail={
                    "error": "plan_limit_exceeded",
                    "resource": resource,
                    "current": current,
                    "limit": limit,
                    "plan": tenant.plan,
                    "message_ar": msg.get("ar", "وصلت للحد الأقصى في باقتك"),
                    "message_en": msg.get("en", "Plan limit exceeded"),
                    "upgrade_required": True,
                }
            )
        return user

    return _check


async def _count_resource(db: AsyncSession, tenant_id: str, resource: str) -> int:
    """حساب الاستخدام الحالي لمورد معين"""

    if resource == "users":
        from app.models.user import User
        count = (await db.execute(
            select(func.count()).where(
                User.tenant_id == tenant_id,
                User.is_active == True,
            )
        )).scalar() or 0
        return count

    elif resource == "warehouses":
        from app.models.inventory import Warehouse
        count = (await db.execute(
            select(func.count()).where(
                Warehouse.tenant_id == tenant_id,
                Warehouse.is_active == True,
            )
        )).scalar() or 0
        return count

    elif resource == "pos_terminals":
        from app.models.pos import POSTerminal
        count = (await db.execute(
            select(func.count()).where(
                POSTerminal.tenant_id == tenant_id,
                POSTerminal.is_active == True,
            )
        )).scalar() or 0
        return count

    elif resource == "invoices_per_month":
        from app.models.sales import Invoice
        # فواتير الشهر الحالي فقط
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        count = (await db.execute(
            select(func.count()).where(
                Invoice.tenant_id == tenant_id,
                Invoice.created_at >= month_start,
            )
        )).scalar() or 0
        return count

    elif resource == "branches":
        # الفروع = مستودعات مختلفة الـ branch_name
        from app.models.inventory import Warehouse
        from sqlalchemy import distinct
        count = (await db.execute(
            select(func.count(distinct(Warehouse.branch_name))).where(
                Warehouse.tenant_id == tenant_id,
                Warehouse.is_active == True,
                Warehouse.branch_name.isnot(None),
            )
        )).scalar() or 0
        return max(count, 1)  # على الأقل فرع واحد

    return 0


async def get_plan_usage(db: AsyncSession, tenant_id: str) -> dict:
    """
    جلب الاستخدام الكامل للشركة — يُستخدم في صفحة الاشتراك.
    """
    tenant = await _get_tenant(db, tenant_id)
    plan = tenant.plan
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["trial"])

    usage = {}
    for resource in ["users", "warehouses", "branches", "pos_terminals", "invoices_per_month"]:
        current = await _count_resource(db, tenant_id, resource)
        limit = limits.get(resource)
        usage[resource] = {
            "current": current,
            "limit": limit,
            "unlimited": limit is None,
            "percentage": 0 if limit is None else min(round((current / limit) * 100), 100),
            "at_limit": False if limit is None else current >= limit,
            "near_limit": False if limit is None else current >= limit * 0.8,
        }

    return {
        "plan": plan,
        "plan_expires_at": tenant.plan_expires_at,
        "is_active": tenant.is_active,
        "usage": usage,
    }
