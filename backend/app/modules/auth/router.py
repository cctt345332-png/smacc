import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from typing import Optional

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.tenant import get_current_user, require_role
from app.core.plan_limits import check_plan_limit
from app.models.user import User
from app.models.tenant import Tenant

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    company_name: str
    email: EmailStr
    password: str
    full_name: str
    business_type: str = "general"
    plan: str = "trial"
    vat_number: Optional[str] = None
    cr_number: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/register")
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # التحقق من عدم تكرار البريد الإلكتروني
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "البريد الإلكتروني مستخدم بالفعل")

    # حساب تاريخ انتهاء الخطة
    plan_expires = None
    if data.plan == "trial":
        plan_expires = datetime.utcnow() + timedelta(days=14)

    # إنشاء الشركة
    tenant = Tenant(
        id=str(uuid.uuid4()),
        name=data.company_name,
        business_type=data.business_type,
        plan=data.plan,
        plan_expires_at=plan_expires,
        vat_number=data.vat_number or None,
        cr_number=data.cr_number or None,
    )
    db.add(tenant)
    await db.flush()  # نحفظ tenant في الـ transaction قبل أي insert يعتمد عليه

    # إنشاء المستخدم الأول (admin)
    user = User(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role="admin",
    )
    db.add(user)

    # إنشاء المستودع الرئيسي تلقائياً
    from app.models.inventory import Warehouse
    main_warehouse = Warehouse(
        id=str(uuid.uuid4()),
        tenant_id=tenant.id,
        name_ar="المستودع الرئيسي",
        name_en="Main Warehouse",
        branch_name="main",
        is_default=True,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(main_warehouse)

    await db.commit()
    return {"message": "تم تسجيل الشركة بنجاح", "tenant_id": tenant.id}


@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="الحساب موقوف")

    token = create_access_token({
        "sub": user.id,
        "tenant_id": user.tenant_id,
        "role": user.role,
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": user.tenant_id,
        }
    }


class SuperAdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/super-admin/login")
async def super_admin_login(data: SuperAdminLoginRequest, db: AsyncSession = Depends(get_db)):
    """تسجيل دخول المدير العام — يتحقق من role == super_admin"""
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="بيانات الدخول غير صحيحة")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="الحساب موقوف")

    if user.role != "super_admin":
        raise HTTPException(status_code=403, detail="ليس لديك صلاحية الوصول للوحة المدير العام")

    token = create_access_token({
        "sub": user.id,
        "tenant_id": user.tenant_id,
        "role": user.role,
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role,
            "tenant_id": user.tenant_id,
        }
    }


class CreateSuperAdminRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    secret_key: str  # مفتاح سري لحماية الـ endpoint


@router.post("/super-admin/create")
async def create_super_admin(data: CreateSuperAdminRequest, db: AsyncSession = Depends(get_db)):
    """إنشاء حساب مدير عام — يستخدم مرة واحدة فقط عند الإعداد الأولي"""
    from app.core.config import settings
    if data.secret_key != settings.SUPER_ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="مفتاح سري غير صحيح")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "البريد الإلكتروني مستخدم بالفعل")

    # إنشاء tenant وهمي للمدير العام
    admin_tenant = Tenant(
        id=str(uuid.uuid4()),
        name="Super Admin",
        name_en="Super Admin",
        business_type="general",
        plan="enterprise",
    )
    db.add(admin_tenant)
    await db.flush()

    user = User(
        id=str(uuid.uuid4()),
        tenant_id=admin_tenant.id,
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role="super_admin",
    )
    db.add(user)
    await db.commit()
    return {"message": "تم إنشاء حساب المدير العام بنجاح"}


# ══════════════════════════════════════════════════════════════════════
# إدارة المستخدمين (للمدير فقط)
# ══════════════════════════════════════════════════════════════════════

from app.core.tenant import get_current_user, require_role


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "user"


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


VALID_ROLES = {"admin", "manager", "accountant", "sales", "purchaser", "cashier", "warehouse", "hr", "viewer", "user", "sales_rep"}


@router.get("/users")
async def list_users(user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    """قائمة مستخدمي الشركة"""
    r = await db.execute(
        select(User).where(User.tenant_id == user["tenant_id"]).order_by(User.created_at.desc())
    )
    users = r.scalars().all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
        }
        for u in users
    ]


@router.post("/users", status_code=201)
async def create_user(
    data: CreateUserRequest,
    user=Depends(require_role(["manager"])),
    _limit=Depends(check_plan_limit("users")),
    db: AsyncSession = Depends(get_db),
):
    """إضافة مستخدم جديد للشركة — مع التحقق من حد الباقة"""
    if data.role not in VALID_ROLES:
        raise HTTPException(400, f"دور غير صالح. الأدوار المتاحة: {', '.join(VALID_ROLES)}")

    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "البريد الإلكتروني مستخدم بالفعل")

    new_user = User(
        id=str(uuid.uuid4()),
        tenant_id=user["tenant_id"],
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
        created_at=datetime.utcnow(),
    )
    db.add(new_user)
    await db.commit()
    return {"message": "تم إنشاء المستخدم", "id": new_user.id}


@router.patch("/users/{user_id}")
async def update_user(user_id: str, data: UpdateUserRequest, current_user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    """تعديل مستخدم"""
    r = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == current_user["tenant_id"])
    )
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "المستخدم غير موجود")

    if data.role and data.role not in VALID_ROLES:
        raise HTTPException(400, f"دور غير صالح")

    if data.full_name is not None:
        u.full_name = data.full_name
    if data.role is not None:
        u.role = data.role
    if data.is_active is not None:
        u.is_active = data.is_active

    await db.commit()
    return {"message": "تم التحديث"}


@router.get("/me")
async def get_me(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """بيانات المستخدم الحالي"""
    r = await db.execute(select(User).where(User.id == user["user_id"]))
    u = r.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "المستخدم غير موجود")
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role,
        "tenant_id": u.tenant_id,
        "is_active": u.is_active,
    }
