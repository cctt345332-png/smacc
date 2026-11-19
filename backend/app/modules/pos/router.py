from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.core.plan_limits import check_plan_limit
from app.modules.pos import service
from app.modules.pos import maintenance_service

router = APIRouter(prefix="/pos", tags=["pos"])


# ─── Terminals ───────────────────────────────────────────────────────

@router.get("/terminals")
async def list_terminals(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_terminals(db, tenant_id)


@router.get("/terminals/my")
async def get_my_terminal(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """جلب الجهاز المخصص للمستخدم الحالي"""
    return await service.get_terminal_by_user(db, user["tenant_id"], user["user_id"])


@router.get("/terminals/{terminal_id}/serials/{product_id}")
async def get_terminal_serials(terminal_id: str, product_id: str, include_main: bool = False, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """قائمة الفرع فقط؛ include_main للاستخدام الداخلي عند مسح سيريال محدد."""
    return await service.get_terminal_serials(db, user["tenant_id"], terminal_id, product_id, include_main=include_main)


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


# ─── صيانة نقاط البيع — مستقلة عن المبيعات والفواتير ───────────────

@router.get("/maintenance")
async def list_pos_maintenance(status: Optional[str] = None, terminal_id: Optional[str] = None, session_id: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await maintenance_service.list_tickets(db, tenant_id, status, terminal_id, session_id)


@router.post("/maintenance", status_code=201)
async def create_pos_maintenance(data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    return await maintenance_service.create_ticket(db, user["tenant_id"], user["user_id"], data)


@router.get("/maintenance/management-report")
async def pos_maintenance_management_report(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    status: Optional[str] = None,
    terminal_id: Optional[str] = None,
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    return await maintenance_service.management_report(
        db, user["tenant_id"], from_date, to_date, status, terminal_id
    )


@router.get("/maintenance/serials")
async def get_terminal_maintenance_serials(terminal_id: str, product_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    """السيريالات المتاحة للصيانة في مستودع الجهاز؛ يجب أن يسبق مسار التذكرة العام."""
    return await maintenance_service.get_terminal_part_serials(db, tenant_id, terminal_id, product_id)


@router.get("/maintenance/{ticket_id}")
async def get_pos_maintenance(ticket_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    ticket = await maintenance_service._ticket(db, tenant_id, ticket_id)
    return await maintenance_service._out(db, tenant_id, ticket)


@router.patch("/maintenance/{ticket_id}")
async def update_pos_maintenance(ticket_id: str, data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    return await maintenance_service.update_ticket(db, user["tenant_id"], ticket_id, data)


@router.post("/maintenance/{ticket_id}/parts", status_code=201)
async def add_pos_maintenance_part(ticket_id: str, data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    return await maintenance_service.add_part(db, user["tenant_id"], ticket_id, data)


@router.post("/maintenance/{ticket_id}/payments", status_code=201)
async def record_pos_maintenance_payment(ticket_id: str, data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    return await maintenance_service.record_payment(db, user["tenant_id"], user["user_id"], ticket_id, data)


@router.post("/maintenance/{ticket_id}/services", status_code=201)
async def add_pos_maintenance_service(ticket_id: str, data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    return await maintenance_service.add_service(db, user["tenant_id"], user["user_id"], ticket_id, data)


@router.get("/maintenance/{ticket_id}/serials/{product_id}")
async def get_pos_maintenance_serials(ticket_id: str, product_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await maintenance_service.get_part_serials(db, tenant_id, ticket_id, product_id)


@router.post("/maintenance/{ticket_id}/parts/{part_id}/issue")
async def issue_pos_maintenance_part(ticket_id: str, part_id: str, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    return await maintenance_service.issue_part(db, user["tenant_id"], user["user_id"], ticket_id, part_id)


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
async def close_session(session_id: str, data: dict, user=Depends(require_role(["manager", "accountant", "cashier"])), db: AsyncSession = Depends(get_db)):
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


@router.post("/sessions/{session_id}/cash-outflows", status_code=201)
async def create_cash_outflow(session_id: str, data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    data = {**data, "session_id": session_id}
    return await service.create_cash_outflow(db, user["tenant_id"], user["user_id"], data)


# ─── Transactions ────────────────────────────────────────────────────

@router.get("/transactions/my-history")
async def my_transaction_history(
    limit: int = 100,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """سجل فواتير المستخدم الحالي فقط، وليس كل فواتير المنشأة."""
    return await service.get_my_transactions(db, user["tenant_id"], user["user_id"], limit)


@router.post("/transactions", status_code=201)
async def create_transaction(data: dict, user=Depends(require_role(["manager","cashier"])), db: AsyncSession = Depends(get_db)):
    return await service.create_transaction(db, user["tenant_id"], user["user_id"], data)


@router.get("/transactions/{tx_id}")
async def get_transaction(tx_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_transaction(db, tenant_id, tx_id)


@router.post("/transactions/{tx_id}/refund")
async def refund_transaction(tx_id: str, user=Depends(require_role(["manager","cashier"])), db: AsyncSession = Depends(get_db)):
    return await service.refund_transaction(db, user["tenant_id"], user["user_id"], tx_id)


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


@router.get("/reports/terminal-performance")
async def pos_terminal_performance_report(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    terminal_id: Optional[str] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """أداء كل جهاز: المبيعات، التكلفة، الربح، ومصروفات درج الكاشير."""
    return await service.get_terminal_performance_report(
        db, tenant_id, from_date, to_date, terminal_id
    )
