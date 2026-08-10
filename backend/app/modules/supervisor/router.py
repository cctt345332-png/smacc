"""
راوتر المشرفين
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.tenant import get_current_user, require_role
from app.modules.supervisor import service

router = APIRouter(prefix="/supervisors", tags=["supervisors"])


# ══════════════════════════════════════════════════════════════════
# واجهة المشرف نفسه — يجب أن تكون قبل /{supervisor_id}
# ══════════════════════════════════════════════════════════════════

@router.post("/me/location", status_code=201)
async def post_my_location(
    data: dict,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """المشرف يرسل موقعه — يُحفظ في rep_locations"""
    from app.models.reps import Supervisor, RepLocation
    from sqlalchemy import select
    import uuid
    from datetime import datetime

    sup_r = await db.execute(
        select(Supervisor).where(
            Supervisor.user_id == user["user_id"],
            Supervisor.tenant_id == user["tenant_id"],
        )
    )
    sup = sup_r.scalar_one_or_none()
    if not sup:
        from fastapi import HTTPException
        raise HTTPException(403, "هذا الحساب ليس مشرفاً")

    loc = RepLocation(
        id=str(uuid.uuid4()),
        tenant_id=user["tenant_id"],
        rep_id=sup.id,
        latitude=data["latitude"],
        longitude=data["longitude"],
        accuracy=data.get("accuracy"),
        speed=data.get("speed"),
        heading=data.get("heading"),
        battery_level=data.get("battery_level"),
        is_moving=data.get("is_moving", False),
        recorded_at=(
            datetime.fromisoformat(data["recorded_at"].replace("Z", "+00:00")).replace(tzinfo=None)
            if data.get("recorded_at") else datetime.utcnow()
        ),
        created_at=datetime.utcnow(),
    )
    db.add(loc)
    await db.commit()
    return {"id": loc.id, "supervisor_id": sup.id, "recorded_at": loc.recorded_at.isoformat()}


@router.get("/me/invoices")
async def my_invoices(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_supervisor_invoices(db, user["tenant_id"], user["user_id"])


@router.get("/me/summary")
async def my_summary(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_supervisor_summary(db, user["tenant_id"], user["user_id"])


@router.get("/me/reps")
async def my_reps(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """المناديب المعيّنون للمشرف"""
    from app.models.reps import Supervisor, SupervisorRep, SalesRep
    from app.models.user import User
    from sqlalchemy import select

    sup = await service.get_supervisor_by_user(db, user["user_id"])
    if not sup:
        from fastapi import HTTPException
        raise HTTPException(403, "هذا الحساب ليس مشرفاً")

    r = await db.execute(
        select(SalesRep, User)
        .join(SupervisorRep, SupervisorRep.rep_id == SalesRep.id)
        .join(User, User.id == SalesRep.user_id)
        .where(SupervisorRep.supervisor_id == sup.id)
    )
    return [
        {
            "id": rep.id, "rep_code": rep.rep_code,
            "full_name": u.full_name, "phone": rep.phone,
            "zone": rep.zone, "is_active": rep.is_active,
        }
        for rep, u in r.all()
    ]


# ══════════════════════════════════════════════════════════════════
# إدارة المشرفين — للمدير فقط — بعد /me/*
# ══════════════════════════════════════════════════════════════════

@router.get("")
async def list_supervisors(
    user=Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_supervisors(db, user["tenant_id"])


@router.post("", status_code=201)
async def create_supervisor(
    data: dict,
    user=Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_supervisor(db, user["tenant_id"], data)


@router.post("/{supervisor_id}/assign-reps")
async def assign_reps(
    supervisor_id: str,
    data: dict,
    user=Depends(require_role(["manager", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """تعيين قائمة مناديب للمشرف — body: {"rep_ids": [...]}"""
    return await service.assign_reps(
        db, user["tenant_id"], supervisor_id, data.get("rep_ids", [])
    )
