from datetime import datetime
from decimal import Decimal
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_, cast, Text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.tenant import require_role
from app.models.settlements import CustodySettlement
from app.models.reps import SalesRep
from app.models.pos import POSTerminal, POSSession, POSCashOutflow
from app.models.sales import Invoice

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


async def _balance(db, tenant_id, source_type, source_id, last):
    since = last.settled_at if last else None
    if source_type == "rep":
        q = select(func.coalesce(func.sum(Invoice.paid_amount), 0)).where(
            Invoice.tenant_id == tenant_id, Invoice.rep_id == source_id,
            Invoice.status != "draft", Invoice.status != "cancelled",
        )
        if since: q = q.where(Invoice.created_at > since)
        return Decimal(str((await db.execute(q)).scalar() or 0))
    q = select(func.coalesce(func.sum(POSSession.total_cash + POSSession.opening_cash), 0)).where(
        POSSession.tenant_id == tenant_id, POSSession.terminal_id == source_id,
        cast(POSSession.status, Text) == "closed",
    )
    if since: q = q.where(POSSession.closed_at > since)
    sales = Decimal(str((await db.execute(q)).scalar() or 0))
    oq = select(func.coalesce(func.sum(POSCashOutflow.amount), 0)).where(
        POSCashOutflow.tenant_id == tenant_id, POSCashOutflow.terminal_id == source_id,
    )
    if since: oq = oq.where(POSCashOutflow.created_at > since)
    return sales - Decimal(str((await db.execute(oq)).scalar() or 0))


async def _sources(db, tenant_id):
    reps = (await db.execute(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.is_active == True).order_by(SalesRep.rep_code))).scalars().all()
    terminals = (await db.execute(select(POSTerminal).where(POSTerminal.tenant_id == tenant_id, POSTerminal.is_active == True).order_by(POSTerminal.name))).scalars().all()
    result = []
    for r in reps:
        last = await _last(db, tenant_id, "rep", r.id)
        bal = await _balance(db, tenant_id, "rep", r.id, last)
        result.append({"source_type":"rep","source_id":r.id,"name":r.rep_code,"label":f"مندوب — {r.rep_code}","last_settled_at":last.settled_at.isoformat() if last else None,"expected_amount":float(bal)})
    for t in terminals:
        last = await _last(db, tenant_id, "pos", t.id)
        bal = await _balance(db, tenant_id, "pos", t.id, last)
        result.append({"source_type":"pos","source_id":t.id,"name":t.name,"label":f"جهاز POS — {t.name}","last_settled_at":last.settled_at.isoformat() if last else None,"expected_amount":float(bal)})
    return result


@router.get("")
async def list_settlements(user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession=Depends(get_db)):
    tenant_id=user["tenant_id"]
    rows=(await db.execute(select(CustodySettlement).where(CustodySettlement.tenant_id==tenant_id).order_by(CustodySettlement.settled_at.desc()).limit(200))).scalars().all()
    names={x["source_type"]+":"+x["source_id"]:x["label"] for x in await _sources(db, tenant_id)}
    return [{"id":x.id,"source_type":x.source_type,"source_id":x.source_id,"source_label":names.get(x.source_type+":"+x.source_id,x.source_id),"period_from":x.period_from.isoformat() if x.period_from else None,"settled_at":x.settled_at.isoformat(),"expected_amount":float(x.expected_amount),"received_amount":float(x.received_amount),"difference":float(x.difference),"notes":x.notes} for x in rows]


@router.get("/sources")
async def list_sources(user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession=Depends(get_db)):
    return await _sources(db, user["tenant_id"])


@router.post("", status_code=201)
async def create_settlement(data: dict, user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession=Depends(get_db)):
    tenant_id=user["tenant_id"]; source_type=data.get("source_type"); source_id=data.get("source_id")
    if source_type not in {"rep","pos"} or not source_id: raise HTTPException(400,"اختر مندوباً أو جهاز POS")
    if source_type == "rep": source=await db.get(SalesRep,source_id)
    else: source=await db.get(POSTerminal,source_id)
    if not source or source.tenant_id != tenant_id: raise HTTPException(404,"العهدة غير موجودة")
    last=await _last(db,tenant_id,source_type,source_id); expected=await _balance(db,tenant_id,source_type,source_id,last)
    received=Decimal(str(data.get("received_amount") or 0))
    if received < 0: raise HTTPException(400,"المبلغ المستلم لا يمكن أن يكون سالباً")
    now=datetime.utcnow(); row=CustodySettlement(id=str(uuid4()),tenant_id=tenant_id,source_type=source_type,source_id=source_id,period_from=last.settled_at if last else None,settled_at=now,expected_amount=expected,received_amount=received,difference=received-expected,notes=data.get("notes"),created_by=_user_id(user))
    db.add(row); await db.commit(); await db.refresh(row)
    return {"id":row.id,"expected_amount":float(expected),"received_amount":float(received),"difference":float(row.difference),"settled_at":now.isoformat()}
