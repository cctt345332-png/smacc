from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.expenses import RepExpense
from app.models.pos import POSCashOutflow, POSSession, POSTerminal, POSTransaction
from app.models.pos_maintenance import POSMaintenancePayment
from app.models.purchases import Bill, BillPayment
from app.models.sales import Invoice, InvoiceLine, Payment
from app.models.settlements import CustodySettlement
from app.models.treasury import Voucher
from app.modules.pos.service import get_terminal_performance_report


def _range(date_from: str | None, date_to: str | None) -> tuple[datetime | None, datetime | None]:
    try:
        start = datetime.combine(date.fromisoformat(date_from), time.min) if date_from else None
        end = datetime.combine(date.fromisoformat(date_to) + timedelta(days=1), time.min) if date_to else None
    except ValueError as exc:
        raise ValueError("صيغة التاريخ يجب أن تكون YYYY-MM-DD") from exc
    return start, end


def _money(value) -> float:
    return float(Decimal(str(value or 0)))


def _enum(value) -> str:
    return value.value if hasattr(value, "value") else str(value or "")


async def build_daily_report(
    db: AsyncSession,
    tenant_id: str,
    date_from: str | None,
    date_to: str | None,
    warehouse_id: str | None = None,
    terminal_id: str | None = None,
    rep_id: str | None = None,
) -> dict:
    start, end = _range(date_from, date_to)
    invoice_statuses = ("draft", "rejected", "cancelled")

    # الفواتير العادية فقط؛ فاتورة POS لها نسخة في invoices ونسخة في pos_transactions.
    invoice_q = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.status.notin_(invoice_statuses),
        ~Invoice.notes.ilike("POS:%"),
    )
    if start:
        invoice_q = invoice_q.where(Invoice.issue_date >= start)
    if end:
        invoice_q = invoice_q.where(Invoice.issue_date < end)
    if warehouse_id:
        invoice_q = invoice_q.where(Invoice.warehouse_id == warehouse_id)
    if rep_id:
        invoice_q = invoice_q.where(Invoice.rep_id == rep_id)
    invoices = (await db.execute(invoice_q)).scalars().all()

    invoice_ids = [row.id for row in invoices]
    line_cost = Decimal("0")
    if invoice_ids:
        from app.models.inventory import InventoryItem
        cost_q = await db.execute(
            select(func.coalesce(func.sum(InvoiceLine.quantity * InventoryItem.cost_price), 0))
            .join(InventoryItem, InventoryItem.id == InvoiceLine.inventory_item_id)
            .where(InvoiceLine.invoice_id.in_(invoice_ids))
        )
        line_cost = Decimal(str(cost_q.scalar() or 0))

    # تقرير POS الحالي يحسب التكلفة الفعلية للسيريال والتشغيلة والمتغير والصنف.
    pos_report = {"totals": {}}
    if not rep_id:
        pos_report = await get_terminal_performance_report(
            db, tenant_id, date_from, date_to, terminal_id
        )
        if warehouse_id and not terminal_id:
            allowed_terminal_ids = [
                x.id for x in (await db.execute(
                    select(POSTerminal.id).where(
                        POSTerminal.tenant_id == tenant_id,
                        POSTerminal.warehouse_id == warehouse_id,
                    )
                )).all()
            ]
            pos_report = await get_terminal_performance_report(
                db, tenant_id, date_from, date_to, None
            )
            pos_report["terminals"] = [
                row for row in pos_report.get("terminals", [])
                if row.get("terminal_id") in allowed_terminal_ids
            ]
            totals = pos_report.get("totals", {})
            for key in ("sessions", "transactions", "sales", "cost", "gross_profit", "expenses", "net_profit", "cash", "mada", "credit_card", "stc_pay", "tabby", "tamara", "split_cash", "split_card", "bank_transfer", "other_payment"):
                totals[key] = sum(float(row.get(key, 0) or 0) for row in pos_report["terminals"])
    pos_totals = pos_report.get("totals", {})

    # التحصيل من العملاء، مستقل عن تاريخ الفاتورة.
    payment_q = select(Payment).where(
        Payment.tenant_id == tenant_id,
        Payment.payment_type == "receipt",
        Payment.status != "cancelled",
    )
    if start:
        payment_q = payment_q.where(Payment.payment_date >= start)
    if end:
        payment_q = payment_q.where(Payment.payment_date < end)
    if rep_id:
        payment_q = payment_q.where(Payment.rep_id == rep_id)
    payments = (await db.execute(payment_q)).scalars().all()

    bill_q = select(Bill).where(
        Bill.tenant_id == tenant_id,
        Bill.status.notin_(("draft", "cancelled")),
    )
    if start:
        bill_q = bill_q.where(Bill.bill_date >= start)
    if end:
        bill_q = bill_q.where(Bill.bill_date < end)
    if warehouse_id:
        bill_q = bill_q.where(Bill.warehouse_id == warehouse_id)
    bills = (await db.execute(bill_q)).scalars().all()

    bill_payment_q = select(BillPayment).where(BillPayment.tenant_id == tenant_id)
    if start:
        bill_payment_q = bill_payment_q.where(BillPayment.payment_date >= start)
    if end:
        bill_payment_q = bill_payment_q.where(BillPayment.payment_date < end)
    bill_payments = (await db.execute(bill_payment_q)).scalars().all()

    voucher_q = select(Voucher).where(Voucher.tenant_id == tenant_id, Voucher.status == "posted")
    if start:
        voucher_q = voucher_q.where(Voucher.voucher_date >= start)
    if end:
        voucher_q = voucher_q.where(Voucher.voucher_date < end)
    vouchers = (await db.execute(voucher_q)).scalars().all()

    expense_q = select(RepExpense).where(RepExpense.tenant_id == tenant_id, RepExpense.status == "approved")
    if start:
        expense_q = expense_q.where(RepExpense.expense_date >= start)
    if end:
        expense_q = expense_q.where(RepExpense.expense_date < end)
    if rep_id:
        expense_q = expense_q.where(RepExpense.rep_id == rep_id)
    rep_expenses = (await db.execute(expense_q)).scalars().all()

    settlement_q = select(CustodySettlement).where(CustodySettlement.tenant_id == tenant_id)
    if start:
        settlement_q = settlement_q.where(CustodySettlement.settled_at >= start)
    if end:
        settlement_q = settlement_q.where(CustodySettlement.settled_at < end)
    if terminal_id:
        settlement_q = settlement_q.where(
            CustodySettlement.source_type == "pos",
            CustodySettlement.source_id == terminal_id,
        )
    elif rep_id:
        settlement_q = settlement_q.where(
            CustodySettlement.source_type == "rep",
            CustodySettlement.source_id == rep_id,
        )
    settlements = (await db.execute(settlement_q)).scalars().all()

    maintenance_q = select(POSMaintenancePayment).where(POSMaintenancePayment.tenant_id == tenant_id)
    if start:
        maintenance_q = maintenance_q.where(POSMaintenancePayment.created_at >= start)
    if end:
        maintenance_q = maintenance_q.where(POSMaintenancePayment.created_at < end)
    if terminal_id:
        maintenance_q = maintenance_q.where(
            POSMaintenancePayment.session_id.in_(
                select(POSSession.id).where(POSSession.terminal_id == terminal_id)
            )
        )
    maintenance_payments = (await db.execute(maintenance_q)).scalars().all()

    outflow_q = select(POSCashOutflow).where(POSCashOutflow.tenant_id == tenant_id)
    if start:
        outflow_q = outflow_q.where(POSCashOutflow.created_at >= start)
    if end:
        outflow_q = outflow_q.where(POSCashOutflow.created_at < end)
    if terminal_id:
        outflow_q = outflow_q.where(POSCashOutflow.terminal_id == terminal_id)
    outflows = (await db.execute(outflow_q)).scalars().all()

    sales_total = sum((_money(row.total) for row in invoices), 0.0) + float(pos_totals.get("sales", 0) or 0)
    sales_vat = sum((_money(row.vat_amount) for row in invoices), 0.0) + float(pos_totals.get("total_vat", 0) or 0)
    purchase_total = sum((_money(row.total) for row in bills), 0.0)
    customer_collected = sum((_money(row.amount) for row in payments), 0.0)
    supplier_paid = sum((_money(row.amount) for row in bill_payments), 0.0)
    maintenance_collected = sum((_money(row.amount) for row in maintenance_payments), 0.0)
    rep_expense_total = sum((_money(row.amount) for row in rep_expenses), 0.0)
    cash_outflow_total = sum((_money(row.amount) for row in outflows), 0.0)
    voucher_receipts = sum((_money(row.amount) for row in vouchers if _enum(row.voucher_type) == "receipt"), 0.0)
    voucher_payments = sum((_money(row.amount) for row in vouchers if _enum(row.voucher_type) in {"payment", "expense"}), 0.0)
    gross_profit = float(pos_totals.get("gross_profit", 0) or 0) + (sales_total - float(line_cost))
    operating_expenses = rep_expense_total + cash_outflow_total + voucher_payments
    net_profit = gross_profit - operating_expenses

    by_method: dict[str, float] = {}
    for row in payments:
        method = _enum(row.payment_method)
        by_method[method] = by_method.get(method, 0.0) + _money(row.amount)
    for row in maintenance_payments:
        method = str(row.payment_method or "cash")
        by_method[method] = by_method.get(method, 0.0) + _money(row.amount)
    for key in ("cash", "mada", "credit_card", "stc_pay", "tabby", "tamara", "bank_transfer", "split_cash", "split_card"):
        if pos_totals.get(key):
            by_method[key] = by_method.get(key, 0.0) + float(pos_totals[key])

    return {
        "date_from": date_from,
        "date_to": date_to,
        "filters": {"warehouse_id": warehouse_id, "terminal_id": terminal_id, "rep_id": rep_id},
        "summary": {
            "sales": sales_total,
            "sales_invoices": len(invoices),
            "pos_sales": float(pos_totals.get("sales", 0) or 0),
            "pos_transactions": int(pos_totals.get("transactions", 0) or 0),
            "purchases": purchase_total,
            "purchase_bills": len(bills),
            "customer_collected": customer_collected,
            "supplier_paid": supplier_paid,
            "maintenance_collected": maintenance_collected,
            "expenses": operating_expenses,
            "rep_expenses": rep_expense_total,
            "cash_outflows": cash_outflow_total,
            "voucher_receipts": voucher_receipts,
            "voucher_payments": voucher_payments,
            "gross_profit": gross_profit,
            "net_profit": net_profit,
            "vat": sales_vat,
            "custody_expected": sum((_money(row.expected_amount) for row in settlements), 0.0),
            "custody_received": sum((_money(row.received_amount) for row in settlements), 0.0),
            "custody_difference": sum((_money(row.difference) for row in settlements), 0.0),
            "custody_count": len(settlements),
            "maintenance_count": len(maintenance_payments),
        },
        "payment_methods": by_method,
        "pos": pos_report,
        "details": {
            "invoices": [{"number": row.invoice_number, "date": row.issue_date.isoformat(), "total": _money(row.total)} for row in invoices],
            "bills": [{"number": row.bill_number, "date": row.bill_date.isoformat(), "total": _money(row.total)} for row in bills],
            "payments": [{"number": row.payment_number, "date": row.payment_date.isoformat(), "amount": _money(row.amount), "method": _enum(row.payment_method)} for row in payments],
            "bill_payments": [{"number": row.payment_number, "date": row.payment_date.isoformat(), "amount": _money(row.amount), "method": str(row.payment_method or "")} for row in bill_payments],
            "settlements": [{"source_type": row.source_type, "source_id": row.source_id, "expected": _money(row.expected_amount), "received": _money(row.received_amount), "difference": _money(row.difference)} for row in settlements],
        },
    }
