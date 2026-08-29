import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.sales_orders import SalesOrder, SalesOrderLine, SalesOrderStatus
from app.models.sales import Customer, Invoice, InvoiceStatus, Payment
from app.models.accounting import Account


async def _next_order_number(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(select(func.count(SalesOrder.id)).where(SalesOrder.tenant_id == tenant_id))
    return f"SO-{str((r.scalar() or 0) + 1).zfill(5)}"


def _calc(qty, price, disc, vat):
    gross = Decimal(str(qty)) * Decimal(str(price))
    disc_amt = gross * Decimal(str(disc)) / 100
    taxable = gross - disc_amt
    vat_amt = taxable * Decimal(str(vat)) / 100
    return taxable, vat_amt, taxable + vat_amt


async def get_orders(db: AsyncSession, tenant_id: str, status: str | None = None):
    q = select(SalesOrder).where(SalesOrder.tenant_id == tenant_id)
    if status:
        q = q.where(SalesOrder.status == status)
    q = q.order_by(SalesOrder.order_date.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def get_order(db: AsyncSession, tenant_id: str, order_id: str):
    o = await db.get(SalesOrder, order_id)
    if not o or o.tenant_id != tenant_id:
        raise HTTPException(404, "Order not found")
    return o


async def create_order(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    order_date = datetime.fromisoformat(data["order_date"]).replace(tzinfo=None)
    delivery_date = datetime.fromisoformat(data["delivery_date"]).replace(tzinfo=None) if data.get("delivery_date") else None

    subtotal = Decimal("0"); vat_total = Decimal("0"); grand_total = Decimal("0")
    order_id = str(uuid.uuid4())
    lines_data = []

    for i, line in enumerate(data.get("lines", [])):
        taxable, vat_amt, tot = _calc(line["quantity"], line["unit_price"], line.get("discount_pct", 0), line.get("vat_rate", 15))
        subtotal += taxable; vat_total += vat_amt; grand_total += tot
        lines_data.append((line, taxable, vat_amt, tot, i))

    order = SalesOrder(
        id=order_id, tenant_id=tenant_id,
        order_number=await _next_order_number(db, tenant_id),
        customer_id=data["customer_id"],
        order_date=order_date, delivery_date=delivery_date,
        quotation_id=data.get("quotation_id"),
        subtotal=subtotal, vat_amount=vat_total, total=grand_total,
        notes=data.get("notes"), delivery_address=data.get("delivery_address"),
        created_by=user_id,
    )
    db.add(order)

    for line, taxable, vat_amt, tot, i in lines_data:
        db.add(SalesOrderLine(
            id=str(uuid.uuid4()), order_id=order_id, line_order=i,
            description_ar=line["description_ar"],
            description_en=line.get("description_en"),
            quantity=Decimal(str(line["quantity"])),
            unit=line.get("unit"),
            unit_price=Decimal(str(line["unit_price"])),
            discount_pct=Decimal(str(line.get("discount_pct", 0))),
            vat_rate=Decimal(str(line.get("vat_rate", 15))),
            subtotal=taxable, vat_amount=vat_amt, total=tot,
        ))

    await db.commit()
    await db.refresh(order)
    return order


async def confirm_order(db: AsyncSession, tenant_id: str, order_id: str):
    order = await get_order(db, tenant_id, order_id)
    if order.status != SalesOrderStatus.DRAFT:
        raise HTTPException(400, "Only draft orders can be confirmed")
    order.status = SalesOrderStatus.CONFIRMED
    await db.commit()
    return order


async def cancel_order(db: AsyncSession, tenant_id: str, order_id: str):
    order = await get_order(db, tenant_id, order_id)
    if order.status in (SalesOrderStatus.INVOICED, SalesOrderStatus.CANCELLED):
        raise HTTPException(400, "Cannot cancel this order")
    order.status = SalesOrderStatus.CANCELLED
    await db.commit()
    return order


async def convert_order_to_invoice(db: AsyncSession, tenant_id: str, user_id: str, order_id: str):
    """تحويل أمر البيع لفاتورة"""
    order = await get_order(db, tenant_id, order_id)
    if order.status not in (SalesOrderStatus.CONFIRMED, SalesOrderStatus.PARTIALLY_DELIVERED, SalesOrderStatus.DELIVERED):
        raise HTTPException(400, "Order must be confirmed before invoicing")

    lines_r = await db.execute(select(SalesOrderLine).where(SalesOrderLine.order_id == order_id))
    lines = lines_r.scalars().all()

    from app.modules.sales.schemas import InvoiceCreate, InvoiceLineCreate
    from app.modules.sales.service import create_invoice

    invoice_data = InvoiceCreate(
        customer_id=order.customer_id,
        issue_date=datetime.utcnow(),
        supply_date=datetime.utcnow(),
        notes=order.notes,
        lines=[InvoiceLineCreate(
            description_ar=l.description_ar,
            description_en=l.description_en,
            quantity=l.quantity,
            unit=l.unit,
            unit_price=l.unit_price,
            discount_pct=l.discount_pct,
            vat_rate=l.vat_rate,
        ) for l in lines],
    )

    invoice = await create_invoice(db, tenant_id, user_id, invoice_data)
    order.status = SalesOrderStatus.INVOICED
    await db.commit()
    return invoice


# ─── Customer Statement ──────────────────────────────────────────────
async def get_customer_statement(db: AsyncSession, tenant_id: str, customer_id: str,
                                  from_date: datetime, to_date: datetime,
                                  account_id: str | None = None):
    """كشف حساب العميل الكامل"""
    from_date = from_date.replace(tzinfo=None)
    to_date = to_date.replace(tzinfo=None)

    # التحقق من العميل
    customer = await db.get(Customer, customer_id)
    if not customer or customer.tenant_id != tenant_id:
        raise HTTPException(404, "Customer not found")
    if account_id:
        account = await db.get(Account, account_id)
        if not account or account.tenant_id != tenant_id or not account.is_active or not account.is_posting:
            raise HTTPException(400, "حساب العميل غير صالح أو غير تابع للشركة")
        if customer.ar_account_id != account_id:
            raise HTTPException(400, "الحساب المختار غير مربوط بهذا العميل")

    # الفواتير
    inv_r = await db.execute(
        select(Invoice).where(
            Invoice.tenant_id == tenant_id,
            Invoice.customer_id == customer_id,
            Invoice.issue_date >= from_date,
            Invoice.issue_date <= to_date,
            Invoice.status.in_([
                InvoiceStatus.CONFIRMED,
                InvoiceStatus.PAID,
                InvoiceStatus.PARTIAL,
                InvoiceStatus.OVERDUE,
            ]),
        ).order_by(Invoice.issue_date)
    )
    invoices = inv_r.scalars().all()

    # المدفوعات
    pay_r = await db.execute(
        select(Payment).where(
            Payment.tenant_id == tenant_id,
            Payment.customer_id == customer_id,
            Payment.payment_date >= from_date,
            Payment.payment_date <= to_date,
        ).order_by(Payment.payment_date)
    )
    payments = pay_r.scalars().all()

    # بناء الحركات مرتبة بالتاريخ
    transactions = []
    for inv in invoices:
        transactions.append({
            "date": inv.issue_date,
            "type": "invoice",
            "reference": inv.invoice_number,
            "description_ar": f"فاتورة مبيعات - {inv.buyer_name_ar}",
            "description_en": f"Sales Invoice - {inv.buyer_name_ar}",
            "debit": float(inv.total),
            "credit": 0,
        })
    for pay in payments:
        transactions.append({
            "date": pay.payment_date,
            "type": "payment",
            "reference": pay.payment_number,
            "description_ar": f"سند قبض - {pay.payment_method}",
            "description_en": f"Payment Receipt - {pay.payment_method}",
            "debit": 0,
            "credit": float(pay.amount),
        })

    # ترتيب بالتاريخ وحساب الرصيد
    transactions.sort(key=lambda x: x["date"])
    balance = 0.0
    for t in transactions:
        balance += t["debit"] - t["credit"]
        t["balance"] = round(balance, 2)
        t["date"] = t["date"].isoformat()

    total_invoiced = sum(float(i.total) for i in invoices)
    total_paid = sum(float(p.amount) for p in payments)

    return {
        "customer": {
            "id": customer.id,
            "customer_number": customer.customer_number,
            "name_ar": customer.name_ar,
            "name_en": customer.name_en,
            "vat_number": customer.vat_number,
            "phone": customer.phone,
            "address_city": customer.address_city,
        },
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "transactions": transactions,
        "summary": {
            "total_invoiced": round(total_invoiced, 2),
            "total_paid": round(total_paid, 2),
            "closing_balance": round(total_invoiced - total_paid, 2),
        }
    }
