"""
خدمة المشرفين — إنشاء + إدارة + ربط بالمناديب
"""
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.reps import Supervisor, SupervisorRep, SalesRep
from app.models.user import User


async def get_supervisor_by_user(db: AsyncSession, user_id: str):
    r = await db.execute(select(Supervisor).where(Supervisor.user_id == user_id))
    return r.scalar_one_or_none()


async def create_supervisor(db: AsyncSession, tenant_id: str, data: dict) -> dict:
    from app.core.security import hash_password

    # تحقق من البريد
    existing = await db.execute(select(User).where(User.email == data["email"]))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "البريد الإلكتروني مستخدم بالفعل")

    # إنشاء المستخدم
    user_id = str(uuid.uuid4())
    user = User(
        id=user_id, tenant_id=tenant_id,
        email=data["email"],
        hashed_password=hash_password(data["password"]),
        full_name=data["name"],
        role="supervisor",
        created_at=datetime.utcnow(),
    )
    db.add(user)

    sup_id = str(uuid.uuid4())
    sup = Supervisor(
        id=sup_id, tenant_id=tenant_id, user_id=user_id,
        name=data["name"], email=data["email"],
        phone=data.get("phone"), is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(sup)
    await db.commit()
    return {"id": sup_id, "name": data["name"], "email": data["email"]}


async def get_supervisors(db: AsyncSession, tenant_id: str) -> list:
    r = await db.execute(
        select(Supervisor, User)
        .join(User, Supervisor.user_id == User.id)
        .where(Supervisor.tenant_id == tenant_id)
        .order_by(Supervisor.created_at)
    )
    result = []
    for sup, user in r.all():
        # جلب مناديبه
        reps_r = await db.execute(
            select(SupervisorRep, SalesRep)
            .join(SalesRep, SupervisorRep.rep_id == SalesRep.id)
            .where(SupervisorRep.supervisor_id == sup.id)
        )
        reps = [{"id": sr.id, "rep_code": sr.rep_code} for _, sr in reps_r.all()]
        result.append({
            "id": sup.id, "name": sup.name, "email": sup.email,
            "phone": sup.phone, "is_active": sup.is_active,
            "reps": reps, "rep_count": len(reps),
        })
    return result


async def assign_reps(db: AsyncSession, tenant_id: str, supervisor_id: str, rep_ids: list) -> dict:
    # تحقق من المشرف
    r = await db.execute(
        select(Supervisor).where(Supervisor.id == supervisor_id, Supervisor.tenant_id == tenant_id)
    )
    sup = r.scalar_one_or_none()
    if not sup:
        raise HTTPException(404, "المشرف غير موجود")

    # احذف القديم
    old_r = await db.execute(
        select(SupervisorRep).where(SupervisorRep.supervisor_id == supervisor_id)
    )
    for old in old_r.scalars().all():
        await db.delete(old)

    # أضف الجديد
    for rep_id in rep_ids:
        db.add(SupervisorRep(
            id=str(uuid.uuid4()),
            supervisor_id=supervisor_id,
            rep_id=rep_id,
            tenant_id=tenant_id,
            created_at=datetime.utcnow(),
        ))
    await db.commit()
    return {"supervisor_id": supervisor_id, "rep_count": len(rep_ids)}


async def get_supervisor_rep_ids(db: AsyncSession, supervisor_id: str) -> list:
    r = await db.execute(
        select(SupervisorRep.rep_id).where(SupervisorRep.supervisor_id == supervisor_id)
    )
    return [row[0] for row in r.all()]


async def get_supervisor_invoices(db: AsyncSession, tenant_id: str, user_id: str) -> list:
    """فواتير مناديب المشرف فقط"""
    sup = await get_supervisor_by_user(db, user_id)
    if not sup:
        raise HTTPException(403, "هذا الحساب ليس مشرفاً")

    rep_ids = await get_supervisor_rep_ids(db, sup.id)
    if not rep_ids:
        return []

    from app.models.sales import Invoice
    from sqlalchemy.orm import selectinload
    r = await db.execute(
        select(Invoice)
        .options(selectinload(Invoice.lines), selectinload(Invoice.payments))
        .where(Invoice.tenant_id == tenant_id, Invoice.rep_id.in_(rep_ids))
        .order_by(Invoice.created_at.desc())
    )
    return r.scalars().all()


async def get_supervisor_summary(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """ملخص أداء مناديب المشرف"""
    sup = await get_supervisor_by_user(db, user_id)
    if not sup:
        raise HTTPException(403, "هذا الحساب ليس مشرفاً")

    rep_ids = await get_supervisor_rep_ids(db, sup.id)

    from app.models.sales import Invoice, Payment
    from app.models.inventory import InventoryStock
    from sqlalchemy import func

    CONFIRMED = ["confirmed", "paid", "partial", "overdue"]

    sales_r = await db.execute(
        select(func.sum(Invoice.total), func.count(Invoice.id))
        .where(Invoice.tenant_id == tenant_id, Invoice.rep_id.in_(rep_ids),
               Invoice.status.in_(CONFIRMED))
    )
    total_sales, invoice_count = sales_r.one()

    pay_r = await db.execute(
        select(func.sum(Payment.amount))
        .where(Payment.tenant_id == tenant_id, Payment.rep_id.in_(rep_ids))
    )
    total_collected = pay_r.scalar() or 0

    return {
        "rep_count": len(rep_ids),
        "total_sales": float(total_sales or 0),
        "total_collected": float(total_collected),
        "outstanding": float((total_sales or 0) - total_collected),
        "invoice_count": invoice_count or 0,
    }
