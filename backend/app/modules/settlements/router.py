from datetime import datetime, time
from decimal import Decimal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_, cast, Text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.tenant import require_role
from app.models.settlements import CustodySettlement
from app.models.reps import SalesRep
from app.models.user import User
from app.models.pos import POSTerminal, POSSession, POSCashOutflow
from app.models.sales import Invoice, Payment
from app.models.expenses import RepExpense

router = APIRouter(prefix="/settlements", tags=["custody-settlements"])
MANAGER_ROLES = ["manager", "accountant"]


def _user_id(user):
    return user.get("user_id") or user.get("id")


async def _last(db, tenant_id, source_type, source_id):
    return (await db.execute(select(CustodySettlement).where(
        CustodySettlement.tenant_id == tenant_id,
        CustodySettlement.source_type == source_type,
        CustodySettlement.source_id == source_id,
    ).order_by(CustodySettlement.settled_at.desc()).limit(1))).scalar_one_or_none()


async def _balance(db, tenant_id, source_type, source_id, last, date_from=None, date_to=None):
    since = last.settled_at if last else None
    start = date_from or since
    end = date_to
    if source_type == "rep":
        q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.tenant_id == tenant_id, Payment.rep_id == source_id,
            Payment.payment_type == "receipt",
        )
        if start: q = q.where(Payment.payment_date >= start)
        if end: q = q.where(Payment.payment_date <= end)
        # الإقفال النقدي يخص النقد فقط، مثل حاسبة التسوية؛ البطاقات والتحويلات لا تسلّم نقداً.
        q = q.where(Payment.payment_method == "cash")
        cash = Decimal(str((await db.execute(q)).scalar() or 0))
        expense_q = select(func.coalesce(func.sum(RepExpense.amount), 0)).where(
            RepExpense.tenant_id == tenant_id, RepExpense.rep_id == source_id,
            RepExpense.status == "approved", RepExpense.payment_method.in_(["cash", "rep_advance"]),
        )
        if start: expense_q = expense_q.where(RepExpense.expense_date >= start)
        if end: expense_q = expense_q.where(RepExpense.expense_date <= end)
        expenses = Decimal(str((await db.execute(expense_q)).scalar() or 0))
        return cash - expenses
    q = select(func.coalesce(func.sum(POSSession.total_cash + POSSession.opening_cash), 0)).where(
        POSSession.tenant_id == tenant_id, POSSession.terminal_id == source_id,
        cast(POSSession.status, Text) == "closed",
    )
    if start: q = q.where(POSSession.closed_at >= start)
    if end: q = q.where(POSSession.closed_at <= end)
    sales = Decimal(str((await db.execute(q)).scalar() or 0))
    oq = select(func.coalesce(func.sum(POSCashOutflow.amount), 0)).where(
        POSCashOutflow.tenant_id == tenant_id, POSCashOutflow.terminal_id == source_id,
    )
    if start: oq = oq.where(POSCashOutflow.created_at >= start)
    if end: oq = oq.where(POSCashOutflow.created_at <= end)
    return sales - Decimal(str((await db.execute(oq)).scalar() or 0))


async def _sources(db, tenant_id, date_from=None, date_to=None):
    reps = (await db.execute(select(SalesRep, User).join(User, SalesRep.user_id == User.id).where(SalesRep.tenant_id == tenant_id, SalesRep.is_active == True).order_by(SalesRep.rep_code))).all()
    terminals = (await db.execute(select(POSTerminal).where(POSTerminal.tenant_id == tenant_id, POSTerminal.is_active == True).order_by(POSTerminal.name))).scalars().all()
    result = []
    for r, u in reps:
        last = await _last(db, tenant_id, "rep", r.id)
        bal = await _balance(db, tenant_id, "rep", r.id, last, date_from, date_to)
        result.append({"source_type":"rep","source_id":r.id,"name":u.full_name,"label":f"مندوب — {u.full_name}","rep_code":r.rep_code,"last_settled_at":last.settled_at.isoformat() if last else None,"expected_amount":float(bal)})
    for t in terminals:
        last = await _last(db, tenant_id, "pos", t.id)
        bal = await _balance(db, tenant_id, "pos", t.id, last, date_from, date_to)
        result.append({"source_type":"pos","source_id":t.id,"name":t.name,"label":f"جهاز POS — {t.name}","last_settled_at":last.settled_at.isoformat() if last else None,"expected_amount":float(bal)})
    return result


@router.get("")
async def list_settlements(user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession=Depends(get_db)):
    tenant_id=user["tenant_id"]
    rows=(await db.execute(select(CustodySettlement).where(CustodySettlement.tenant_id==tenant_id).order_by(CustodySettlement.settled_at.desc()).limit(200))).scalars().all()
    names={x["source_type"]+":"+x["source_id"]:x["label"] for x in await _sources(db, tenant_id)}
    return [{"id":x.id,"source_type":x.source_type,"source_id":x.source_id,"source_label":names.get(x.source_type+":"+x.source_id,x.source_id),"period_from":x.period_from.isoformat() if x.period_from else None,"period_to":x.period_to.isoformat() if x.period_to else None,"settled_at":x.settled_at.isoformat(),"expected_amount":float(x.expected_amount),"received_amount":float(x.received_amount),"difference":float(x.difference),"notes":x.notes} for x in rows]


@router.get("/sources")
async def list_sources(date_from: str | None = None, date_to: str | None = None, user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession=Depends(get_db)):
    def parse(value, end=False):
        if not value: return None
        return datetime.combine(datetime.strptime(value, "%Y-%m-%d").date(), time.max if end else time.min)
    return await _sources(db, user["tenant_id"], parse(date_from), parse(date_to, True))


@router.post("", status_code=201)
async def create_settlement(data: dict, user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession=Depends(get_db)):
    tenant_id=user["tenant_id"]; source_type=data.get("source_type"); source_id=data.get("source_id")
    if source_type not in {"rep","pos"} or not source_id: raise HTTPException(400,"اختر مندوباً أو جهاز POS")
    if source_type == "rep": source=await db.get(SalesRep,source_id)
    else: source=await db.get(POSTerminal,source_id)
    if not source or source.tenant_id != tenant_id: raise HTTPException(404,"العهدة غير موجودة")
    def parse(value, end=False):
        if not value: return None
        return datetime.combine(datetime.strptime(value, "%Y-%m-%d").date(), time.max if end else time.min)
    date_from=parse(data.get("date_from")); date_to=parse(data.get("date_to"), True)
    if date_from and date_to and date_from > date_to: raise HTTPException(400,"الفترة غير صحيحة")
    last=await _last(db,tenant_id,source_type,source_id); expected=await _balance(db,tenant_id,source_type,source_id,last,date_from,date_to)
    received=Decimal(str(data.get("received_amount") or 0))
    if received < 0: raise HTTPException(400,"المبلغ المستلم لا يمكن أن يكون سالباً")
    now=datetime.utcnow(); row=CustodySettlement(id=str(uuid4()),tenant_id=tenant_id,source_type=source_type,source_id=source_id,period_from=date_from or (last.settled_at if last else None),period_to=date_to,settled_at=now,expected_amount=expected,received_amount=received,difference=received-expected,notes=data.get("notes"),created_by=_user_id(user))
    db.add(row); await db.commit(); await db.refresh(row)
    return {"id":row.id,"expected_amount":float(expected),"received_amount":float(received),"difference":float(row.difference),"settled_at":now.isoformat()}
