"""
AI Creation Tools — أدوات الإنشاء
يستدعيها الـ AI لإنشاء بيانات حقيقية في النظام
"""
from __future__ import annotations
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.accounting import Account, AccountType, AccountNature, FiscalYear
from app.modules.accounting.schemas import AccountCreate, FiscalYearCreate
from app.modules.accounting.service import create_account, create_fiscal_year


# ══════════════════════════════════════════════════════════════════════
# أ) دليل الحسابات السعودي القياسي
# ══════════════════════════════════════════════════════════════════════

# دليل الحسابات السعودي القياسي — هيكل كامل
SAUDI_COA = [
    # ── 1. الأصول ──────────────────────────────────────────────────
    {"code": "1",    "name_ar": "الأصول",                    "name_en": "Assets",                    "type": "asset",     "nature": "debit",  "parent": None,  "posting": False},
    {"code": "11",   "name_ar": "الأصول المتداولة",          "name_en": "Current Assets",            "type": "asset",     "nature": "debit",  "parent": "1",   "posting": False},
    {"code": "111",  "name_ar": "النقدية وما يعادلها",       "name_en": "Cash & Equivalents",        "type": "asset",     "nature": "debit",  "parent": "11",  "posting": False},
    {"code": "1111", "name_ar": "الصندوق",                   "name_en": "Cash on Hand",              "type": "asset",     "nature": "debit",  "parent": "111", "posting": True},
    {"code": "1112", "name_ar": "البنك الرئيسي",             "name_en": "Main Bank Account",         "type": "asset",     "nature": "debit",  "parent": "111", "posting": True},
    {"code": "112",  "name_ar": "حسابات القبض",              "name_en": "Accounts Receivable",       "type": "asset",     "nature": "debit",  "parent": "11",  "posting": False},
    {"code": "1121", "name_ar": "ذمم العملاء",               "name_en": "Trade Receivables",         "type": "asset",     "nature": "debit",  "parent": "112", "posting": True},
    {"code": "1122", "name_ar": "أوراق القبض",               "name_en": "Notes Receivable",          "type": "asset",     "nature": "debit",  "parent": "112", "posting": True},
    {"code": "113",  "name_ar": "المخزون",                   "name_en": "Inventory",                 "type": "asset",     "nature": "debit",  "parent": "11",  "posting": False},
    {"code": "1131", "name_ar": "مخزون البضاعة",             "name_en": "Merchandise Inventory",     "type": "asset",     "nature": "debit",  "parent": "113", "posting": True},
    {"code": "114",  "name_ar": "المصروفات المدفوعة مقدماً", "name_en": "Prepaid Expenses",          "type": "asset",     "nature": "debit",  "parent": "11",  "posting": True},
    {"code": "115",  "name_ar": "ضريبة القيمة المضافة المدخلات","name_en": "VAT Input",             "type": "asset",     "nature": "debit",  "parent": "11",  "posting": True},
    {"code": "12",   "name_ar": "الأصول غير المتداولة",      "name_en": "Non-Current Assets",        "type": "asset",     "nature": "debit",  "parent": "1",   "posting": False},
    {"code": "121",  "name_ar": "الأصول الثابتة",            "name_en": "Fixed Assets",              "type": "asset",     "nature": "debit",  "parent": "12",  "posting": False},
    {"code": "1211", "name_ar": "الأثاث والمعدات",           "name_en": "Furniture & Equipment",     "type": "asset",     "nature": "debit",  "parent": "121", "posting": True},
    {"code": "1212", "name_ar": "أجهزة الحاسب",              "name_en": "Computer Equipment",        "type": "asset",     "nature": "debit",  "parent": "121", "posting": True},
    {"code": "1213", "name_ar": "السيارات",                  "name_en": "Vehicles",                  "type": "asset",     "nature": "debit",  "parent": "121", "posting": True},
    {"code": "1219", "name_ar": "مجمع استهلاك الأصول",       "name_en": "Accumulated Depreciation",  "type": "asset",     "nature": "credit", "parent": "121", "posting": True},
    # ── 2. الالتزامات ──────────────────────────────────────────────
    {"code": "2",    "name_ar": "الالتزامات",                "name_en": "Liabilities",               "type": "liability", "nature": "credit", "parent": None,  "posting": False},
    {"code": "21",   "name_ar": "الالتزامات المتداولة",      "name_en": "Current Liabilities",       "type": "liability", "nature": "credit", "parent": "2",   "posting": False},
    {"code": "211",  "name_ar": "حسابات الدفع",              "name_en": "Accounts Payable",          "type": "liability", "nature": "credit", "parent": "21",  "posting": False},
    {"code": "2111", "name_ar": "ذمم الموردين",              "name_en": "Trade Payables",            "type": "liability", "nature": "credit", "parent": "211", "posting": True},
    {"code": "2112", "name_ar": "أوراق الدفع",               "name_en": "Notes Payable",             "type": "liability", "nature": "credit", "parent": "211", "posting": True},
    {"code": "212",  "name_ar": "ضريبة القيمة المضافة المخرجات","name_en": "VAT Output",            "type": "liability", "nature": "credit", "parent": "21",  "posting": True},
    {"code": "213",  "name_ar": "الرواتب المستحقة",          "name_en": "Accrued Salaries",          "type": "liability", "nature": "credit", "parent": "21",  "posting": True},
    {"code": "214",  "name_ar": "الإيرادات المقدمة",         "name_en": "Deferred Revenue",          "type": "liability", "nature": "credit", "parent": "21",  "posting": True},
    {"code": "22",   "name_ar": "الالتزامات طويلة الأجل",    "name_en": "Long-term Liabilities",     "type": "liability", "nature": "credit", "parent": "2",   "posting": False},
    {"code": "221",  "name_ar": "القروض طويلة الأجل",        "name_en": "Long-term Loans",           "type": "liability", "nature": "credit", "parent": "22",  "posting": True},
    # ── 3. حقوق الملكية ────────────────────────────────────────────
    {"code": "3",    "name_ar": "حقوق الملكية",              "name_en": "Equity",                    "type": "equity",    "nature": "credit", "parent": None,  "posting": False},
    {"code": "31",   "name_ar": "رأس المال",                 "name_en": "Capital",                   "type": "equity",    "nature": "credit", "parent": "3",   "posting": True},
    {"code": "32",   "name_ar": "الأرباح المحتجزة",          "name_en": "Retained Earnings",         "type": "equity",    "nature": "credit", "parent": "3",   "posting": True},
    {"code": "33",   "name_ar": "الأرباح والخسائر",          "name_en": "Profit & Loss",             "type": "equity",    "nature": "credit", "parent": "3",   "posting": True},
    # ── 4. الإيرادات ───────────────────────────────────────────────
    {"code": "4",    "name_ar": "الإيرادات",                 "name_en": "Revenue",                   "type": "revenue",   "nature": "credit", "parent": None,  "posting": False},
    {"code": "41",   "name_ar": "إيرادات المبيعات",          "name_en": "Sales Revenue",             "type": "revenue",   "nature": "credit", "parent": "4",   "posting": False},
    {"code": "411",  "name_ar": "المبيعات",                  "name_en": "Sales",                     "type": "revenue",   "nature": "credit", "parent": "41",  "posting": True},
    {"code": "412",  "name_ar": "مردودات المبيعات",          "name_en": "Sales Returns",             "type": "revenue",   "nature": "debit",  "parent": "41",  "posting": True},
    {"code": "413",  "name_ar": "خصم المبيعات",              "name_en": "Sales Discounts",           "type": "revenue",   "nature": "debit",  "parent": "41",  "posting": True},
    {"code": "42",   "name_ar": "إيرادات أخرى",              "name_en": "Other Revenue",             "type": "revenue",   "nature": "credit", "parent": "4",   "posting": False},
    {"code": "421",  "name_ar": "إيرادات متنوعة",            "name_en": "Miscellaneous Revenue",     "type": "revenue",   "nature": "credit", "parent": "42",  "posting": True},
    # ── 5. المصروفات ───────────────────────────────────────────────
    {"code": "5",    "name_ar": "المصروفات",                 "name_en": "Expenses",                  "type": "expense",   "nature": "debit",  "parent": None,  "posting": False},
    {"code": "51",   "name_ar": "تكلفة المبيعات",            "name_en": "Cost of Sales",             "type": "expense",   "nature": "debit",  "parent": "5",   "posting": False},
    {"code": "511",  "name_ar": "تكلفة البضاعة المباعة",     "name_en": "Cost of Goods Sold",        "type": "expense",   "nature": "debit",  "parent": "51",  "posting": True},
    {"code": "512",  "name_ar": "مردودات المشتريات",         "name_en": "Purchase Returns",          "type": "expense",   "nature": "credit", "parent": "51",  "posting": True},
    {"code": "52",   "name_ar": "مصروفات التشغيل",           "name_en": "Operating Expenses",        "type": "expense",   "nature": "debit",  "parent": "5",   "posting": False},
    {"code": "521",  "name_ar": "الرواتب والأجور",           "name_en": "Salaries & Wages",          "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "522",  "name_ar": "الإيجار",                   "name_en": "Rent Expense",              "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "523",  "name_ar": "الكهرباء والمياه",          "name_en": "Utilities",                 "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "524",  "name_ar": "الاتصالات",                 "name_en": "Communications",            "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "525",  "name_ar": "التسويق والإعلان",          "name_en": "Marketing & Advertising",   "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "526",  "name_ar": "الصيانة والإصلاح",          "name_en": "Maintenance & Repairs",     "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "527",  "name_ar": "مصروفات النقل",             "name_en": "Transportation",            "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "528",  "name_ar": "استهلاك الأصول الثابتة",    "name_en": "Depreciation Expense",      "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "529",  "name_ar": "مصروفات متنوعة",            "name_en": "Miscellaneous Expenses",    "type": "expense",   "nature": "debit",  "parent": "52",  "posting": True},
    {"code": "53",   "name_ar": "المصروفات المالية",         "name_en": "Financial Expenses",        "type": "expense",   "nature": "debit",  "parent": "5",   "posting": False},
    {"code": "531",  "name_ar": "فوائد القروض",              "name_en": "Loan Interest",             "type": "expense",   "nature": "debit",  "parent": "53",  "posting": True},
    {"code": "532",  "name_ar": "عمولات بنكية",              "name_en": "Bank Charges",              "type": "expense",   "nature": "debit",  "parent": "53",  "posting": True},
]


async def create_chart_of_accounts(
    tenant_id: str,
    db: AsyncSession,
    coa_type: str = "saudi_standard",
) -> dict:
    """
    ينشئ دليل الحسابات السعودي القياسي.
    يتحقق أولاً إذا كان الدليل موجوداً.
    """
    # تحقق من وجود حسابات مسبقاً
    existing = await db.execute(
        select(func.count(Account.id)).where(Account.tenant_id == tenant_id)
    )
    existing_count = existing.scalar() or 0
    if existing_count > 0:
        return {
            "tool": "create_chart_of_accounts",
            "status": "already_exists",
            "message": f"دليل الحسابات موجود مسبقاً ({existing_count} حساب). هل تريد إضافة حسابات جديدة؟",
            "existing_count": existing_count,
        }

    # خريطة code → id للربط بين الحسابات الأب والأبناء
    code_to_id: dict[str, str] = {}
    created = 0
    errors = []

    for acc_def in SAUDI_COA:
        parent_id = code_to_id.get(acc_def["parent"]) if acc_def["parent"] else None
        try:
            data = AccountCreate(
                code=acc_def["code"],
                name_ar=acc_def["name_ar"],
                name_en=acc_def["name_en"],
                account_type=AccountType(acc_def["type"]),
                nature=AccountNature(acc_def["nature"]),
                parent_id=parent_id,
                is_posting=acc_def["posting"],
                allow_direct_posting=acc_def["posting"],
            )
            acc = await create_account(db, tenant_id, data)
            code_to_id[acc_def["code"]] = acc.id
            created += 1
        except Exception as e:
            errors.append(f"{acc_def['code']}: {str(e)}")

    return {
        "tool": "create_chart_of_accounts",
        "status": "success",
        "created_count": created,
        "errors": errors,
        "summary": {
            "assets": len([a for a in SAUDI_COA if a["type"] == "asset"]),
            "liabilities": len([a for a in SAUDI_COA if a["type"] == "liability"]),
            "equity": len([a for a in SAUDI_COA if a["type"] == "equity"]),
            "revenue": len([a for a in SAUDI_COA if a["type"] == "revenue"]),
            "expenses": len([a for a in SAUDI_COA if a["type"] == "expense"]),
        }
    }


async def create_fiscal_year_tool(
    tenant_id: str,
    db: AsyncSession,
    year: int | None = None,
) -> dict:
    """ينشئ سنة مالية"""
    y = year or datetime.utcnow().year
    # تحقق من وجود سنة مالية
    existing = await db.execute(
        select(FiscalYear).where(
            FiscalYear.tenant_id == tenant_id,
            FiscalYear.name.contains(str(y)),
        )
    )
    if existing.scalar_one_or_none():
        return {"tool": "create_fiscal_year", "status": "already_exists", "year": y}

    data = FiscalYearCreate(
        name=f"السنة المالية {y}",
        start_date=datetime(y, 1, 1),
        end_date=datetime(y, 12, 31),
        is_default=True,
    )
    fy = await create_fiscal_year(db, tenant_id, data)
    return {
        "tool": "create_fiscal_year",
        "status": "success",
        "id": fy.id,
        "name": fy.name,
        "start": fy.start_date.strftime("%Y-%m-%d"),
        "end": fy.end_date.strftime("%Y-%m-%d"),
    }


# ══════════════════════════════════════════════════════════════════════
# ب) إنشاء عميل / مورد
# ══════════════════════════════════════════════════════════════════════

async def create_customer_tool(
    tenant_id: str,
    db: AsyncSession,
    name_ar: str,
    customer_type: str = "company",
    phone: str | None = None,
    vat_number: str | None = None,
    cr_number: str | None = None,
    email: str | None = None,
    city: str | None = None,
    address_street: str | None = None,
    credit_limit: float = 0,
    payment_terms_days: int = 30,
    notes: str | None = None,
) -> dict:
    """ينشئ عميلاً جديداً بالحقول الكاملة"""
    from app.modules.sales.service import create_customer
    from app.modules.sales.schemas import CustomerCreate
    from app.models.sales import Customer, CustomerType

    # تحقق من عدم التكرار داخل نفس الشركة فقط
    existing = await db.execute(
        select(Customer).where(
            Customer.tenant_id == tenant_id,
            Customer.name_ar == name_ar,
        )
    )
    if existing.scalar_one_or_none():
        return {
            "tool": "create_customer",
            "status": "already_exists",
            "message": f"العميل '{name_ar}' موجود مسبقاً في هذه الشركة",
        }

    # تحويل نوع العميل
    type_map = {"company": CustomerType.COMPANY, "individual": CustomerType.INDIVIDUAL, "government": CustomerType.GOVERNMENT}
    ctype = type_map.get(customer_type, CustomerType.COMPANY)

    data = CustomerCreate(
        name_ar=name_ar,
        name_en=name_ar,
        customer_type=ctype,
        phone=phone,
        vat_number=vat_number,
        cr_number=cr_number,
        email=email,
        address_city=city,
        address_street=address_street,
        credit_limit=Decimal(str(credit_limit)),
        payment_terms_days=payment_terms_days,
        notes=notes,
    )
    customer = await create_customer(db, tenant_id, data)
    return {
        "tool": "create_customer",
        "status": "success",
        "id": customer.id,
        "number": customer.customer_number,
        "name": customer.name_ar,
        "type": customer_type,
    }


async def create_vendor_tool(
    tenant_id: str,
    db: AsyncSession,
    name_ar: str,
    vendor_type: str = "company",
    phone: str | None = None,
    vat_number: str | None = None,
    cr_number: str | None = None,
    email: str | None = None,
    city: str | None = None,
    payment_terms_days: int = 30,
    notes: str | None = None,
) -> dict:
    """ينشئ مورداً جديداً بالحقول الكاملة"""
    from app.models.purchases import Vendor
    from app.modules.purchases.service import create_vendor

    # تحقق داخل نفس الشركة فقط
    existing = await db.execute(
        select(Vendor).where(
            Vendor.tenant_id == tenant_id,
            Vendor.name_ar == name_ar,
        )
    )
    if existing.scalar_one_or_none():
        return {
            "tool": "create_vendor",
            "status": "already_exists",
            "message": f"المورد '{name_ar}' موجود مسبقاً في هذه الشركة",
        }

    vendor = await create_vendor(db, tenant_id, {
        "name_ar": name_ar,
        "name_en": name_ar,
        "vendor_type": vendor_type,
        "phone": phone,
        "vat_number": vat_number,
        "cr_number": cr_number,
        "email": email,
        "address_city": city,
        "payment_terms_days": payment_terms_days,
        "notes": notes,
    })
    return {
        "tool": "create_vendor",
        "status": "success",
        "id": vendor.id,
        "number": vendor.vendor_number,
        "name": vendor.name_ar,
    }


# ══════════════════════════════════════════════════════════════════════
# ج) إنشاء صنف مخزون
# ══════════════════════════════════════════════════════════════════════

async def create_inventory_item_tool(
    tenant_id: str,
    db: AsyncSession,
    name_ar: str,
    sale_price: float,
    cost_price: float = 0,
    tracking_type: str | None = None,  # None = يُحدَّد تلقائياً من نشاط الشركة
    barcode: str | None = None,
    unit_type: str = "piece",
    vat_rate: float = 15,
    reorder_point: float = 0,
    # حقول السيريال (جوالات/قطع غيار)
    color: str | None = None,
    storage: str | None = None,
    # حقول الصيدلية
    manufacturer: str | None = None,
    generic_name: str | None = None,
    dosage_form: str | None = None,
    concentration: str | None = None,
    sfda_number: str | None = None,
    requires_prescription: bool = False,
    country_of_origin: str | None = None,
) -> dict:
    """ينشئ صنفاً جديداً — يحدد نوع التتبع تلقائياً من نشاط الشركة"""
    from app.modules.inventory.service import create_item
    from app.models.tenant import Tenant

    # جلب نوع النشاط لتحديد tracking_type تلقائياً
    if not tracking_type:
        tenant_r = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = tenant_r.scalar_one_or_none()
        business_type = tenant.business_type if tenant else "general"
        tracking_map = {
            "mobile_phones": "serial",
            "spare_parts":   "serial",
            "pharmacy":      "batch",
            "clothing":      "variant",
            "grocery":       "quantity",
            "spices":        "weight",
            "construction":  "quantity",
            "general":       "quantity",
        }
        tracking_type = tracking_map.get(business_type, "quantity")

    item = await create_item(db, tenant_id, {
        "name_ar": name_ar,
        "name_en": name_ar,
        "sale_price": sale_price,
        "cost_price": cost_price,
        "tracking_type": tracking_type,
        "barcode": barcode,
        "unit_type": unit_type,
        "vat_rate": vat_rate,
        "reorder_point": reorder_point,
        "pos_enabled": True,
        # حقول السيريال
        "color": color,
        "storage": storage,
        # حقول الصيدلية
        "manufacturer": manufacturer,
        "generic_name": generic_name,
        "dosage_form": dosage_form,
        "concentration": concentration,
        "sfda_number": sfda_number,
        "requires_prescription": requires_prescription,
        "country_of_origin": country_of_origin,
    })
    return {
        "tool": "create_inventory_item",
        "status": "success",
        "id": item.id,
        "sku": item.sku,
        "name": item.name_ar,
        "tracking_type": item.tracking_type,
        "sale_price": float(item.sale_price),
        "cost_price": float(item.cost_price),
    }


# ══════════════════════════════════════════════════════════════════════
# د) إنشاء فاتورة مبيعات (مسودة)
# ══════════════════════════════════════════════════════════════════════

async def create_invoice_draft_tool(
    tenant_id: str,
    user_id: str,
    db: AsyncSession,
    customer_name: str,
    items: list[dict],  # [{"name": "...", "qty": 1, "price": 100}]
    notes: str | None = None,
) -> dict:
    """
    ينشئ مسودة فاتورة مبيعات.
    items: قائمة الأصناف [{name, qty, price, vat_rate?}]
    """
    from app.models.sales import Customer
    from app.modules.sales.service import create_invoice
    from app.modules.sales.schemas import InvoiceCreate, InvoiceLineCreate

    # البحث عن العميل
    customer_r = await db.execute(
        select(Customer).where(
            Customer.tenant_id == tenant_id,
            Customer.name_ar.ilike(f"%{customer_name}%"),
        ).limit(1)
    )
    customer = customer_r.scalar_one_or_none()
    if not customer:
        return {
            "tool": "create_invoice_draft",
            "status": "error",
            "message": f"العميل '{customer_name}' غير موجود. أنشئه أولاً.",
        }

    # بناء السطور
    lines = []
    for item in items:
        lines.append(InvoiceLineCreate(
            description_ar=item.get("name", ""),
            description_en=item.get("name", ""),
            quantity=Decimal(str(item.get("qty", 1))),
            unit_price=Decimal(str(item.get("price", 0))),
            discount_pct=Decimal("0"),
            vat_rate=Decimal(str(item.get("vat_rate", 15))),
        ))

    now = datetime.utcnow()
    data = InvoiceCreate(
        customer_id=customer.id,
        issue_date=now,
        supply_date=now,
        notes=notes,
        lines=lines,
    )

    invoice = await create_invoice(db, tenant_id, user_id, data)
    return {
        "tool": "create_invoice_draft",
        "status": "success",
        "invoice_number": invoice.invoice_number,
        "customer": customer.name_ar,
        "total": float(invoice.total),
        "vat": float(invoice.vat_amount),
        "lines_count": len(lines),
        "navigate_to": f"/sales/invoices/{invoice.id}",
    }


# ══════════════════════════════════════════════════════════════════════
# الـ Tool Definitions للـ AI
# ══════════════════════════════════════════════════════════════════════

CREATION_TOOLS_DEFINITION = [
    {
        "name": "create_chart_of_accounts",
        "description": "ينشئ دليل الحسابات السعودي القياسي كاملاً (~55 حساب). استخدمه عند طلب إنشاء دليل الحسابات.",
        "parameters": {
            "coa_type": "saudi_standard (الافتراضي)",
        }
    },
    {
        "name": "create_fiscal_year",
        "description": "ينشئ سنة مالية جديدة.",
        "parameters": {
            "year": "السنة (مثل 2025، افتراضي السنة الحالية)",
        }
    },
    {
        "name": "create_customer",
        "description": "ينشئ عميلاً جديداً. اجمع الحقول من المستخدم قبل الاستدعاء.",
        "parameters": {
            "name_ar":             "اسم العميل بالعربي (مطلوب)",
            "customer_type":       "نوع العميل: company=شركة | individual=فرد | government=حكومي",
            "vat_number":          "الرقم الضريبي (15 رقم)",
            "cr_number":           "رقم السجل التجاري",
            "phone":               "رقم الهاتف",
            "email":               "البريد الإلكتروني",
            "city":                "المدينة",
            "address_street":      "اسم الشارع",
            "credit_limit":        "حد الائتمان بالريال (افتراضي 0)",
            "payment_terms_days":  "أيام الدفع (افتراضي 30)",
            "notes":               "ملاحظات",
        }
    },
    {
        "name": "create_vendor",
        "description": "ينشئ مورداً جديداً. اجمع الحقول من المستخدم قبل الاستدعاء.",
        "parameters": {
            "name_ar":             "اسم المورد بالعربي (مطلوب)",
            "vendor_type":         "نوع المورد: company=شركة | individual=فرد",
            "vat_number":          "الرقم الضريبي",
            "cr_number":           "رقم السجل التجاري",
            "phone":               "رقم الهاتف",
            "email":               "البريد الإلكتروني",
            "city":                "المدينة",
            "payment_terms_days":  "أيام الدفع (افتراضي 30)",
            "notes":               "ملاحظات",
        }
    },
    {
        "name": "create_inventory_item",
        "description": "ينشئ صنفاً في المخزون. نوع التتبع يُحدَّد تلقائياً من نشاط الشركة (serial للجوالات، batch للصيدلية، variant للملابس). اجمع الحقول المناسبة.",
        "parameters": {
            "name_ar":              "اسم الصنف بالعربي (مطلوب)",
            "sale_price":           "سعر البيع بالريال (مطلوب)",
            "cost_price":           "سعر التكلفة بالريال",
            "tracking_type":        "نوع التتبع: serial | batch | quantity | variant | weight (اتركه فارغاً للتحديد التلقائي)",
            "barcode":              "الباركود",
            "unit_type":            "وحدة القياس: piece | kg | liter | meter | box",
            "vat_rate":             "نسبة الضريبة % (افتراضي 15)",
            "reorder_point":        "نقطة إعادة الطلب",
            # حقول السيريال
            "color":                "اللون (للجوالات والإلكترونيات)",
            "storage":              "السعة التخزينية (للجوالات، مثال: 128GB)",
            # حقول الصيدلية
            "manufacturer":         "الشركة المصنّعة (مطلوب للصيدلية)",
            "generic_name":         "الاسم العلمي للدواء",
            "dosage_form":          "الشكل الدوائي (أقراص، شراب، حقن...)",
            "concentration":        "التركيز (مثال: 500mg)",
            "sfda_number":          "رقم هيئة الغذاء والدواء SFDA",
            "requires_prescription":"يستلزم وصفة طبية: true | false",
            "country_of_origin":    "بلد المنشأ",
        }
    },
    {
        "name": "create_invoice_draft",
        "description": "ينشئ مسودة فاتورة مبيعات مع الأصناف.",
        "parameters": {
            "customer_name": "اسم العميل (مطلوب)",
            "items":         'قائمة الأصناف: [{"name":"...","qty":1,"price":100,"vat_rate":15}]',
            "notes":         "ملاحظات",
        }
    },
]


# ══════════════════════════════════════════════════════════════════════
# Executor
# ══════════════════════════════════════════════════════════════════════

async def execute_creation_tool(
    tool_name: str,
    params: dict,
    tenant_id: str,
    user_id: str,
    db: AsyncSession,
) -> dict:
    try:
        if tool_name == "create_chart_of_accounts":
            return await create_chart_of_accounts(tenant_id, db, params.get("coa_type", "saudi_standard"))

        elif tool_name == "create_fiscal_year":
            year = int(params["year"]) if params.get("year") else None
            return await create_fiscal_year_tool(tenant_id, db, year)

        elif tool_name == "create_customer":
            return await create_customer_tool(
                tenant_id, db,
                name_ar=params["name_ar"],
                customer_type=params.get("customer_type", "company"),
                phone=params.get("phone"),
                vat_number=params.get("vat_number"),
                cr_number=params.get("cr_number"),
                email=params.get("email"),
                city=params.get("city"),
                address_street=params.get("address_street"),
                credit_limit=float(params.get("credit_limit", 0)),
                payment_terms_days=int(params.get("payment_terms_days", 30)),
                notes=params.get("notes"),
            )

        elif tool_name == "create_vendor":
            return await create_vendor_tool(
                tenant_id, db,
                name_ar=params["name_ar"],
                vendor_type=params.get("vendor_type", "company"),
                phone=params.get("phone"),
                vat_number=params.get("vat_number"),
                cr_number=params.get("cr_number"),
                email=params.get("email"),
                city=params.get("city"),
                payment_terms_days=int(params.get("payment_terms_days", 30)),
                notes=params.get("notes"),
            )

        elif tool_name == "create_inventory_item":
            return await create_inventory_item_tool(
                tenant_id, db,
                name_ar=params["name_ar"],
                sale_price=float(params.get("sale_price", 0)),
                cost_price=float(params.get("cost_price", 0)),
                tracking_type=params.get("tracking_type") or None,
                barcode=params.get("barcode"),
                unit_type=params.get("unit_type", "piece"),
                vat_rate=float(params.get("vat_rate", 15)),
                reorder_point=float(params.get("reorder_point", 0)),
                color=params.get("color"),
                storage=params.get("storage"),
                manufacturer=params.get("manufacturer"),
                generic_name=params.get("generic_name"),
                dosage_form=params.get("dosage_form"),
                concentration=params.get("concentration"),
                sfda_number=params.get("sfda_number"),
                requires_prescription=params.get("requires_prescription", False) in (True, "true", "True"),
                country_of_origin=params.get("country_of_origin"),
            )

        elif tool_name == "create_invoice_draft":
            import json as _json
            items = params.get("items", [])
            if isinstance(items, str):
                try:
                    items = _json.loads(items)
                except Exception:
                    items = []
            return await create_invoice_draft_tool(
                tenant_id, user_id, db,
                customer_name=params["customer_name"],
                items=items,
                notes=params.get("notes"),
            )

        elif tool_name == "create_voucher":
            return await create_voucher_tool(
                tenant_id, user_id, db,
                voucher_type=params.get("voucher_type", "receipt"),
                amount=float(params.get("amount", 0)),
                description_ar=params.get("description_ar", ""),
                party_name=params.get("party_name"),
                party_type=params.get("party_type"),
                payment_method=params.get("payment_method", "cash"),
                notes=params.get("notes"),
            )

        elif tool_name == "create_purchase_order":
            import json as _json
            items = params.get("items", [])
            if isinstance(items, str):
                try:
                    items = _json.loads(items)
                except Exception:
                    items = []
            return await create_purchase_order_tool(
                tenant_id, user_id, db,
                vendor_name=params["vendor_name"],
                items=items,
                notes=params.get("notes"),
            )

        elif tool_name == "create_journal_entry":
            import json as _json
            lines = params.get("lines", [])
            if isinstance(lines, str):
                try:
                    lines = _json.loads(lines)
                except Exception:
                    lines = []
            return await create_journal_entry_tool(
                tenant_id, user_id, db,
                description_ar=params.get("description_ar", ""),
                lines=lines,
                notes=params.get("notes"),
            )

        else:
            return {"error": f"tool '{tool_name}' غير معروف"}

    except KeyError as e:
        return {"error": f"حقل مطلوب ناقص: {e}", "tool": tool_name}
    except Exception as e:
        return {"error": str(e), "tool": tool_name}


# ══════════════════════════════════════════════════════════════════════
# هـ) سند قبض / صرف / مصروف
# ══════════════════════════════════════════════════════════════════════

async def create_voucher_tool(
    tenant_id: str,
    user_id: str,
    db: AsyncSession,
    voucher_type: str,       # receipt | payment | expense
    amount: float,
    description_ar: str,
    party_name: str | None = None,
    party_type: str | None = None,  # customer | vendor
    payment_method: str = "cash",
    notes: str | None = None,
) -> dict:
    """ينشئ سند قبض أو صرف أو مصروف"""
    from app.modules.treasury.service import create_voucher
    from app.models.treasury import VoucherType

    type_map = {"receipt": "receipt", "payment": "payment", "expense": "expense"}
    vtype = type_map.get(voucher_type, "receipt")

    voucher = await create_voucher(db, tenant_id, user_id, {
        "voucher_type": vtype,
        "voucher_date": datetime.utcnow().isoformat(),
        "amount": amount,
        "description_ar": description_ar,
        "party_name": party_name,
        "party_type": party_type,
        "payment_method": payment_method,
        "notes": notes,
    })

    type_labels = {"receipt": "سند قبض", "payment": "سند صرف", "expense": "مصروف"}
    return {
        "tool": "create_voucher",
        "status": "success",
        "id": voucher.id,
        "number": voucher.voucher_number,
        "type": type_labels.get(vtype, vtype),
        "amount": float(voucher.amount),
        "note": "السند في حالة مسودة — يحتاج ترحيل من صفحة الخزينة لإنشاء القيد المحاسبي",
    }


# ══════════════════════════════════════════════════════════════════════
# و) أمر شراء
# ══════════════════════════════════════════════════════════════════════

async def create_purchase_order_tool(
    tenant_id: str,
    user_id: str,
    db: AsyncSession,
    vendor_name: str,
    items: list[dict],  # [{"name": "...", "qty": 1, "price": 100}]
    notes: str | None = None,
) -> dict:
    """ينشئ أمر شراء"""
    from app.models.purchases import Vendor
    from app.modules.purchases.service import create_purchase_order

    # البحث عن المورد
    vendor_r = await db.execute(
        select(Vendor).where(
            Vendor.tenant_id == tenant_id,
            Vendor.name_ar.ilike(f"%{vendor_name}%"),
        ).limit(1)
    )
    vendor = vendor_r.scalar_one_or_none()
    if not vendor:
        return {
            "tool": "create_purchase_order",
            "status": "error",
            "message": f"المورد '{vendor_name}' غير موجود. أنشئه أولاً.",
        }

    lines = [
        {
            "description_ar": item.get("name", ""),
            "description_en": item.get("name", ""),
            "quantity": float(item.get("qty", 1)),
            "unit_price": float(item.get("price", 0)),
            "discount_pct": 0,
            "vat_rate": float(item.get("vat_rate", 15)),
        }
        for item in items
    ]

    order = await create_purchase_order(db, tenant_id, user_id, {
        "vendor_id": vendor.id,
        "order_date": datetime.utcnow().isoformat(),
        "notes": notes,
        "lines": lines,
    })

    return {
        "tool": "create_purchase_order",
        "status": "success",
        "order_number": order.order_number,
        "vendor": vendor.name_ar,
        "total": float(order.total),
        "lines_count": len(lines),
        "navigate_to": f"/purchases/orders/{order.id}",
    }


# ══════════════════════════════════════════════════════════════════════
# ز) قيد يومية
# ══════════════════════════════════════════════════════════════════════

async def create_journal_entry_tool(
    tenant_id: str,
    user_id: str,
    db: AsyncSession,
    description_ar: str,
    lines: list[dict],  # [{"account_code": "1111", "debit": 100, "credit": 0}]
    notes: str | None = None,
) -> dict:
    """ينشئ قيد يومية — يتحقق من التوازن"""
    from app.models.accounting import Account
    from app.modules.accounting.service import create_journal_entry
    from app.modules.accounting.schemas import JournalEntryCreate, JournalEntryLineCreate

    # تحويل أكواد الحسابات لـ IDs
    entry_lines = []
    for line in lines:
        code = str(line.get("account_code", ""))
        acc_r = await db.execute(
            select(Account).where(
                Account.tenant_id == tenant_id,
                Account.code == code,
            )
        )
        account = acc_r.scalar_one_or_none()
        if not account:
            return {
                "tool": "create_journal_entry",
                "status": "error",
                "message": f"الحساب برمز '{code}' غير موجود في دليل الحسابات",
            }
        entry_lines.append(JournalEntryLineCreate(
            account_id=account.id,
            description=line.get("description", description_ar),
            debit=Decimal(str(line.get("debit", 0))),
            credit=Decimal(str(line.get("credit", 0))),
        ))

    # التحقق من التوازن
    total_debit = sum(l.debit for l in entry_lines)
    total_credit = sum(l.credit for l in entry_lines)
    if abs(total_debit - total_credit) > Decimal("0.01"):
        return {
            "tool": "create_journal_entry",
            "status": "error",
            "message": f"القيد غير متوازن — المدين: {total_debit} ≠ الدائن: {total_credit}",
        }

    data = JournalEntryCreate(
        entry_date=datetime.utcnow(),
        description_ar=description_ar,
        notes=notes,
        lines=entry_lines,
    )
    entry = await create_journal_entry(db, tenant_id, user_id, data)

    return {
        "tool": "create_journal_entry",
        "status": "success",
        "entry_number": entry.entry_number,
        "description": description_ar,
        "total_debit": float(total_debit),
        "total_credit": float(total_credit),
        "lines_count": len(entry_lines),
        "note": "القيد في حالة مسودة — يحتاج ترحيل من صفحة القيود",
    }


# ── إضافة للـ CREATION_TOOLS_DEFINITION ──────────────────────────────
CREATION_TOOLS_DEFINITION += [
    {
        "name": "create_voucher",
        "description": "ينشئ سند قبض أو صرف أو مصروف في الخزينة.",
        "parameters": {
            "voucher_type":   "نوع السند: receipt=قبض | payment=صرف | expense=مصروف (مطلوب)",
            "amount":         "المبلغ بالريال (مطلوب)",
            "description_ar": "وصف السند (مطلوب)",
            "party_name":     "اسم الطرف (عميل أو مورد)",
            "party_type":     "نوع الطرف: customer | vendor",
            "payment_method": "طريقة الدفع: cash | bank_transfer | cheque | mada | stc_pay",
            "notes":          "ملاحظات",
        }
    },
    {
        "name": "create_purchase_order",
        "description": "ينشئ أمر شراء. اجمع اسم المورد والأصناف من المستخدم.",
        "parameters": {
            "vendor_name": "اسم المورد (مطلوب)",
            "items":       'قائمة الأصناف: [{"name":"...","qty":1,"price":100}]',
            "notes":       "ملاحظات",
        }
    },
    {
        "name": "create_journal_entry",
        "description": "ينشئ قيد يومية محاسبي. يتحقق من التوازن تلقائياً.",
        "parameters": {
            "description_ar": "وصف القيد (مطلوب)",
            "lines":          'أسطر القيد: [{"account_code":"1111","debit":100,"credit":0,"description":"..."}]',
            "notes":          "ملاحظات",
        }
    },
]
