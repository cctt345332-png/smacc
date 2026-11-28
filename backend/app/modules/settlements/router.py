from datetime import datetime, time
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import cast, func, or_, select, Text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import require_role
from app.models.expenses import RepExpense
from app.models.pos import POSCashOutflow, POSSession, POSTerminal, POSTransaction
from app.models.reps import SalesRep
from app.models.sales import Invoice, Payment
from app.models.settlements import CustodySettlement
from app.models.treasury import Treasury
from app.models.accounting import FiscalYear, FiscalYearStatus
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


def _carryover(last):
    """المبلغ غير المسلّم من آخر تسوية، ولا نرحّل الزيادة للمرة التالية."""
    if not last:
        return Decimal("0")
    return max(Decimal("0"), Decimal(str(last.expected_amount or 0)) - Decimal(str(last.received_amount or 0)))


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

    q = select(POSSession).where(
        POSSession.tenant_id == tenant_id, POSSession.terminal_id == source_id,
        cast(POSSession.status, Text) == "closed",
    )
    if start:
        q = q.where(POSSession.closed_at >= start)
    if end:
        q = q.where(POSSession.closed_at <= end)
    sessions = (await db.execute(q.order_by(POSSession.closed_at.asc()))).scalars().all()
    sales = sum((Decimal(str(s.total_cash or 0)) for s in sessions), Decimal("0"))
    # رصيد الافتتاح عهدة تأسيسية وليس مبيعات. يُحتسب مرة واحدة فقط في أول تسوية.
    opening = Decimal(str(sessions[0].opening_cash or 0)) if sessions and not last else Decimal("0")
    oq = select(func.coalesce(func.sum(POSCashOutflow.amount), 0)).where(
        POSCashOutflow.tenant_id == tenant_id, POSCashOutflow.terminal_id == source_id,
    )
    if start:
        oq = oq.where(POSCashOutflow.created_at >= start)
    if end:
        oq = oq.where(POSCashOutflow.created_at <= end)
    outflows = Decimal(str((await db.execute(oq)).scalar() or 0))
    return sales + opening - outflows


async def _expected_balance(db, tenant_id, source_type, source_id, last, date_from=None, date_to=None):
    activity = await _balance(db, tenant_id, source_type, source_id, last, date_from, date_to)
    carryover = _carryover(last)
    return activity + carryover, activity, carryover


async def _pos_breakdown(db, tenant_id, source_id, last, date_from=None, date_to=None):
    since = last.settled_at if last else None
    start, end = date_from or since, date_to
    q = select(POSSession).where(
        POSSession.tenant_id == tenant_id, POSSession.terminal_id == source_id,
        cast(POSSession.status, Text) == "closed",
    )
    if start: q = q.where(POSSession.closed_at >= start)
    if end: q = q.where(POSSession.closed_at <= end)
    sessions = (await db.execute(q.order_by(POSSession.closed_at.asc()))).scalars().all()
    result = []
    source_transactions = []
    source_outflows = []
    for index, session in enumerate(sessions):
        oq = select(func.coalesce(func.sum(POSCashOutflow.amount), 0)).where(
            POSCashOutflow.tenant_id == tenant_id,
            POSCashOutflow.terminal_id == source_id,
            POSCashOutflow.session_id == session.id,
        )
        outflows = Decimal(str((await db.execute(oq)).scalar() or 0))
        opening = Decimal(str(session.opening_cash or 0)) if index == 0 and not last else Decimal("0")
        result.append({
            "session_id": session.id,
            "opened_at": session.opened_at.isoformat() if session.opened_at else None,
            "closed_at": session.closed_at.isoformat() if session.closed_at else None,
            "cash_sales": float(session.total_cash or 0),
            "opening_cash": float(opening),
            "cash_outflows": float(outflows),
            "expected": float(Decimal(str(session.total_cash or 0)) + opening - outflows),
        })
        outflow_rows = (await db.execute(select(POSCashOutflow).where(
            POSCashOutflow.tenant_id == tenant_id, POSCashOutflow.session_id == session.id,
        ).order_by(POSCashOutflow.created_at.asc()))).scalars().all()
        source_outflows.extend({
            "outflow_id": outflow.id, "date": outflow.created_at.isoformat() if outflow.created_at else None,
            "description": outflow.description or outflow.outflow_type, "amount": float(outflow.amount or 0),
        } for outflow in outflow_rows)
        payment_rows = (await db.execute(select(Payment, Invoice, POSTransaction).join(
            Invoice, Invoice.id == Payment.invoice_id
        ).join(POSTransaction, or_(
            POSTransaction.invoice_id == Invoice.id,
            POSTransaction.transaction_number == Payment.reference,
        )).where(
            Payment.tenant_id == tenant_id, Payment.payment_type == "receipt",
            Payment.payment_method == "cash", Payment.status != "cancelled",
            Invoice.tenant_id == tenant_id, POSTransaction.session_id == session.id,
            POSTransaction.status != "refunded",
        ).order_by(Payment.payment_date.asc(), Payment.payment_number.asc()))).all()
        for payment, invoice, tx in payment_rows:
            source_transactions.append({
                "transaction_id": tx.id, "payment_id": payment.id,
                "transaction_number": tx.transaction_number,
                "invoice_id": invoice.id, "invoice_number": invoice.invoice_number,
                "date": payment.payment_date.isoformat() if payment.payment_date else None,
                "payment_method": "cash", "amount": float(payment.amount or 0),
            })
    return {"sessions": result, "transactions": source_transactions, "outflows": source_outflows}


async def _rep_breakdown(db, tenant_id, source_id, last, date_from=None, date_to=None):
    since = last.settled_at if last else None
    start, end = date_from or since, date_to
    invoices_q = select(Invoice).where(
        Invoice.tenant_id == tenant_id, Invoice.rep_id == source_id,
        Invoice.status.notin_(("draft", "rejected", "cancelled")),
    )
    if start: invoices_q = invoices_q.where(Invoice.issue_date >= start)
    if end: invoices_q = invoices_q.where(Invoice.issue_date <= end)
    invoices = (await db.execute(invoices_q.order_by(Invoice.issue_date.asc(), Invoice.invoice_number.asc()))).scalars().all()
    invoice_details = [{
        "invoice_id": inv.id, "invoice_number": inv.invoice_number,
        "date": inv.issue_date.isoformat() if inv.issue_date else None,
        "amount": float(inv.total or 0), "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
    } for inv in invoices]

    payments_q = select(Payment, Invoice.invoice_number).outerjoin(Invoice, Invoice.id == Payment.invoice_id).where(
        Payment.tenant_id == tenant_id, Payment.rep_id == source_id,
        Payment.payment_type == "receipt", Payment.payment_method == "cash",
        Payment.status != "cancelled",
    )
    if start: payments_q = payments_q.where(Payment.payment_date >= start)
    if end: payments_q = payments_q.where(Payment.payment_date <= end)
    payment_rows = (await db.execute(payments_q.order_by(Payment.payment_date.asc(), Payment.payment_number.asc()))).all()
    receipt_details = [{
        "payment_id": payment.id, "payment_number": payment.payment_number,
        "invoice_number": invoice_number,
        "date": payment.payment_date.isoformat() if payment.payment_date else None,
        "amount": float(payment.amount or 0),
    } for payment, invoice_number in payment_rows]

    expense_q = select(RepExpense).where(
        RepExpense.tenant_id == tenant_id, RepExpense.rep_id == source_id,
        RepExpense.status == "approved", RepExpense.payment_method.in_(["cash", "rep_advance"]),
    )
    if start: expense_q = expense_q.where(RepExpense.expense_date >= start)
    if end: expense_q = expense_q.where(RepExpense.expense_date <= end)
    expenses = (await db.execute(expense_q.order_by(RepExpense.expense_date.asc()))).scalars().all()
    expense_details = [{
        "expense_id": expense.id, "date": expense.expense_date.isoformat() if expense.expense_date else None,
        "description": expense.description, "amount": float(expense.amount or 0),
    } for expense in expenses]
    return {"invoices": invoice_details, "receipts": receipt_details, "expenses": expense_details}


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
        balance, activity, carryover = await _expected_balance(db, tenant_id, "rep", rep.id, last, date_from, date_to)
        result.append({"source_type": "rep", "source_id": rep.id, "name": user.full_name,
                       "label": f"مندوب — {user.full_name}", "rep_code": rep.rep_code,
                       "last_settled_at": last.settled_at.isoformat() if last else None,
                       "expected_amount": float(balance), "period_amount": float(activity),
                       "carried_amount": float(carryover)})
    for terminal in terminals:
        last = await _last(db, tenant_id, "pos", terminal.id)
        balance, activity, carryover = await _expected_balance(db, tenant_id, "pos", terminal.id, last, date_from, date_to)
        source_treasury = None
        if terminal.treasury_id:
            source_treasury = await db.scalar(select(Treasury).where(Treasury.id == terminal.treasury_id, Treasury.tenant_id == tenant_id))
        result.append({"source_type": "pos", "source_id": terminal.id, "name": terminal.name,
                       "label": f"جهاز POS — {terminal.name}", "last_settled_at": last.settled_at.isoformat() if last else None,
                       "expected_amount": float(balance), "period_amount": float(activity),
                       "carried_amount": float(carryover),
                       "treasury_id": terminal.treasury_id, "treasury_name": source_treasury.name_ar if source_treasury else None})
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
            "received_amount": float(row.received_amount), "difference": float(row.difference),
            "source_treasury_id": row.source_treasury_id, "destination_treasury_id": row.destination_treasury_id,
            "transfer_voucher_id": row.transfer_voucher_id, "retained_amount": float(row.retained_amount or 0),
            "notes": row.notes}


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


@router.get("/source-breakdown")
async def source_breakdown(source_type: str, source_id: str, date_from: str | None = None,
                           date_to: str | None = None,
                           user=Depends(require_role(MANAGER_ROLES)), db: AsyncSession = Depends(get_db)):
    tenant_id = user["tenant_id"]
    if source_type not in {"rep", "pos"}:
        raise HTTPException(400, "نوع العهدة غير صحيح")
    await _get_owned_source(db, tenant_id, source_type, source_id)
    start, end = _parse_date(date_from), _parse_date(date_to, True)
    last = await _last(db, tenant_id, source_type, source_id)
    if source_type == "pos":
        details = await _pos_breakdown(db, tenant_id, source_id, last, start, end)
        sessions = details["sessions"]
        return {"source_type": source_type, "source_id": source_id, "rows": sessions,
                "transactions": details["transactions"], "invoices": details["transactions"],
                "receipts": details["transactions"], "expenses": details["outflows"],
                "totals": {"cash_sales": sum(x["cash_sales"] for x in sessions),
                           "opening_cash": sum(x["opening_cash"] for x in sessions),
                           "cash_outflows": sum(x["cash_outflows"] for x in sessions),
                           "expected": sum(x["expected"] for x in sessions),
                           "transaction_cash": sum(x["amount"] for x in details["transactions"])}}
    details = await _rep_breakdown(db, tenant_id, source_id, last, start, end)
    return {"source_type": source_type, "source_id": source_id, "rows": [], **details,
            "totals": {"invoices": sum(x["amount"] for x in details["invoices"]),
                       "receipts": sum(x["amount"] for x in details["receipts"]),
                       "expenses": sum(x["amount"] for x in details["expenses"])}}


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
    expected, _, _ = await _expected_balance(db, tenant_id, source_type, source_id, last, date_from, date_to)
    received = Decimal(str(data.get("received_amount") or 0))
    if received < 0:
        raise HTTPException(400, "المبلغ المستلم لا يمكن أن يكون سالباً")
    now = datetime.utcnow()
    settlement_id = str(uuid4())
    source_treasury_id = None
    destination_treasury_id = None
    transfer_voucher_id = None
    if source_type == "pos" and received > 0:
        terminal = await _get_owned_source(db, tenant_id, "pos", source_id)
        source_treasury_id = terminal.treasury_id
        destination_treasury_id = data.get("destination_treasury_id")
        if not source_treasury_id:
            raise HTTPException(409, "اربط جهاز نقطة البيع بخزينة درج أولاً قبل تحويل مبلغ التسوية")
        if not destination_treasury_id:
            raise HTTPException(400, "حدد الخزينة الرئيسية المستلمة لمبلغ التسوية")
        destination = await db.scalar(select(Treasury).where(Treasury.id == destination_treasury_id, Treasury.tenant_id == tenant_id, Treasury.is_active.is_(True)))
        source = await db.scalar(select(Treasury).where(Treasury.id == source_treasury_id, Treasury.tenant_id == tenant_id, Treasury.is_active.is_(True)))
        if not source or not destination:
            raise HTTPException(400, "خزينة المصدر أو الوجهة غير موجودة أو غير فعالة")
        if source.id == destination.id:
            raise HTTPException(400, "خزينة نقطة البيع والخزينة الرئيسية يجب أن تكونا مختلفتين")
        if not terminal.fiscal_year_id:
            raise HTTPException(409, "حدد السنة المالية لجهاز نقطة البيع قبل تسجيل التحويل")
        fiscal = await db.scalar(select(FiscalYear).where(FiscalYear.id == terminal.fiscal_year_id, FiscalYear.tenant_id == tenant_id, FiscalYear.status == FiscalYearStatus.OPEN))
        if not fiscal:
            raise HTTPException(409, "السنة المالية المرتبطة بجهاز نقطة البيع غير مفتوحة")
        from app.modules.treasury import service as treasury_service
        voucher = await treasury_service.create_voucher(db, tenant_id, _user_id(user), {
            "voucher_type": "transfer", "voucher_date": now.isoformat(), "amount": str(received),
            "payment_method": "cash", "treasury_id": source.id, "to_treasury_id": destination.id,
            "fiscal_year_id": fiscal.id, "description_ar": f"تسوية عهدة {terminal.name} — تحويل نقد إلى {destination.name_ar}",
            "description_en": f"POS custody settlement transfer — {terminal.name}",
            "reference": settlement_id, "notes": data.get("notes"),
        })
        posted = await treasury_service.post_voucher(db, tenant_id, _user_id(user), voucher.id)
        transfer_voucher_id = posted.id
    retained = max(Decimal("0"), expected - received)
    row = CustodySettlement(id=settlement_id, tenant_id=tenant_id, source_type=source_type, source_id=source_id,
                            period_from=date_from or (last.settled_at if last else None), period_to=date_to,
                            settled_at=now, expected_amount=expected, received_amount=received,
                            difference=received - expected, source_treasury_id=source_treasury_id,
                            destination_treasury_id=destination_treasury_id, transfer_voucher_id=transfer_voucher_id,
                            retained_amount=retained, notes=data.get("notes"), created_by=_user_id(user))
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
    if row.transfer_voucher_id:
        raise HTTPException(409, "لا يمكن تعديل تسوية حوّلت مبلغًا فعليًا؛ استخدم تسوية عكسية معتمدة")
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
    expected, _, _ = await _expected_balance(db, tenant_id, source_type, source_id, last, date_from, date_to)
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
    if row.transfer_voucher_id:
        raise HTTPException(409, "لا يمكن حذف تسوية مرتبطة بتحويل خزينة فعلي")
    await db.delete(row)
    await db.commit()
    return {"message": "تم حذف التسوية"}
