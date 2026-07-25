"""
تقرير ضريبة القيمة المضافة الفعلي
يحسب من فواتير المبيعات والمشتريات الفعلية
"""
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_


async def get_vat_report(db: AsyncSession, tenant_id: str, from_date: datetime, to_date: datetime):
    from_date = from_date.replace(tzinfo=None)
    to_date = to_date.replace(tzinfo=None)

    from app.models.sales import Invoice, InvoiceStatus

    # ── مبيعات المخرجات (Output VAT) ──────────────────────────────
    inv_r = await db.execute(
        select(Invoice).where(
            Invoice.tenant_id == tenant_id,
            Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PAID, InvoiceStatus.PARTIAL]),
            Invoice.issue_date >= from_date,
            Invoice.issue_date <= to_date,
        )
    )
    invoices = inv_r.scalars().all()

    # تجميع حسب نسبة الضريبة
    standard_sales = Decimal("0")    # مبيعات خاضعة 15%
    standard_vat_out = Decimal("0")  # ضريبة المخرجات
    zero_sales = Decimal("0")        # مبيعات صفرية
    exempt_sales = Decimal("0")      # مبيعات معفاة

    for inv in invoices:
        # نحتاج الأسطر لتصنيف الضريبة
        from sqlalchemy.orm import selectinload
        inv_with_lines = await db.execute(
            select(Invoice).options(selectinload(Invoice.lines)).where(Invoice.id == inv.id)
        )
        inv_full = inv_with_lines.scalar_one_or_none()
        if not inv_full:
            continue

        for line in inv_full.lines:
            if line.vat_category == "S":  # Standard 15%
                standard_sales += line.subtotal
                standard_vat_out += line.vat_amount
            elif line.vat_category == "Z":  # Zero rated
                zero_sales += line.subtotal
            elif line.vat_category == "E":  # Exempt
                exempt_sales += line.subtotal

    total_sales = standard_sales + zero_sales + exempt_sales

    # ── مشتريات المدخلات (Input VAT) ──────────────────────────────
    from app.models.purchases import Bill, BillStatus, BillLine
    from sqlalchemy.orm import selectinload as sil

    bill_r = await db.execute(
        select(Bill).options(sil(Bill.lines)).where(
            Bill.tenant_id == tenant_id,
            Bill.status.in_([BillStatus.CONFIRMED, BillStatus.PAID, BillStatus.PARTIAL]),
            Bill.bill_date >= from_date,
            Bill.bill_date <= to_date,
        )
    )
    bills = bill_r.scalars().all()

    standard_purchases = Decimal("0")
    standard_vat_in = Decimal("0")

    for bill in bills:
        for line in bill.lines:
            if line.vat_category == "S":
                standard_purchases += line.subtotal
                standard_vat_in += line.vat_amount

    # ── الضريبة الصافية ────────────────────────────────────────────
    net_vat = standard_vat_out - standard_vat_in

    return {
        "period": {
            "from_date": from_date.isoformat(),
            "to_date": to_date.isoformat(),
        },
        "output_vat": {
            "standard_rated_sales": float(standard_sales),
            "standard_vat_amount": float(standard_vat_out),
            "zero_rated_sales": float(zero_sales),
            "exempt_sales": float(exempt_sales),
            "total_sales": float(total_sales),
        },
        "input_vat": {
            "standard_rated_purchases": float(standard_purchases),
            "standard_vat_amount": float(standard_vat_in),
        },
        "summary": {
            "output_vat": float(standard_vat_out),
            "input_vat": float(standard_vat_in),
            "net_vat_payable": float(net_vat),
            "invoice_count": len(invoices),
        }
    }
