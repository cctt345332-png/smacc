from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.core.plan_limits import check_plan_limit
from app.modules.pos import service

router = APIRouter(prefix="/pos", tags=["pos"])


# ─── Terminals ───────────────────────────────────────────────────────

@router.get("/terminals")
async def list_terminals(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_terminals(db, tenant_id)


@router.get("/terminals/my")
async def get_my_terminal(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """جلب الجهاز المخصص للمستخدم الحالي"""
    return await service.get_terminal_by_user(db, user["tenant_id"], user["user_id"])


@router.post("/terminals", status_code=201)
async def create_terminal(
    data: dict,
    user=Depends(require_role(["manager"])),
    _limit=Depends(check_plan_limit("pos_terminals")),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_terminal(db, user["tenant_id"], data)


@router.patch("/terminals/{terminal_id}")
async def update_terminal(terminal_id: str, data: dict, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await service.update_terminal(db, user["tenant_id"], terminal_id, data)


@router.delete("/terminals/{terminal_id}")
async def delete_terminal(terminal_id: str, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await service.delete_terminal(db, user["tenant_id"], terminal_id)


# ─── Sessions ────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(
    terminal_id: Optional[str] = None,
    limit: int = 50,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_sessions(db, tenant_id, terminal_id, limit)


@router.get("/sessions/active")
async def get_active_session(
    terminal_id: str,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    session = await service.get_active_session(db, tenant_id, terminal_id)
    if not session:
        return None
    return session


@router.post("/sessions/open", status_code=201)
async def open_session(data: dict, user=Depends(require_role(["manager","cashier"])), db: AsyncSession = Depends(get_db)):
    return await service.open_session(db, user["tenant_id"], user["user_id"], data)


@router.post("/sessions/{session_id}/close")
async def close_session(session_id: str, data: dict, user=Depends(require_role(["manager","cashier"])), db: AsyncSession = Depends(get_db)):
    return await service.close_session(db, user["tenant_id"], session_id, data)


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_session_by_id(db, tenant_id, session_id)


@router.get("/sessions/{session_id}/report")
async def session_report(session_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_session_report(db, tenant_id, session_id)


@router.get("/sessions/{session_id}/transactions")
async def session_transactions(session_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_session_transactions(db, tenant_id, session_id)


# ─── Transactions ────────────────────────────────────────────────────

@router.post("/transactions", status_code=201)
async def create_transaction(data: dict, user=Depends(require_role(["manager","cashier"])), db: AsyncSession = Depends(get_db)):
    return await service.create_transaction(db, user["tenant_id"], user["user_id"], data)


@router.get("/transactions/{tx_id}")
async def get_transaction(tx_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_transaction(db, tenant_id, tx_id)


@router.post("/transactions/{tx_id}/refund")
async def refund_transaction(tx_id: str, user=Depends(require_role(["manager","cashier"])), db: AsyncSession = Depends(get_db)):
    return await service.refund_transaction(db, user["tenant_id"], tx_id)


# ─── POS Purchase (شراء من نقطة البيع) ──────────────────────────────

@router.post("/purchase", status_code=201)
async def pos_purchase(data: dict, user=Depends(require_role(["manager","cashier"])), db: AsyncSession = Depends(get_db)):
    """شراء مباشر من POS — للجوالات وقطع الغيار"""
    return await service.pos_purchase(db, user["tenant_id"], user["user_id"], data)


# ── POS Reports ───────────────────────────────────────────────────────

@router.get("/reports/top-items")
async def pos_top_items_report(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    limit: int = 20,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """أفضل الأصناف مبيعاً في POS"""
    return await service.get_top_items_report(db, tenant_id, from_date, to_date, limit)
