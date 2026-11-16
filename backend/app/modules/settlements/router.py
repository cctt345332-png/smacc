from datetime import datetime, time
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import cast, func, select, Text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import require_role
from app.models.expenses import RepExpense
from app.models.pos import POSCashOutflow, POSSession, POSTerminal
from app.models.reps import SalesRep
from app.models.sales import Invoice, Payment
from app.models.settlements import CustodySettlement
from app.models.user import User

router = APIRouter(prefix="/settlements", tags=["custody-settlements"])
MANAGER_ROLES = ["manager", "accountant"]


def _user_id(user):
    return user.get("user_id") or user.get("id")


def _parse_date(value, end=False):
    if not value:
        return None
    try:
        return datetime.combine(datetime.strptime(str(value), "%Y-%m-%d").date(), time.max if end else time.min)
    except ValueError as exc:
        raise HTTPException(400, "التاريخ يجب أن يكون بصيغة YYYY-MM-DD") from exc


async def _last(db, tenant_id, source_type, source_id, exclude_id=None):
    q = select(CustodySettlement).where(
        CustodySettlement.tenant_id == tenant_id,
        CustodySettlement.source_type == source_type,
        CustodySettlement.source_id == source_id,
    )
    if exclude_id:
        q = q.where(CustodySettlement.id != exclude_id)
    return (await db.execute(q.order_by(CustodySettlement.settled_at.desc()).limit(1))).scalar_one_or_none()


async def _balance(db, tenant_id, source_type, source_id, last, date_from=None, date_to=None):
    since = last.settled_at if last else None
    start = date_from or since
    end = date_to
    if source_type == "rep":
        q = select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.tenant_id == tenant_id, Payment.rep_id == source_id,
            Payment.payment_type == "receipt", Payment.payment_method == "cash",
        )
        if start:
            q = q.where(Payment.payment_date >= start)
        if end:
            q = q.where(Payment.payment_date <= end)
        cash = Decimal(str((await db.execute(q)).scalar() or 0))
        expense_q = select(func.coalesce(func.sum(RepExpense.amount), 0)).where(
            RepExpense.tenant_id == tenant_id, RepExpense.rep_id == source_id,
            RepExpense.status == "approved", RepExpense.payment_method.in_(["cash", "rep_advance"]),
        )
        if start:
            expense_q = expense_q.where(RepExpense.expense_date >= start)
        if end:
            expense_q = expense_q.where(RepExpense.expense_date <= end)
        expenses = Decimal(str((await db.execute(expense_q)).scalar() or 0))
        return cash - expenses

    q = select(func.coalesce(func.sum(POSSession.total_cash + POSSession.opening_cash), 0)).where(
        POSSession.tenant_id == tenant_id, POSSession.terminal_id == source_id,
        cast(POSSession.status, Text) == "closed",
    )
    if start:
        q = q.where(POSSession.closed_at >= start)
    if end:
        q = q.where(POSSession.closed_at <= end)
    sales = Decimal(str((await db.execute(q)).scalar() or 0))
    oq = select(func.coalesce(func.sum(POSCashOutflow.amount), 0)).where(
        POSCashOutflow.tenant_id == tenant_id, POSCashOutflow.terminal_id == source_id,
    )
    if start:
        oq = oq.where(POSCashOutflow.created_at >= start)
    if end:
        oq = oq.where(POSCashOutflow.created_at <= end)
    return sales - Decimal(str((await db.execute(oq)).scalar() or 0))


async def _sources(db, tenant_id, date_from=None, date_to=None):
    reps = (await db.execute(
        select(SalesRep, User).join(User, SalesRep.user_id == User.id).where(
            SalesRep.tenant_id == tenant_id, SalesRep.is_active.is_(True)
        ).order_by(User.full_name)
    )).all()
    terminals = (await db.execute(
        select(POSTerminal).where(POSTerminal.tenant_id == tenant_id, POSTerminal.is_active.is_(True)).order_by(POSTerminal.name)
    )).scalars().all()
    result = []
    for rep, user in reps:
        last = await _last(db, tenant_id, "rep", rep.id)
        balance = await _balance(db, tenant_id, "rep", rep.id, last, date_from, date_to)
        result.append({"source_type": "rep", "source_id": rep.id, "name": user.full_name,
                       "label": f"مندوب — {user.full_name}", "rep_code": rep.rep_code,
                       "last_settled_at": last.settled_at.isoformat() if last else None,
                       "expected_amount": float(balance)})
    for terminal in terminals:
        last = await _last(db, tenant_id, "pos", terminal.id)
        balance = await _balance(db, tenant_id, "pos", terminal.id, last, date_from, date_to)
        result.append({"source_type": "pos", "source_id": terminal.id, "name": terminal.name,
                       "label": f"جهاز POS — {terminal.name}", "last_settled_at": last.settled_at.isoformat() if last else None,
                       "expected_amount": float(balance)})
    return result


async def _source_label(db, tenant_id, source_type, source_id):
    if source_type == "rep":
        row = (await db.execute(select(SalesRep, User).join(User, SalesRep.user_id == User.id).where(
            SalesRep.id == source_id, SalesRep.tenant_id == tenant_id))).first()
        return f"مندوب — {row[1].full_name}" if row else source_id
    terminal = await db.scalar(select(POSTerminal).where(POSTerminal.id == source_id, POSTerminal.tenant_id == tenant_id))
    return f"جهاز POS — {terminal.name}" if terminal else source_id


def _row(row, label):
    return {"id": row.id, "source_type": row.source_type, "source_id": row.source_id, "source_label": label,
            "period_from": row.period_from.isoformat() if row.period_from else None,
            "period_to": row.period_to.isoformat() if row.period_to else None,
            "settled_at": row.settled_at.isoformat(), "expected_amount": float(row.expected_amount),
            "received_amount": float(row.received_amount), "difference": float(row.difference), "notes": row.notes}


@router.get("")
async def list_settlements(user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession = Depends(get_db)):
    tenant_id = user["tenant_id"]
    rows = (await db.execute(select(CustodySettlement).where(
        CustodySettlement.tenant_id == tenant_id
    ).order_by(CustodySettlement.settled_at.desc()).limit(500))).scalars().all()
    labels = {(x["source_type"] + ":" + x["source_id"]): x["label"] for x in await _sources(db, tenant_id)}
    return [_row(row, labels.get(row.source_type + ":" + row.source_id, row.source_id)) for row in rows]


@router.get("/sources")
async def list_sources(date_from: str | None = None, date_to: str | None = None,
                       user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession = Depends(get_db)):
    return await _sources(db, user["tenant_id"], _parse_date(date_from), _parse_date(date_to, True))


@router.get("/report")
async def settlement_report(date_from: str | None = None, date_to: str | None = None,
                            source_id: str | None = None, source_type: str | None = None,
                            user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession = Depends(get_db)):
    tenant_id = user["tenant_id"]
    start, end = _parse_date(date_from), _parse_date(date_to, True)
    q = select(CustodySettlement).where(CustodySettlement.tenant_id == tenant_id)
    if start:
        q = q.where(CustodySettlement.settled_at >= start)
    if end:
        q = q.where(CustodySettlement.settled_at <= end)
    if source_id:
        q = q.where(CustodySettlement.source_id == source_id)
    if source_type in {"rep", "pos"}:
        q = q.where(CustodySettlement.source_type == source_type)
    rows = (await db.execute(q.order_by(CustodySettlement.settled_at.desc()))).scalars().all()
    labels = {}
    output = []
    for row in rows:
        key = row.source_type + ":" + row.source_id
        if key not in labels:
            labels[key] = await _source_label(db, tenant_id, row.source_type, row.source_id)
        output.append(_row(row, labels[key]))
    return {"rows": output, "totals": {
        "expected_amount": sum(x["expected_amount"] for x in output),
        "received_amount": sum(x["received_amount"] for x in output),
        "difference": sum(x["difference"] for x in output),
        "count": len(output),
    }}


async def _get_owned_source(db, tenant_id, source_type, source_id):
    model = SalesRep if source_type == "rep" else POSTerminal
    source = await db.get(model, source_id)
    if not source or source.tenant_id != tenant_id:
        raise HTTPException(404, "العهدة غير موجودة")
    return source


@router.post("", status_code=201)
async def create_settlement(data: dict, user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession = Depends(get_db)):
    tenant_id = user["tenant_id"]
    source_type, source_id = data.get("source_type"), data.get("source_id")
    if source_type not in {"rep", "pos"} or not source_id:
        raise HTTPException(400, "اختر مندوباً أو جهاز POS")
    await _get_owned_source(db, tenant_id, source_type, source_id)
    date_from, date_to = _parse_date(data.get("date_from")), _parse_date(data.get("date_to"), True)
    if date_from and date_to and date_from > date_to:
        raise HTTPException(400, "الفترة غير صحيحة")
    last = await _last(db, tenant_id, source_type, source_id)
    expected = await _balance(db, tenant_id, source_type, source_id, last, date_from, date_to)
    received = Decimal(str(data.get("received_amount") or 0))
    if received < 0:
        raise HTTPException(400, "المبلغ المستلم لا يمكن أن يكون سالباً")
    now = datetime.utcnow()
    row = CustodySettlement(id=str(uuid4()), tenant_id=tenant_id, source_type=source_type, source_id=source_id,
                            period_from=date_from or (last.settled_at if last else None), period_to=date_to,
                            settled_at=now, expected_amount=expected, received_amount=received,
                            difference=received - expected, notes=data.get("notes"), created_by=_user_id(user))
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return _row(row, await _source_label(db, tenant_id, source_type, source_id))


@router.patch("/{settlement_id}")
async def update_settlement(settlement_id: str, data: dict,
                            user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession = Depends(get_db)):
    tenant_id = user["tenant_id"]
    row = await db.scalar(select(CustodySettlement).where(
        CustodySettlement.id == settlement_id, CustodySettlement.tenant_id == tenant_id))
    if not row:
        raise HTTPException(404, "التسوية غير موجودة")
    source_type = data.get("source_type", row.source_type)
    source_id = data.get("source_id", row.source_id)
    if source_type not in {"rep", "pos"}:
        raise HTTPException(400, "نوع العهدة غير صحيح")
    await _get_owned_source(db, tenant_id, source_type, source_id)
    date_from = _parse_date(data["date_from"]) if "date_from" in data and data["date_from"] else row.period_from
    date_to = _parse_date(data["date_to"], True) if "date_to" in data and data["date_to"] else row.period_to
    if date_from and date_to and date_from > date_to:
        raise HTTPException(400, "الفترة غير صحيحة")
    last = await _last(db, tenant_id, source_type, source_id, exclude_id=row.id)
    expected = await _balance(db, tenant_id, source_type, source_id, last, date_from, date_to)
    received = Decimal(str(data.get("received_amount", row.received_amount) or 0))
    if received < 0:
        raise HTTPException(400, "المبلغ المستلم لا يمكن أن يكون سالباً")
    row.source_type, row.source_id = source_type, source_id
    row.period_from, row.period_to = date_from, date_to
    row.expected_amount, row.received_amount = expected, received
    row.difference = received - expected
    if "notes" in data:
        row.notes = data.get("notes")
    await db.commit()
    await db.refresh(row)
    return _row(row, await _source_label(db, tenant_id, source_type, source_id))


@router.delete("/{settlement_id}")
async def delete_settlement(settlement_id: str, user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession = Depends(get_db)):
    row = await db.scalar(select(CustodySettlement).where(
        CustodySettlement.id == settlement_id, CustodySettlement.tenant_id == user["tenant_id"]))
    if not row:
        raise HTTPException(404, "التسوية غير موجودة")
    await db.delete(row)
    await db.commit()
    return {"message": "تم حذف التسوية"}
