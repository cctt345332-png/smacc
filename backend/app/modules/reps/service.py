"""
خدمة المناديب — إنشاء المنديب + مستودعه + فلترة المخزون والمبيعات
"""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.reps import SalesRep
from app.models.user import User
from app.models.inventory import Warehouse, InventoryStock, StockMovement
from app.models.sales import Invoice, Payment


# ─── إنشاء مندوب ─────────────────────────────────────────────────────

async def create_rep(db: AsyncSession, tenant_id: str, data: dict) -> dict:
    """
    إنشاء مندوب جديد:
    1. إنشاء مستخدم بدور sales_rep
    2. إنشاء مستودع خاص بالمندوب
    3. إنشاء سجل SalesRep يربطهما
    """
    from app.core.security import hash_password

    # التحقق من البريد
    existing = await db.execute(select(User).where(User.email == data["email"]))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "البريد الإلكتروني مستخدم بالفعل")

    # إنشاء المستخدم
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id,
        tenant_id=tenant_id,
        email=data["email"],
        hashed_password=hash_password(data["password"]),
        full_name=data["full_name"],
        role="sales_rep",
        created_at=datetime.utcnow(),
    )
    db.add(user)

    # رقم المندوب التسلسلي
    count_r = await db.execute(
        select(func.count(SalesRep.id)).where(SalesRep.tenant_id == tenant_id)
    )
    rep_count = (count_r.scalar() or 0) + 1
    rep_code = f"REP-{str(rep_count).zfill(3)}"

    # إنشاء مستودع خاص بالمندوب
    wh_id = str(uuid.uuid4())
    warehouse = Warehouse(
        id=wh_id,
        tenant_id=tenant_id,
        name_ar=f"مستودع المندوب — {data['full_name']}",
        name_en=f"Rep Warehouse — {data['full_name']}",
        branch_name=rep_code,
        is_default=False,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(warehouse)

    # إنشاء سجل المندوب
    rep_id = str(uuid.uuid4())
    rep = SalesRep(
        id=rep_id,
        tenant_id=tenant_id,
        user_id=user_id,
        warehouse_id=wh_id,
        rep_code=rep_code,
        phone=data.get("phone"),
        zone=data.get("zone"),
        notes=data.get("notes"),
        # بيانات الهوية
        id_number=data.get("id_number"),
        id_expiry=data.get("id_expiry"),
        license_expiry=data.get("license_expiry"),
        # بيانات السيارة
        vehicle_plate=data.get("vehicle_plate"),
        vehicle_type=data.get("vehicle_type"),
        vehicle_color=data.get("vehicle_color"),
        # الأهداف والعمولة
        target_monthly=Decimal(str(data.get("target_monthly", 0))),
        commission_pct=Decimal(str(data.get("commission_pct", 0))),
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(rep)
    await db.commit()

    return {
        "id": rep_id,
        "rep_code": rep_code,
        "user_id": user_id,
        "warehouse_id": wh_id,
        "full_name": data["full_name"],
        "email": data["email"],
        "phone": data.get("phone"),
        "zone": data.get("zone"),
        "id_number": data.get("id_number"),
        "vehicle_plate": data.get("vehicle_plate"),
        "vehicle_type": data.get("vehicle_type"),
        "target_monthly": float(data.get("target_monthly", 0)),
        "commission_pct": float(data.get("commission_pct", 0)),
        "is_active": True,
        "created_at": datetime.utcnow().isoformat(),
    }


# ─── قائمة المناديب ───────────────────────────────────────────────────

async def get_reps(db: AsyncSession, tenant_id: str) -> list:
    r = await db.execute(
        select(SalesRep, User, Warehouse)
        .join(User, SalesRep.user_id == User.id)
        .outerjoin(Warehouse, SalesRep.warehouse_id == Warehouse.id)
        .where(SalesRep.tenant_id == tenant_id)
        .order_by(SalesRep.rep_code)
    )
    rows = r.all()
    result = []
    for rep, user, wh in rows:
        result.append({
            "id": rep.id,
            "rep_code": rep.rep_code,
            "user_id": rep.user_id,
            "warehouse_id": rep.warehouse_id,
            "warehouse_name": wh.name_ar if wh else None,
            "full_name": user.full_name,
            "email": user.email,
            "phone": rep.phone,
            "zone": rep.zone,
            "notes": rep.notes,
            "id_number": rep.id_number,
            "id_expiry": rep.id_expiry.isoformat() if rep.id_expiry else None,
            "license_expiry": rep.license_expiry.isoformat() if rep.license_expiry else None,
            "vehicle_plate": rep.vehicle_plate,
            "vehicle_type": rep.vehicle_type,
            "vehicle_color": rep.vehicle_color,
            "target_monthly": float(rep.target_monthly or 0),
            "commission_pct": float(rep.commission_pct or 0),
            "is_active": rep.is_active,
            "created_at": rep.created_at,
        })
    return result


async def get_rep(db: AsyncSession, tenant_id: str, rep_id: str) -> dict:
    r = await db.execute(
        select(SalesRep, User, Warehouse)
        .join(User, SalesRep.user_id == User.id)
        .outerjoin(Warehouse, SalesRep.warehouse_id == Warehouse.id)
        .where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    row = r.one_or_none()
    if not row:
        raise HTTPException(404, "المندوب غير موجود")
    rep, user, wh = row
    return {
        "id": rep.id,
        "rep_code": rep.rep_code,
        "user_id": rep.user_id,
        "warehouse_id": rep.warehouse_id,
        "warehouse_name": wh.name_ar if wh else None,
        "full_name": user.full_name,
        "email": user.email,
        "phone": rep.phone,
        "zone": rep.zone,
        "notes": rep.notes,
        "id_number": rep.id_number,
        "id_expiry": rep.id_expiry.isoformat() if rep.id_expiry else None,
        "license_expiry": rep.license_expiry.isoformat() if rep.license_expiry else None,
        "vehicle_plate": rep.vehicle_plate,
        "vehicle_type": rep.vehicle_type,
        "vehicle_color": rep.vehicle_color,
        "target_monthly": float(rep.target_monthly or 0),
        "commission_pct": float(rep.commission_pct or 0),
        "is_active": rep.is_active,
        "created_at": rep.created_at,
    }


async def get_rep_by_user(db: AsyncSession, user_id: str) -> SalesRep | None:
    """جلب بيانات المندوب من user_id — يُستخدم في الفلترة"""
    r = await db.execute(select(SalesRep).where(SalesRep.user_id == user_id))
    return r.scalar_one_or_none()


# ─── تحديث مندوب ─────────────────────────────────────────────────────

async def update_rep(db: AsyncSession, tenant_id: str, rep_id: str, data: dict) -> dict:
    r = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    rep = r.scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    if "phone" in data: rep.phone = data["phone"]
    if "zone" in data: rep.zone = data["zone"]
    if "notes" in data: rep.notes = data["notes"]
    if "is_active" in data:
        rep.is_active = data["is_active"]
        u_r = await db.execute(select(User).where(User.id == rep.user_id))
        user = u_r.scalar_one_or_none()
        if user: user.is_active = data["is_active"]
    if "full_name" in data:
        u_r = await db.execute(select(User).where(User.id == rep.user_id))
        user = u_r.scalar_one_or_none()
        if user:
            user.full_name = data["full_name"]
            wh_r = await db.execute(select(Warehouse).where(Warehouse.id == rep.warehouse_id))
            wh = wh_r.scalar_one_or_none()
            if wh: wh.name_ar = f"مستودع المندوب — {data['full_name']}"
    # حقول جديدة
    for field in ["id_number", "id_expiry", "license_expiry",
                  "vehicle_plate", "vehicle_type", "vehicle_color",
                  "target_monthly", "commission_pct"]:
        if field in data:
            setattr(rep, field, data[field])

    await db.commit()
    return await get_rep(db, tenant_id, rep_id)


# ─── مخزون المندوب ────────────────────────────────────────────────────

async def get_rep_stock(db: AsyncSession, tenant_id: str, rep_id: str) -> list:
    """جلب مخزون المندوب من مستودعه الخاص"""
    r = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    rep = r.scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    from app.modules.inventory.service import get_stock_by_warehouse
    return await get_stock_by_warehouse(db, tenant_id, rep.warehouse_id)


async def get_my_stock(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """جلب مخزون المندوب الحالي (من توكنه)"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    from app.modules.inventory.service import get_stock_by_warehouse
    return await get_stock_by_warehouse(db, tenant_id, rep.warehouse_id)


async def get_my_summary(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """ملخص أداء المندوب الحالي — فقط الفواتير المؤكدة/المدفوعة"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    # إجمالي المبيعات — فقط confirmed/paid/partial
    sales_r = await db.execute(
        select(func.sum(Invoice.total), func.count(Invoice.id))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.rep_id == rep.id,
            Invoice.status.in_(["confirmed", "paid", "partial"]),
        )
    )
    total_sales, invoice_count = sales_r.one()

    # المقبوضات
    pay_r = await db.execute(
        select(func.sum(Payment.amount))
        .where(Payment.tenant_id == tenant_id, Payment.rep_id == rep.id)
    )
    total_collected = pay_r.scalar() or Decimal("0")

    # كمية المخزون
    stock_r = await db.execute(
        select(func.sum(InventoryStock.quantity))
        .where(
            InventoryStock.tenant_id == tenant_id,
            InventoryStock.warehouse_id == rep.warehouse_id,
        )
    )
    stock_qty = stock_r.scalar() or Decimal("0")

    return {
        "rep_id": rep.id,
        "total_sales": float(total_sales or 0),
        "invoice_count": invoice_count or 0,
        "total_collected": float(total_collected),
        "outstanding": float((total_sales or 0) - total_collected),
        "stock_qty": float(stock_qty),
        "target_monthly": float(rep.target_monthly or 0),
        "commission_pct": float(rep.commission_pct or 0),
    }



    """جلب مخزون المندوب الحالي (من توكنه)"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    from app.modules.inventory.service import get_stock_by_warehouse
    return await get_stock_by_warehouse(db, tenant_id, rep.warehouse_id)


# ─── فواتير المندوب ───────────────────────────────────────────────────

async def get_rep_invoices(db: AsyncSession, tenant_id: str, rep_id: str) -> list:
    """جلب فواتير مندوب محدد — للمدير"""
    r = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    rep = r.scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    from sqlalchemy.orm import selectinload
    inv_r = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.lines))
        .where(Invoice.tenant_id == tenant_id, Invoice.rep_id == rep_id)
        .order_by(Invoice.created_at.desc())
    )
    return inv_r.scalars().all()


async def get_my_invoices(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """جلب فواتير المندوب الحالي"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    from sqlalchemy.orm import selectinload
    inv_r = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.lines))
        .where(Invoice.tenant_id == tenant_id, Invoice.rep_id == rep.id)
        .order_by(Invoice.created_at.desc())
    )
    return inv_r.scalars().all()


# ─── سندات القبض للمندوب ─────────────────────────────────────────────

async def get_my_payments(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """جلب سندات قبض المندوب الحالي"""
    rep = await get_rep_by_user(db, user_id)
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    pay_r = await db.execute(
        select(Payment)
        .where(Payment.tenant_id == tenant_id, Payment.rep_id == rep.id)
        .order_by(Payment.created_at.desc())
    )
    return pay_r.scalars().all()


# ─── تحويل مخزون للمندوب ─────────────────────────────────────────────

async def allocate_stock_to_rep(
    db: AsyncSession, tenant_id: str, user_id: str,
    rep_id: str, items: list
) -> dict:
    """
    تحميل بضاعة للمندوب:
    items = [{"item_id": "...", "quantity": 10}, ...]
    تنقل من المستودع الرئيسي لمستودع المندوب
    """
    # جلب المندوب
    r = await db.execute(
        select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    rep = r.scalar_one_or_none()
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")

    # جلب المستودع الرئيسي
    wh_r = await db.execute(
        select(Warehouse).where(Warehouse.tenant_id == tenant_id, Warehouse.is_default == True)
    )
    default_wh = wh_r.scalar_one_or_none()
    if not default_wh:
        raise HTTPException(400, "لا يوجد مستودع رئيسي. يرجى تعيين مستودع كافتراضي أولاً")

    from app.modules.inventory.service import transfer_stock

    transferred = []
    for item in items:
        result = await transfer_stock(
            db, tenant_id, user_id,
            item_id=item["item_id"],
            from_warehouse_id=default_wh.id,
            to_warehouse_id=rep.warehouse_id,
            quantity=Decimal(str(item["quantity"])),
            notes=f"تحميل مخزون للمندوب {rep.rep_code}",
        )
        transferred.append({
            "item_id": item["item_id"],
            "quantity": item["quantity"],
            **result,
        })

    return {
        "rep_id": rep_id,
        "rep_code": rep.rep_code,
        "warehouse_id": rep.warehouse_id,
        "transferred": transferred,
    }


# ─── ملخص أداء المندوب ───────────────────────────────────────────────

async def get_rep_summary(db: AsyncSession, tenant_id: str, rep_id: str) -> dict:
    """ملخص أداء المندوب: مبيعات + مخزون + مقبوضات"""
    r = await db.execute(
        select(SalesRep, User, Warehouse)
        .join(User, SalesRep.user_id == User.id)
        .join(Warehouse, SalesRep.warehouse_id == Warehouse.id)
        .where(SalesRep.tenant_id == tenant_id, SalesRep.id == rep_id)
    )
    row = r.one_or_none()
    if not row:
        raise HTTPException(404, "المندوب غير موجود")
    rep, user, wh = row

    # إجمالي المبيعات — فقط الفواتير المؤكدة والمدفوعة
    sales_r = await db.execute(
        select(func.sum(Invoice.total), func.count(Invoice.id))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.rep_id == rep_id,
            Invoice.status.in_(["confirmed", "paid", "partial"]),
        )
    )
    total_sales, invoice_count = sales_r.one()

    # إجمالي المقبوضات
    pay_r = await db.execute(
        select(func.sum(Payment.amount))
        .where(Payment.tenant_id == tenant_id, Payment.rep_id == rep_id)
    )
    total_collected = pay_r.scalar() or Decimal("0")

    # كمية المخزون الحالية
    stock_r = await db.execute(
        select(func.sum(InventoryStock.quantity))
        .where(
            InventoryStock.tenant_id == tenant_id,
            InventoryStock.warehouse_id == rep.warehouse_id,
        )
    )
    stock_qty = stock_r.scalar() or Decimal("0")

    return {
        "rep_id": rep_id,
        "rep_code": rep.rep_code,
        "full_name": user.full_name,
        "zone": rep.zone,
        "warehouse_name": wh.name_ar,
        "total_sales": float(total_sales or 0),
        "invoice_count": invoice_count or 0,
        "total_collected": float(total_collected),
        "outstanding": float((total_sales or 0) - total_collected),
        "stock_qty": float(stock_qty),
    }
