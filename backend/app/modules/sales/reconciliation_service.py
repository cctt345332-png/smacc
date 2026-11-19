import json
from datetime import datetime
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer_reconciliation import CustomerBalanceReconciliation
from app.models.sales import Customer
from app.modules.sales import orders_service


def _dt(value, end=False):
    if isinstance(value, datetime):
        return value.replace(tzinfo=None)
    text = str(value or "").replace("Z", "")
    if len(text) == 10:
        text += "T23:59:59" if end else "T00:00:00"
    return datetime.fromisoformat(text).replace(tzinfo=None)


def _money(value):
    return Decimal(str(value or 0)).quantize(Decimal("0.01"))


def _row(rec, customer=None):
    snap = json.loads(rec.snapshot_json or "{}")
    return {
        "id": rec.id,
        "customer_id": rec.customer_id,
        "customer_name_ar": customer.name_ar if customer else snap.get("customer_name_ar", ""),
        "customer_name_en": customer.name_en if customer else snap.get("customer_name_en", ""),
        "customer_number": customer.customer_number if customer else snap.get("customer_number", ""),
        "rep_id": rec.rep_id,
        "reconciliation_date": rec.reconciliation_date.isoformat(),
        "from_date": rec.from_date.isoformat(),
        "to_date": rec.to_date.isoformat(),
        "system_balance": float(rec.system_balance or 0),
        "acknowledged_balance": float(rec.acknowledged_balance) if rec.acknowledged_balance is not None else None,
        "difference": float(rec.difference) if rec.difference is not None else None,
        "notes": rec.notes or "",
        "status": rec.status,
        "snapshot": snap,
    }


async def list_reconciliations(db, tenant_id, from_date=None, to_date=None, customer_id=None, rep_id=None):
    q = select(CustomerBalanceReconciliation, Customer).join(Customer, Customer.id == CustomerBalanceReconciliation.customer_id).where(
        CustomerBalanceReconciliation.tenant_id == tenant_id
    )
    if customer_id:
        q = q.where(CustomerBalanceReconciliation.customer_id == customer_id)
    if rep_id:
        q = q.where(CustomerBalanceReconciliation.rep_id == rep_id)
    if from_date:
        q = q.where(CustomerBalanceReconciliation.reconciliation_date >= _dt(from_date))
    if to_date:
        q = q.where(CustomerBalanceReconciliation.reconciliation_date <= _dt(to_date, True))
    result = await db.execute(q.order_by(desc(CustomerBalanceReconciliation.reconciliation_date)))
    return [_row(rec, customer) for rec, customer in result.all()]


async def create_reconciliation(db: AsyncSession, tenant_id, user_id, data):
    customer_id = str(data.get("customer_id") or "")
    customer = await db.scalar(select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id))
    if not customer:
        raise HTTPException(404, "العميل غير موجود")
    from_date = _dt(data.get("from_date"))
    to_date = _dt(data.get("to_date"), True)
    if from_date > to_date:
        raise HTTPException(400, "فترة المطابقة غير صحيحة")
    statement = await orders_service.get_customer_statement(db, tenant_id, customer_id, from_date, to_date, data.get("account_id"))
    system_balance = _money(statement["summary"].get("closing_balance"))
    acknowledged = _money(data.get("acknowledged_balance")) if data.get("acknowledged_balance") is not None else None
    snapshot = {
        "customer_name_ar": customer.name_ar,
        "customer_name_en": customer.name_en,
        "customer_number": customer.customer_number,
        "summary": statement["summary"],
        "transactions": statement["transactions"],
    }
    rec = CustomerBalanceReconciliation(
        id=str(uuid4()), tenant_id=tenant_id, customer_id=customer_id,
        rep_id=data.get("rep_id") or customer.rep_id,
        reconciliation_date=_dt(data.get("reconciliation_date")) if data.get("reconciliation_date") else datetime.utcnow(),
        from_date=from_date, to_date=to_date, system_balance=system_balance,
        acknowledged_balance=acknowledged, difference=(acknowledged - system_balance) if acknowledged is not None else None,
        snapshot_json=json.dumps(snapshot, ensure_ascii=False, default=str),
        notes=data.get("notes"), status="confirmed" if acknowledged is not None else "issued", created_by=user_id, updated_at=datetime.utcnow(),
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return _row(rec, customer)


async def update_reconciliation(db: AsyncSession, tenant_id, rec_id, data):
    rec = await db.scalar(select(CustomerBalanceReconciliation).where(CustomerBalanceReconciliation.id == rec_id, CustomerBalanceReconciliation.tenant_id == tenant_id))
    if not rec:
        raise HTTPException(404, "مطابقة الرصيد غير موجودة")
    if "acknowledged_balance" in data:
        if data.get("acknowledged_balance") is None:
            raise HTTPException(400, "أدخل الرصيد الذي أقر به العميل")
        rec.acknowledged_balance = _money(data.get("acknowledged_balance"))
        rec.difference = rec.acknowledged_balance - _money(rec.system_balance)
        rec.status = "confirmed"
    if "notes" in data:
        rec.notes = data.get("notes") or None
    if "reconciliation_date" in data and data.get("reconciliation_date"):
        rec.reconciliation_date = _dt(data["reconciliation_date"])
    rec.updated_at = datetime.utcnow()
    await db.commit()
    customer = await db.scalar(select(Customer).where(Customer.id == rec.customer_id))
    return _row(rec, customer)


async def delete_reconciliation(db: AsyncSession, tenant_id, rec_id):
    rec = await db.scalar(select(CustomerBalanceReconciliation).where(CustomerBalanceReconciliation.id == rec_id, CustomerBalanceReconciliation.tenant_id == tenant_id))
    if not rec:
        raise HTTPException(404, "مطابقة الرصيد غير موجودة")
    await db.delete(rec)
    await db.commit()
    return {"ok": True}
