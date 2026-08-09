"""
راوتر المشرفين
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.tenant import get_current_user, require_role
from app.modules.supervisor import service

router = APIRouter(prefix="/supervisors", tags=["supervisors"])


# ── إدارة المشرفين (للمدير فقط) ─────────────────────────────────────

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


# ── واجهة المشرف نفسه ───────────────────────────────────────────────

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
