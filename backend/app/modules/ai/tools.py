"""
AI Tools — دوال يستدعيها الـ AI لجلب بيانات حقيقية من النظام
كل tool ترجع dict جاهز للـ AI يصيغ منه الرد
"""
from __future__ import annotations
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.sales import Invoice, InvoiceStatus, Customer, Payment
from app.models.purchases import PurchaseOrder, Bill
from app.models.inventory import InventoryItem, SerialItem
from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus, Account
from app.models.treasury import Voucher, VoucherType


# ══════════════════════════════════════════════════════════════════════
# تعريف الـ Tools المتاحة للـ AI
# ══════════════════════════════════════════════════════════════════════

TOOLS_DEFINITION = [
    {
        "name": "get_sales_summary",
        "description": "جلب ملخص المبيعات لفترة زمنية. استخدمه عند سؤال عن مبيعات اليوم/الأسبوع/الشهر أو أي فترة.",
        "parameters": {
            "period": "today | yesterday | this_week | last_week | this_month | last_month | this_year | custom",
            "from_date": "YYYY-MM-DD (اختياري، للفترة المخصصة)",
            "to_date": "YYYY-MM-DD (اختياري، للفترة المخصصة)",
        }
    },
    {
        "name": "get_purchases_summary",
        "description": "جلب ملخص المشتريات لفترة زمنية.",
        "parameters": {
            "period": "today | yesterday | this_week | last_week | this_month | last_month | this_year",
        }
    },
    {
        "name": "get_inventory_status",
        "description": "جلب حالة المخزون — الأصناف المنخفضة، القيمة الإجمالية، عدد الأصناف.",
        "parameters": {
            "low_stock_only": "true | false"
        }
    },
    {
        "name": "get_top_customers",
        "description": "جلب أفضل العملاء حسب المبيعات.",
        "parameters": {
            "period": "this_month | last_month | this_year",
            "limit": "عدد العملاء (افتراضي 5)"
        }
    },
    {
        "name": "get_overdue_invoices",
        "description": "جلب الفواتير المتأخرة غير المدفوعة.",
        "parameters": {}
    },
    {
        "name": "get_vat_report",
        "description": "جلب تقرير ضريبة القيمة المضافة لربع سنوي أو فترة محددة.",
        "parameters": {
            "period": "q1 | q2 | q3 | q4 | this_month | custom",
            "year": "السنة (افتراضي السنة الحالية)"
        }
    },
    {
        "name": "get_cash_flow",
        "description": "جلب ملخص التدفق النقدي — المقبوضات والمدفوعات.",
        "parameters": {
            "period": "today | this_week | this_month"
        }
    },
    {
        "name": "get_profit_loss",
        "description": "جلب ملخص الأرباح والخسائر لفترة محددة.",
        "parameters": {
            "period": "this_month | last_month | this_year | custom",
        }
    },
    {
        "name": "navigate",
        "description": "فتح صفحة في النظام. استخدمه عند طلب الذهاب لصفحة أو إنشاء شيء جديد.",
        "parameters": {
            "page": "اسم الصفحة أو الرابط"
        }
    },
    # ── تقارير إضافية ──────────────────────────────────────────────
    {
        "name": "get_pos_summary",
        "description": "ملخص مبيعات نقطة البيع (الكاشير). استخدمه عند السؤال عن مبيعات الكاشير أو POS.",
        "parameters": {"period": "today | this_week | this_month"}
    },
    {
        "name": "get_top_items",
        "description": "أكثر الأصناف مبيعاً. استخدمه عند السؤال عن أفضل المنتجات أو الأصناف الأكثر طلباً.",
        "parameters": {"period": "this_month | last_month | this_year", "limit": "عدد الأصناف (افتراضي 10)"}
    },
    {
        "name": "get_customer_balance",
        "description": "رصيد عميل محدد — إجمالي الفواتير والمدفوع والمتبقي.",
        "parameters": {"customer_name": "اسم العميل أو جزء منه"}
    },
    {
        "name": "get_vendor_balance",
        "description": "رصيد مورد محدد — إجمالي الفواتير والمدفوع والمتبقي.",
        "parameters": {"vendor_name": "اسم المورد أو جزء منه"}
    },
    # ── أنشطة خاصة ─────────────────────────────────────────────────
    {
        "name": "get_expiry_report",
        "description": "تقرير انتهاء الصلاحية للصيدلية — الأدوية المنتهية والقريبة من الانتهاء.",
        "parameters": {"days_ahead": "عدد الأيام للتنبيه المسبق (افتراضي 30)"}
    },
    {
        "name": "get_serial_profit_report",
        "description": "تقرير ربح السيريال للجوالات والإلكترونيات — الربح لكل وحدة مباعة.",
        "parameters": {"period": "today | this_month | this_year"}
    },
    {
        "name": "get_variant_stock",
        "description": "حالة مخزون المتغيرات للملابس — الكميات المتاحة لكل مقاس ولون.",
        "parameters": {"item_name": "اسم الصنف (اختياري للفلترة)"}
    },
]

# خريطة الصفحات للـ navigate tool
PAGES_MAP = {
    # مبيعات
    "فاتورة مبيعات": "/sales/invoices/new",
    "فاتورة مبيعات جديدة": "/sales/invoices/new",
    "فاتورة مبيعات كاملة": "/sales/invoices/new?type=standard",
    "فاتورة مبيعات مبسطة": "/sales/invoices/new?type=simplified",
    "فاتورة مبسطة": "/sales/invoices/new?type=simplified",
    "فاتورة كاملة": "/sales/invoices/new?type=standard",
    "فاتورة جديدة مبيعات": "/sales/invoices/new",
    "invoices/new": "/sales/invoices/new",
    "sales/invoices/new": "/sales/invoices/new",
    "فواتير مبيعات": "/sales/invoices",
    "عرض سعر": "/sales/quotations/new",
    "أمر بيع": "/sales/orders/new",
    "عميل جديد": "/sales/customers/new",
    "عملاء": "/sales/customers",
    "مرتجع مبيعات": "/sales/credit-notes/new",
    # مشتريات
    "فاتورة مشتريات": "/purchases/bills/new",
    "فاتورة مورد": "/purchases/bills/new",
    "bills/new": "/purchases/bills/new",
    "purchases/bills/new": "/purchases/bills/new",
    "أمر شراء": "/purchases/orders/new",
    "مورد جديد": "/purchases/vendors/new",
    "موردون": "/purchases/vendors",
    "مرتجع مشتريات": "/purchases/debit-notes/new",
    # مخزون
    "صنف جديد": "/inventory/items/new",
    "منتج جديد": "/inventory/items/new",
    "مخزون": "/inventory/items",
    "مستودعات": "/inventory/warehouses",
    "جرد": "/inventory/adjustments",
    "حركات المخزون": "/inventory/movements",
    # نقطة البيع
    "كاشير": "/pos/cashier",
    "نقطة البيع": "/pos/cashier",
    "جلسات": "/pos/sessions",
    "أجهزة": "/pos/terminals",
    # محاسبة
    "قيد يومية": "/accounting/journal/new",
    "قيد جديد": "/accounting/journal/new",
    "دليل الحسابات": "/accounting/chart-of-accounts",
    "دفتر الأستاذ": "/accounting/ledger",
    # خزينة
    "سند قبض": "/treasury/receipts/new",
    "سند صرف": "/treasury/payments/new",
    "مصروف": "/treasury/expenses/new",
    "تحويل بنكي": "/treasury/transfers/new",
    # تقارير
    "ميزان مراجعة": "/reports/accounting/trial-balance",
    "ميزانية عمومية": "/reports/accounting/balance-sheet",
    "قائمة دخل": "/reports/accounting/income-statement",
    "تدفق نقدي": "/reports/accounting/cash-flow",
    "تقرير ضريبة": "/reports/accounting/vat",
    "تقرير مبيعات": "/reports/sales",
    "تقرير مشتريات": "/reports/purchases",
    "تقرير مخزون": "/reports/inventory",
    # إعدادات
    "إعدادات الشركة": "/settings/company",
    "إعدادات": "/settings",
    "مستخدمون": "/settings/users",
    # لوحة التحكم
    "لوحة التحكم": "/dashboard",
    "dashboard": "/dashboard",
}


# ══════════════════════════════════════════════════════════════════════
# Helper: تحويل الفترة لتواريخ
# ══════════════════════════════════════════════════════════════════════

def _period_to_dates(period: str, year: int | None = None) -> tuple[datetime, datetime]:
    now = datetime.utcnow()
    y = year or now.year

    # normalize — تحويل القيم العربية والمختلفة لقيم معيارية
    period_map = {
        "امس": "yesterday",
        "أمس": "yesterday",
        "yesterday": "yesterday",
        "الأسبوع الماضي": "last_week",
        "الاسبوع الماضي": "last_week",
        "last_week": "last_week",
        "الأسبوع": "this_week",
        "this_week": "this_week",
        "اليوم": "today",
        "today": "today",
        "هذا الشهر": "this_month",
        "this_month": "this_month",
        "الشهر الماضي": "last_month",
        "last_month": "last_month",
        "هذا العام": "this_year",
        "this_year": "this_year",
    }
    period = period_map.get(period, period)

    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "yesterday":
        yesterday = now - timedelta(days=1)
        start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end = yesterday.replace(hour=23, minute=59, second=59)
    elif period == "this_week":
        start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "last_week":
        # الأسبوع الماضي من الاثنين للأحد
        days_since_monday = now.weekday()
        last_monday = now - timedelta(days=days_since_monday + 7)
        last_sunday = last_monday + timedelta(days=6)
        start = last_monday.replace(hour=0, minute=0, second=0, microsecond=0)
        end = last_sunday.replace(hour=23, minute=59, second=59)
    elif period == "this_month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "last_month":
        first_this = now.replace(day=1)
        last_month_end = first_this - timedelta(days=1)
        start = last_month_end.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = last_month_end.replace(hour=23, minute=59, second=59)
    elif period == "this_year":
        start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now
    elif period == "q1":
        start = datetime(y, 1, 1)
        end = datetime(y, 3, 31, 23, 59, 59)
    elif period == "q2":
        start = datetime(y, 4, 1)
        end = datetime(y, 6, 30, 23, 59, 59)
    elif period == "q3":
        start = datetime(y, 7, 1)
        end = datetime(y, 9, 30, 23, 59, 59)
    elif period == "q4":
        start = datetime(y, 10, 1)
        end = datetime(y, 12, 31, 23, 59, 59)
    else:
        # افتراضي: هذا الشهر
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = now

    return start, end


def _fmt(val) -> str:
    """تنسيق الأرقام"""
    try:
        return f"{float(val):,.2f}"
    except Exception:
        return str(val)


# ══════════════════════════════════════════════════════════════════════
# Tools Implementation
# ══════════════════════════════════════════════════════════════════════

async def get_sales_summary(
    tenant_id: str, db: AsyncSession,
    period: str = "today",
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict:
    if from_date and to_date:
        start = datetime.fromisoformat(from_date)
        end = datetime.fromisoformat(to_date).replace(hour=23, minute=59, second=59)
    else:
        start, end = _period_to_dates(period)

    # إجمالي الفواتير
    r = await db.execute(
        select(
            func.count(Invoice.id).label("count"),
            func.coalesce(func.sum(Invoice.total), 0).label("total"),
            func.coalesce(func.sum(Invoice.vat_amount), 0).label("vat"),
            func.coalesce(func.sum(Invoice.taxable_amount), 0).label("taxable"),
        ).where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= start,
            Invoice.issue_date <= end,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )
    row = r.one()

    # مدفوعة vs غير مدفوعة
    paid_r = await db.execute(
        select(func.count(Invoice.id), func.coalesce(func.sum(Invoice.total), 0))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= start,
            Invoice.issue_date <= end,
            Invoice.status == InvoiceStatus.PAID,
        )
    )
    paid_row = paid_r.one()

    # أعلى 3 عملاء
    top_r = await db.execute(
        select(Invoice.buyer_name_ar, func.sum(Invoice.total).label("total"))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= start,
            Invoice.issue_date <= end,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
        .group_by(Invoice.buyer_name_ar)
        .order_by(func.sum(Invoice.total).desc())
        .limit(3)
    )
    top_customers = [{"name": r[0], "total": _fmt(r[1])} for r in top_r.all()]

    period_label = {
        "today": "اليوم", "yesterday": "أمس", "this_week": "هذا الأسبوع",
        "last_week": "الأسبوع الماضي",
        "this_month": "هذا الشهر", "last_month": "الشهر الماضي", "this_year": "هذا العام",
    }.get(period, period)

    return {
        "tool": "get_sales_summary",
        "period": period_label,
        "from": start.strftime("%Y-%m-%d"),
        "to": end.strftime("%Y-%m-%d"),
        "invoices_count": int(row.count),
        "total_sales": _fmt(row.total),
        "total_vat": _fmt(row.vat),
        "taxable_amount": _fmt(row.taxable),
        "paid_count": int(paid_row[0]),
        "paid_amount": _fmt(paid_row[1]),
        "unpaid_amount": _fmt(float(row.total) - float(paid_row[1])),
        "top_customers": top_customers,
    }


async def get_purchases_summary(
    tenant_id: str, db: AsyncSession,
    period: str = "this_month",
) -> dict:
    start, end = _period_to_dates(period)

    r = await db.execute(
        select(
            func.count(Bill.id).label("count"),
            func.coalesce(func.sum(Bill.total), 0).label("total"),
            func.coalesce(func.sum(Bill.vat_amount), 0).label("vat"),
        ).where(
            Bill.tenant_id == tenant_id,
            Bill.bill_date >= start,
            Bill.bill_date <= end,
        )
    )
    row = r.one()

    period_label = {
        "today": "اليوم", "yesterday": "أمس", "this_week": "هذا الأسبوع",
        "last_week": "الأسبوع الماضي",
        "this_month": "هذا الشهر", "last_month": "الشهر الماضي",
    }.get(period, period)

    return {
        "tool": "get_purchases_summary",
        "period": period_label,
        "bills_count": int(row.count),
        "total_purchases": _fmt(row.total),
        "total_vat": _fmt(row.vat),
    }


async def get_inventory_status(
    tenant_id: str, db: AsyncSession,
    low_stock_only: bool = False,
) -> dict:
    q = select(InventoryItem).where(
        InventoryItem.tenant_id == tenant_id,
        InventoryItem.is_active == True,
    )
    if low_stock_only:
        q = q.where(InventoryItem.quantity_on_hand <= InventoryItem.reorder_point)

    r = await db.execute(q)
    items = r.scalars().all()

    total_value = sum(float(i.quantity_on_hand) * float(i.cost_price) for i in items if i.tracking_type == "quantity")
    low_stock = [i for i in items if i.quantity_on_hand <= i.reorder_point and i.tracking_type == "quantity" and i.reorder_point > 0]

    # سيريالات متاحة
    serials_r = await db.execute(
        select(func.count(SerialItem.id)).join(
            InventoryItem, SerialItem.product_id == InventoryItem.id
        ).where(
            InventoryItem.tenant_id == tenant_id,
            SerialItem.status == "in_stock",
        )
    )
    serials_count = serials_r.scalar() or 0

    low_stock_list = [
        {"name": i.name_ar, "qty": float(i.quantity_on_hand), "reorder": float(i.reorder_point)}
        for i in low_stock[:10]
    ]

    return {
        "tool": "get_inventory_status",
        "total_items": len(items),
        "total_value": _fmt(total_value),
        "low_stock_count": len(low_stock),
        "serials_in_stock": int(serials_count),
        "low_stock_items": low_stock_list,
    }


async def get_top_customers(
    tenant_id: str, db: AsyncSession,
    period: str = "this_month",
    limit: int = 5,
) -> dict:
    start, end = _period_to_dates(period)

    r = await db.execute(
        select(
            Invoice.buyer_name_ar,
            func.count(Invoice.id).label("invoices"),
            func.sum(Invoice.total).label("total"),
        ).where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= start,
            Invoice.issue_date <= end,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
        .group_by(Invoice.buyer_name_ar)
        .order_by(func.sum(Invoice.total).desc())
        .limit(limit)
    )
    rows = r.all()

    period_label = {
        "this_month": "هذا الشهر", "last_month": "الشهر الماضي", "this_year": "هذا العام"
    }.get(period, period)

    return {
        "tool": "get_top_customers",
        "period": period_label,
        "customers": [
            {"rank": i + 1, "name": r[0], "invoices": int(r[1]), "total": _fmt(r[2])}
            for i, r in enumerate(rows)
        ],
    }


async def get_overdue_invoices(tenant_id: str, db: AsyncSession) -> dict:
    now = datetime.utcnow()

    r = await db.execute(
        select(Invoice).where(
            Invoice.tenant_id == tenant_id,
            Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIAL]),
            Invoice.due_date < now,
            Invoice.due_date.isnot(None),
        ).order_by(Invoice.due_date)
    )
    invoices = r.scalars().all()

    total_overdue = sum(float(inv.total) - float(inv.paid_amount) for inv in invoices)

    return {
        "tool": "get_overdue_invoices",
        "count": len(invoices),
        "total_overdue": _fmt(total_overdue),
        "invoices": [
            {
                "number": inv.invoice_number,
                "customer": inv.buyer_name_ar,
                "total": _fmt(inv.total),
                "paid": _fmt(inv.paid_amount),
                "remaining": _fmt(float(inv.total) - float(inv.paid_amount)),
                "due_date": inv.due_date.strftime("%Y-%m-%d") if inv.due_date else "",
                "days_overdue": (now - inv.due_date).days if inv.due_date else 0,
            }
            for inv in invoices[:10]
        ],
    }


async def get_vat_report(
    tenant_id: str, db: AsyncSession,
    period: str = "this_month",
    year: int | None = None,
) -> dict:
    start, end = _period_to_dates(period, year)

    # ضريبة المبيعات (مخرجات)
    sales_r = await db.execute(
        select(
            func.coalesce(func.sum(Invoice.taxable_amount), 0).label("taxable"),
            func.coalesce(func.sum(Invoice.vat_amount), 0).label("vat"),
        ).where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= start,
            Invoice.issue_date <= end,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )
    sales_row = sales_r.one()

    # ضريبة المشتريات (مدخلات)
    purchases_r = await db.execute(
        select(
            func.coalesce(func.sum(Bill.taxable_amount), 0).label("taxable"),
            func.coalesce(func.sum(Bill.vat_amount), 0).label("vat"),
        ).where(
            Bill.tenant_id == tenant_id,
            Bill.bill_date >= start,
            Bill.bill_date <= end,
        )
    )
    purchases_row = purchases_r.one()

    output_vat = float(sales_row.vat)
    input_vat = float(purchases_row.vat)
    net_vat = output_vat - input_vat

    period_label = {
        "q1": "الربع الأول", "q2": "الربع الثاني",
        "q3": "الربع الثالث", "q4": "الربع الرابع",
        "this_month": "هذا الشهر",
    }.get(period, period)

    return {
        "tool": "get_vat_report",
        "period": period_label,
        "from": start.strftime("%Y-%m-%d"),
        "to": end.strftime("%Y-%m-%d"),
        "sales_taxable": _fmt(sales_row.taxable),
        "output_vat": _fmt(output_vat),
        "purchases_taxable": _fmt(purchases_row.taxable),
        "input_vat": _fmt(input_vat),
        "net_vat_due": _fmt(net_vat),
        "status": "مستحق للدفع" if net_vat > 0 else "مسترد",
    }


async def get_cash_flow(
    tenant_id: str, db: AsyncSession,
    period: str = "this_month",
) -> dict:
    start, end = _period_to_dates(period)

    # مقبوضات
    receipts_r = await db.execute(
        select(func.coalesce(func.sum(Voucher.amount), 0)).where(
            Voucher.tenant_id == tenant_id,
            Voucher.voucher_type == VoucherType.RECEIPT,
            Voucher.voucher_date >= start,
            Voucher.voucher_date <= end,
        )
    )
    receipts = float(receipts_r.scalar() or 0)

    # مدفوعات
    payments_r = await db.execute(
        select(func.coalesce(func.sum(Voucher.amount), 0)).where(
            Voucher.tenant_id == tenant_id,
            Voucher.voucher_type == VoucherType.PAYMENT,
            Voucher.voucher_date >= start,
            Voucher.voucher_date <= end,
        )
    )
    payments = float(payments_r.scalar() or 0)

    period_label = {
        "today": "اليوم", "this_week": "هذا الأسبوع", "this_month": "هذا الشهر"
    }.get(period, period)

    return {
        "tool": "get_cash_flow",
        "period": period_label,
        "receipts": _fmt(receipts),
        "payments": _fmt(payments),
        "net_cash": _fmt(receipts - payments),
        "status": "إيجابي" if receipts >= payments else "سلبي",
    }


async def get_profit_loss(
    tenant_id: str, db: AsyncSession,
    period: str = "this_month",
) -> dict:
    start, end = _period_to_dates(period)

    # إيرادات من الفواتير
    revenue_r = await db.execute(
        select(func.coalesce(func.sum(Invoice.taxable_amount), 0)).where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= start,
            Invoice.issue_date <= end,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )
    revenue = float(revenue_r.scalar() or 0)

    # تكلفة المشتريات
    cost_r = await db.execute(
        select(func.coalesce(func.sum(Bill.taxable_amount), 0)).where(
            Bill.tenant_id == tenant_id,
            Bill.bill_date >= start,
            Bill.bill_date <= end,
        )
    )
    cost = float(cost_r.scalar() or 0)

    gross_profit = revenue - cost
    margin = (gross_profit / revenue * 100) if revenue > 0 else 0

    period_label = {
        "this_month": "هذا الشهر", "last_month": "الشهر الماضي", "this_year": "هذا العام"
    }.get(period, period)

    return {
        "tool": "get_profit_loss",
        "period": period_label,
        "revenue": _fmt(revenue),
        "cost": _fmt(cost),
        "gross_profit": _fmt(gross_profit),
        "gross_margin_pct": f"{margin:.1f}%",
        "status": "ربح" if gross_profit >= 0 else "خسارة",
    }


def navigate(page: str) -> dict:
    """يرجع الرابط المناسب للصفحة المطلوبة"""
    page_lower = page.lower().strip()

    # إذا كان رابطاً مباشراً
    if page.startswith("/"):
        for key, url in PAGES_MAP.items():
            if url == page or url.startswith(page):
                return {"tool": "navigate", "url": page, "label": key}
        return {"tool": "navigate", "url": page, "label": page}

    # ── تحقق من نوع الفاتورة أولاً ──────────────────────────────────
    # فاتورة مبسطة
    if any(k in page_lower for k in ["مبسط", "simplified", "b2c", "أفراد", "افراد"]):
        return {"tool": "navigate", "url": "/sales/invoices/new?type=simplified", "label": "فاتورة مبيعات مبسطة"}
    # فاتورة كاملة / B2B
    if any(k in page_lower for k in ["كامل", "standard", "b2b", "شركات"]):
        return {"tool": "navigate", "url": "/sales/invoices/new?type=standard", "label": "فاتورة مبيعات كاملة"}

    # بحث مطابق تام
    for key, url in PAGES_MAP.items():
        if key == page or key.lower() == page_lower:
            return {"tool": "navigate", "url": url, "label": key}

    # بحث جزئي — الأولوية للأطول تطابقاً
    best_match = None
    best_len = 0
    for key, url in PAGES_MAP.items():
        if key.lower() in page_lower or page_lower in key.lower():
            if len(key) > best_len:
                best_match = (key, url)
                best_len = len(key)

    if best_match:
        return {"tool": "navigate", "url": best_match[1], "label": best_match[0]}

    return {"tool": "navigate", "url": "/dashboard", "label": "لوحة التحكم"}


# ══════════════════════════════════════════════════════════════════════
# Tool Executor
# ══════════════════════════════════════════════════════════════════════

async def execute_tool(
    tool_name: str,
    params: dict,
    tenant_id: str,
    db: AsyncSession,
) -> dict:
    """ينفذ الـ tool المطلوب ويرجع النتيجة"""
    try:
        if tool_name == "get_sales_summary":
            return await get_sales_summary(tenant_id, db, **params)
        elif tool_name == "get_purchases_summary":
            return await get_purchases_summary(tenant_id, db, **params)
        elif tool_name == "get_inventory_status":
            low = params.get("low_stock_only", "false")
            return await get_inventory_status(tenant_id, db, low_stock_only=(low == "true" or low is True))
        elif tool_name == "get_top_customers":
            limit = int(params.get("limit", 5))
            return await get_top_customers(tenant_id, db, params.get("period", "this_month"), limit)
        elif tool_name == "get_overdue_invoices":
            return await get_overdue_invoices(tenant_id, db)
        elif tool_name == "get_vat_report":
            year = int(params["year"]) if params.get("year") else None
            return await get_vat_report(tenant_id, db, params.get("period", "this_month"), year)
        elif tool_name == "get_cash_flow":
            return await get_cash_flow(tenant_id, db, params.get("period", "this_month"))
        elif tool_name == "get_profit_loss":
            return await get_profit_loss(tenant_id, db, params.get("period", "this_month"))
        elif tool_name == "navigate":
            return navigate(params.get("page", ""))
        elif tool_name == "get_pos_summary":
            return await get_pos_summary(tenant_id, db, params.get("period", "today"))
        elif tool_name == "get_top_items":
            return await get_top_items(tenant_id, db, params.get("period", "this_month"), int(params.get("limit", 10)))
        elif tool_name == "get_customer_balance":
            return await get_customer_balance(tenant_id, db, params.get("customer_name", ""))
        elif tool_name == "get_vendor_balance":
            return await get_vendor_balance(tenant_id, db, params.get("vendor_name", ""))
        elif tool_name == "get_expiry_report":
            return await get_expiry_report(tenant_id, db, int(params.get("days_ahead", 30)))
        elif tool_name == "get_serial_profit_report":
            return await get_serial_profit_report(tenant_id, db, params.get("period", "this_month"))
        elif tool_name == "get_variant_stock":
            return await get_variant_stock(tenant_id, db, params.get("item_name"))
        else:
            return {"error": f"tool '{tool_name}' غير معروف"}
    except Exception as e:
        return {"error": str(e), "tool": tool_name}


# ══════════════════════════════════════════════════════════════════════
# ب) تقارير إضافية — POS، أصناف، رصيد عميل/مورد
# ══════════════════════════════════════════════════════════════════════

async def get_pos_summary(
    tenant_id: str, db: AsyncSession,
    period: str = "today",
) -> dict:
    """ملخص مبيعات نقطة البيع"""
    from app.models.pos import POSTransaction, POSSession
    start, end = _period_to_dates(period)

    r = await db.execute(
        select(
            func.count(POSTransaction.id).label("count"),
            func.coalesce(func.sum(POSTransaction.total), 0).label("total"),
            func.coalesce(func.sum(POSTransaction.vat_amount), 0).label("vat"),
        ).where(
            POSTransaction.tenant_id == tenant_id,
            POSTransaction.created_at >= start,
            POSTransaction.created_at <= end,
            POSTransaction.status == "completed",
        )
    )
    row = r.one()

    # توزيع طرق الدفع
    methods_r = await db.execute(
        select(POSTransaction.payment_method, func.sum(POSTransaction.total))
        .where(
            POSTransaction.tenant_id == tenant_id,
            POSTransaction.created_at >= start,
            POSTransaction.created_at <= end,
            POSTransaction.status == "completed",
        )
        .group_by(POSTransaction.payment_method)
    )
    by_method = {str(r[0].value if hasattr(r[0], "value") else r[0]): _fmt(r[1]) for r in methods_r.all()}

    period_label = {"today": "اليوم", "this_week": "هذا الأسبوع", "this_month": "هذا الشهر"}.get(period, period)

    return {
        "tool": "get_pos_summary",
        "period": period_label,
        "transactions_count": int(row.count),
        "total_sales": _fmt(row.total),
        "total_vat": _fmt(row.vat),
        "by_payment_method": by_method,
    }


async def get_top_items(
    tenant_id: str, db: AsyncSession,
    period: str = "this_month",
    limit: int = 10,
) -> dict:
    """أكثر الأصناف مبيعاً"""
    from app.models.sales import InvoiceLine, Invoice
    start, end = _period_to_dates(period)

    r = await db.execute(
        select(
            InvoiceLine.description_ar,
            func.sum(InvoiceLine.quantity).label("qty"),
            func.sum(InvoiceLine.total).label("total"),
        )
        .join(Invoice, InvoiceLine.invoice_id == Invoice.id)
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= start,
            Invoice.issue_date <= end,
            Invoice.status != "cancelled",
        )
        .group_by(InvoiceLine.description_ar)
        .order_by(func.sum(InvoiceLine.total).desc())
        .limit(limit)
    )
    rows = r.all()

    period_label = {"this_month": "هذا الشهر", "last_month": "الشهر الماضي", "this_year": "هذا العام"}.get(period, period)

    return {
        "tool": "get_top_items",
        "period": period_label,
        "items": [
            {"rank": i + 1, "name": r[0], "qty": _fmt(r[1]), "total": _fmt(r[2])}
            for i, r in enumerate(rows)
        ],
    }


async def get_customer_balance(
    tenant_id: str, db: AsyncSession,
    customer_name: str,
) -> dict:
    """رصيد عميل محدد"""
    from app.models.sales import Customer, Invoice, Payment, InvoiceStatus

    # البحث عن العميل
    cust_r = await db.execute(
        select(Customer).where(
            Customer.tenant_id == tenant_id,
            Customer.name_ar.ilike(f"%{customer_name}%"),
        ).limit(1)
    )
    customer = cust_r.scalar_one_or_none()
    if not customer:
        return {"tool": "get_customer_balance", "error": f"العميل '{customer_name}' غير موجود"}

    # إجمالي الفواتير
    inv_r = await db.execute(
        select(
            func.coalesce(func.sum(Invoice.total), 0).label("total"),
            func.coalesce(func.sum(Invoice.paid_amount), 0).label("paid"),
        ).where(
            Invoice.tenant_id == tenant_id,
            Invoice.customer_id == customer.id,
            Invoice.status != InvoiceStatus.CANCELLED,
        )
    )
    inv_row = inv_r.one()
    balance = float(inv_row.total) - float(inv_row.paid)

    return {
        "tool": "get_customer_balance",
        "customer": customer.name_ar,
        "customer_number": customer.customer_number,
        "total_invoiced": _fmt(inv_row.total),
        "total_paid": _fmt(inv_row.paid),
        "outstanding_balance": _fmt(balance),
        "status": "مدين" if balance > 0 else "مسدد",
    }


async def get_vendor_balance(
    tenant_id: str, db: AsyncSession,
    vendor_name: str,
) -> dict:
    """رصيد مورد محدد"""
    from app.models.purchases import Vendor, Bill, BillStatus

    vend_r = await db.execute(
        select(Vendor).where(
            Vendor.tenant_id == tenant_id,
            Vendor.name_ar.ilike(f"%{vendor_name}%"),
        ).limit(1)
    )
    vendor = vend_r.scalar_one_or_none()
    if not vendor:
        return {"tool": "get_vendor_balance", "error": f"المورد '{vendor_name}' غير موجود"}

    bill_r = await db.execute(
        select(
            func.coalesce(func.sum(Bill.total), 0).label("total"),
            func.coalesce(func.sum(Bill.paid_amount), 0).label("paid"),
        ).where(
            Bill.tenant_id == tenant_id,
            Bill.vendor_id == vendor.id,
            Bill.status != BillStatus.CANCELLED,
        )
    )
    bill_row = bill_r.one()
    balance = float(bill_row.total) - float(bill_row.paid)

    return {
        "tool": "get_vendor_balance",
        "vendor": vendor.name_ar,
        "vendor_number": vendor.vendor_number,
        "total_billed": _fmt(bill_row.total),
        "total_paid": _fmt(bill_row.paid),
        "outstanding_balance": _fmt(balance),
        "status": "مستحق للمورد" if balance > 0 else "مسدد",
    }


# ══════════════════════════════════════════════════════════════════════
# ج) أنشطة خاصة
# ══════════════════════════════════════════════════════════════════════

async def get_expiry_report(
    tenant_id: str, db: AsyncSession,
    days_ahead: int = 30,
) -> dict:
    """تقرير انتهاء الصلاحية — للصيدلية"""
    from app.models.inventory import BatchItem, InventoryItem
    from datetime import timedelta

    now = datetime.utcnow()
    threshold = now + timedelta(days=days_ahead)

    # منتهية الصلاحية
    expired_r = await db.execute(
        select(BatchItem, InventoryItem.name_ar)
        .join(InventoryItem, BatchItem.product_id == InventoryItem.id)
        .where(
            InventoryItem.tenant_id == tenant_id,
            BatchItem.expiry_date < now,
            BatchItem.quantity > 0,
        )
        .order_by(BatchItem.expiry_date)
        .limit(20)
    )
    expired = expired_r.all()

    # قريبة الانتهاء
    near_r = await db.execute(
        select(BatchItem, InventoryItem.name_ar)
        .join(InventoryItem, BatchItem.product_id == InventoryItem.id)
        .where(
            InventoryItem.tenant_id == tenant_id,
            BatchItem.expiry_date >= now,
            BatchItem.expiry_date <= threshold,
            BatchItem.quantity > 0,
        )
        .order_by(BatchItem.expiry_date)
        .limit(20)
    )
    near = near_r.all()

    return {
        "tool": "get_expiry_report",
        "expired_count": len(expired),
        "near_expiry_count": len(near),
        "days_threshold": days_ahead,
        "expired": [
            {"name": r[1], "batch": r[0].batch_number, "qty": float(r[0].quantity),
             "expiry": r[0].expiry_date.strftime("%Y-%m-%d") if r[0].expiry_date else ""}
            for r in expired
        ],
        "near_expiry": [
            {"name": r[1], "batch": r[0].batch_number, "qty": float(r[0].quantity),
             "expiry": r[0].expiry_date.strftime("%Y-%m-%d") if r[0].expiry_date else "",
             "days_left": (r[0].expiry_date - now).days if r[0].expiry_date else 0}
            for r in near
        ],
    }


async def get_serial_profit_report(
    tenant_id: str, db: AsyncSession,
    period: str = "this_month",
) -> dict:
    """تقرير ربح السيريال — للجوالات والإلكترونيات"""
    from app.models.inventory import SerialItem, InventoryItem
    start, end = _period_to_dates(period)

    r = await db.execute(
        select(
            InventoryItem.name_ar,
            func.count(SerialItem.id).label("count"),
            func.sum(SerialItem.cost_price).label("total_cost"),
            func.sum(SerialItem.sale_price).label("total_revenue"),
        )
        .join(InventoryItem, SerialItem.product_id == InventoryItem.id)
        .where(
            InventoryItem.tenant_id == tenant_id,
            SerialItem.status == "sold",
            SerialItem.sold_at >= start,
            SerialItem.sold_at <= end,
        )
        .group_by(InventoryItem.name_ar)
        .order_by(func.sum(SerialItem.sale_price).desc())
    )
    rows = r.all()

    total_cost = sum(float(r[2] or 0) for r in rows)
    total_revenue = sum(float(r[3] or 0) for r in rows)
    total_profit = total_revenue - total_cost

    period_label = {"today": "اليوم", "this_month": "هذا الشهر", "this_year": "هذا العام"}.get(period, period)

    return {
        "tool": "get_serial_profit_report",
        "period": period_label,
        "total_units_sold": sum(int(r[1]) for r in rows),
        "total_cost": _fmt(total_cost),
        "total_revenue": _fmt(total_revenue),
        "total_profit": _fmt(total_profit),
        "margin_pct": f"{(total_profit / total_revenue * 100):.1f}%" if total_revenue > 0 else "0%",
        "by_product": [
            {
                "name": r[0],
                "units": int(r[1]),
                "cost": _fmt(r[2] or 0),
                "revenue": _fmt(r[3] or 0),
                "profit": _fmt(float(r[3] or 0) - float(r[2] or 0)),
            }
            for r in rows
        ],
    }


async def get_variant_stock(
    tenant_id: str, db: AsyncSession,
    item_name: str | None = None,
) -> dict:
    """حالة مخزون المتغيرات — للملابس"""
    from app.models.inventory import ProductVariant, InventoryItem

    q = select(ProductVariant, InventoryItem.name_ar).join(
        InventoryItem, ProductVariant.product_id == InventoryItem.id
    ).where(
        InventoryItem.tenant_id == tenant_id,
        ProductVariant.is_active == True,
        ProductVariant.quantity > 0,
    )
    if item_name:
        q = q.where(InventoryItem.name_ar.ilike(f"%{item_name}%"))
    q = q.order_by(InventoryItem.name_ar, ProductVariant.size, ProductVariant.color)

    r = await db.execute(q.limit(50))
    rows = r.all()

    # تجميع حسب المنتج
    products: dict = {}
    for variant, name in rows:
        if name not in products:
            products[name] = {"name": name, "variants": [], "total_qty": 0}
        products[name]["variants"].append({
            "size": variant.size or "",
            "color": variant.color or "",
            "qty": float(variant.quantity),
            "price": float(variant.sale_price or 0),
        })
        products[name]["total_qty"] += float(variant.quantity)

    return {
        "tool": "get_variant_stock",
        "filter": item_name or "الكل",
        "products_count": len(products),
        "products": list(products.values())[:10],
    }
