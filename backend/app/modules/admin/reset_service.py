"""
خدمة تصفير وحذف الشركات من لوحة المدير العام.
لا تُنفّذ أي عملية إلا من خلال endpoint محمي وبـ confirmation token صريح.
"""
from __future__ import annotations

from typing import Any
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record_audit

logger = logging.getLogger(__name__)


async def _table_exists(db: AsyncSession, table: str) -> bool:
    result = await db.execute(text("SELECT to_regclass(:table_name)"), {"table_name": table})
    return result.scalar() is not None


async def _column_exists(db: AsyncSession, table: str, column: str) -> bool:
    result = await db.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = :table_name
          AND column_name = :column_name
    """), {"table_name": table, "column_name": column})
    return result.scalar() is not None


async def _detach_account_references(db: AsyncSession, tenant_id: str) -> None:
    """يفك مراجع الحسابات قبل حذف الشجرة، مع دعم اختلاف migrations بين البيئات."""
    references = (
        ("customers", "ar_account_id"),
        ("vendors", "ap_account_id"),
        ("sales_reps", "customer_account_id"),
        ("accounts", "parent_id"),
    )
    for table, column in references:
        if await _table_exists(db, table) and await _column_exists(db, table, column):
            await db.execute(
                text(f"UPDATE {table} SET {column}=NULL WHERE tenant_id=:tenant_id"),
                {"tenant_id": tenant_id},
            )


SECTION_LABELS = {
    "sales": "مستندات المبيعات",
    "purchases": "مستندات المشتريات",
    "pos": "عمليات نقاط البيع",
    "treasury": "السندات والخزينة",
    "accounting": "القيود والشجرة المحاسبية",
    "inventory": "حركات المخزون والسيريالات",
    "customers": "العملاء",
    "vendors": "الموردون",
}

SECTION_TABLES: dict[str, list[tuple[str, str]]] = {
    "sales": [
        ("invoice_lines", "invoice_id IN (SELECT id FROM invoices WHERE tenant_id=:tenant_id)"),
        ("payments", "tenant_id=:tenant_id"),
        ("credit_note_lines", "credit_note_id IN (SELECT id FROM credit_notes WHERE tenant_id=:tenant_id)"),
        ("credit_notes", "tenant_id=:tenant_id"),
        ("refund_requests", "tenant_id=:tenant_id"),
        ("quotation_lines", "quotation_id IN (SELECT id FROM quotations WHERE tenant_id=:tenant_id)"),
        ("quotations", "tenant_id=:tenant_id"),
        ("sales_order_lines", "order_id IN (SELECT id FROM sales_orders WHERE tenant_id=:tenant_id)"),
        ("sales_orders", "tenant_id=:tenant_id"),
        ("invoices", "tenant_id=:tenant_id"),
    ],
    "purchases": [
        ("debit_note_lines", "debit_note_id IN (SELECT id FROM debit_notes WHERE tenant_id=:tenant_id)"),
        ("debit_notes", "tenant_id=:tenant_id"),
        ("bill_lines", "bill_id IN (SELECT id FROM bills WHERE tenant_id=:tenant_id)"),
        ("bill_payments", "tenant_id=:tenant_id"),
        ("bills", "tenant_id=:tenant_id"),
        ("purchase_order_lines", "order_id IN (SELECT id FROM purchase_orders WHERE tenant_id=:tenant_id)"),
        ("purchase_orders", "tenant_id=:tenant_id"),
    ],
    "pos": [
        ("pos_transaction_lines", "transaction_id IN (SELECT id FROM pos_transactions WHERE tenant_id=:tenant_id)"),
        ("pos_transactions", "tenant_id=:tenant_id"),
        ("pos_sessions", "tenant_id=:tenant_id"),
    ],
    "treasury": [("vouchers", "tenant_id=:tenant_id")],
    "inventory": [
        ("stock_movements", "tenant_id=:tenant_id"),
        ("stock_count_sessions", "tenant_id=:tenant_id"),
        ("serial_items", "product_id IN (SELECT id FROM inventory_items WHERE tenant_id=:tenant_id)"),
        ("batch_items", "product_id IN (SELECT id FROM inventory_items WHERE tenant_id=:tenant_id)"),
        ("inventory_stock", "tenant_id=:tenant_id"),
    ],
    "customers": [("customers", "tenant_id=:tenant_id")],
    "vendors": [("vendors", "tenant_id=:tenant_id")],
    "accounting": [
        ("journal_entry_lines", "entry_id IN (SELECT id FROM journal_entries WHERE tenant_id=:tenant_id)"),
        ("journal_entries", "tenant_id=:tenant_id"),
        ("budget_lines", "budget_id IN (SELECT id FROM budgets WHERE tenant_id=:tenant_id)"),
        ("budgets", "tenant_id=:tenant_id"),
        ("bank_accounts", "tenant_id=:tenant_id"),
        ("cost_centers", "tenant_id=:tenant_id"),
        ("accounting_account_mappings", "tenant_id=:tenant_id"),
        ("accounting_setups", "tenant_id=:tenant_id"),
        ("fiscal_years", "tenant_id=:tenant_id"),
        ("accounts", "tenant_id=:tenant_id"),
    ],
}


def _validate_sections(sections: list[str]) -> list[str]:
    unique = list(dict.fromkeys(sections))
    invalid = [section for section in unique if section not in SECTION_TABLES]
    if invalid:
        raise ValueError(f"أقسام غير صالحة: {', '.join(invalid)}")
    return unique


async def preview_reset(db: AsyncSession, tenant_id: str, sections: list[str]) -> dict[str, Any]:
    sections = _expand_reset_sections(_validate_sections(sections))
    counts: dict[str, dict[str, int]] = {}
    total = 0
    for section in sections:
        section_counts: dict[str, int] = {}
        for table, where in SECTION_TABLES[section]:
            if not await _table_exists(db, table):
                continue
            result = await db.execute(text(f"SELECT COUNT(*) FROM {table} WHERE {where}"), {"tenant_id": tenant_id})
            count = int(result.scalar() or 0)
            section_counts[table] = count
            total += count
        counts[section] = section_counts
    return {
        "tenant_id": tenant_id,
        "sections": sections,
        "labels": {key: SECTION_LABELS[key] for key in sections},
        "counts": counts,
        "total_records": total,
        "products_preserved": True,
        "requires_confirmation": True,
    }


RESET_ORDER = ["sales", "purchases", "pos", "treasury", "inventory", "customers", "vendors", "accounting"]


def _expand_reset_sections(sections: list[str]) -> list[str]:
    """يضيف التبعيات تلقائياً بدلاً من إيقاف العملية بسبب قيود اختيار الأقسام."""
    expanded = set(sections)
    if "customers" in expanded:
        expanded.add("sales")
    if "vendors" in expanded:
        expanded.add("purchases")
    # لا نضيف قسم accounting تلقائياً؛ فهو يتضمن شجرة الحسابات نفسها.
    # حذف المستندات لا يحتاج حذف الحسابات، بينما حذف الشجرة يبقى اختياراً مستقلاً.
    return sorted(expanded, key=lambda section: RESET_ORDER.index(section))


async def execute_reset(
    db: AsyncSession,
    tenant_id: str,
    actor_user_id: str | None,
    sections: list[str],
    confirmation: str,
) -> dict[str, Any]:
    sections = _validate_sections(sections)
    if not sections:
        raise ValueError("يجب اختيار قسم واحد على الأقل")
    expected = f"RESET {tenant_id}"
    if confirmation != expected:
        raise ValueError("رمز التأكيد غير صحيح")
    sections = _expand_reset_sections(sections)
    if "accounting" in sections:
        await _detach_account_references(db, tenant_id)
    preview = await preview_reset(db, tenant_id, sections)
    deleted: dict[str, dict[str, int]] = {}
    for section in sections:
        deleted[section] = {}
        for table, where in SECTION_TABLES[section]:
            if not await _table_exists(db, table):
                continue
            if table == "accounts":
                await _detach_account_references(db, tenant_id)
            result = await db.execute(text(f"DELETE FROM {table} WHERE {where}"), {"tenant_id": tenant_id})
            deleted[section][table] = int(result.rowcount or 0)

    if "inventory" in sections and await _table_exists(db, "inventory_items"):
        await db.execute(text("UPDATE inventory_items SET quantity_on_hand=0, quantity_reserved=0 WHERE tenant_id=:tenant_id"), {"tenant_id": tenant_id})

    record_audit(
        db, tenant_id=tenant_id, actor_user_id=actor_user_id,
        action="super_admin_company_reset", entity_type="tenant", entity_id=tenant_id,
        sections=sections, deleted=deleted, total_records=preview["total_records"], products_preserved=True,
    )
    await db.commit()
    return {**preview, "deleted": deleted, "completed": True}
# كل عنصر هو (الجدول، شرط العزل). الجداول التابعة بلا tenant_id تستخدم استعلام parent.
FULL_DELETE_PLAN: list[tuple[str, str]] = [
    ("store_order_lines", "order_id IN (SELECT id FROM store_orders WHERE store_id IN (SELECT id FROM stores WHERE tenant_id=:tenant_id))"),
    ("store_orders", "store_id IN (SELECT id FROM stores WHERE tenant_id=:tenant_id)"),
    ("store_products", "store_id IN (SELECT id FROM stores WHERE tenant_id=:tenant_id)"),
    ("store_categories", "store_id IN (SELECT id FROM stores WHERE tenant_id=:tenant_id)"),
    ("pos_transaction_lines", "transaction_id IN (SELECT id FROM pos_transactions WHERE tenant_id=:tenant_id)"),
    ("pos_transactions", "tenant_id=:tenant_id"),
    ("pos_sessions", "tenant_id=:tenant_id"),
    ("pos_terminals", "tenant_id=:tenant_id"),
    ("invoice_lines", "invoice_id IN (SELECT id FROM invoices WHERE tenant_id=:tenant_id)"),
    ("payments", "tenant_id=:tenant_id"),
    ("credit_note_lines", "credit_note_id IN (SELECT id FROM credit_notes WHERE tenant_id=:tenant_id)"),
    ("refund_requests", "tenant_id=:tenant_id"),
    ("credit_notes", "tenant_id=:tenant_id"),
    ("invoices", "tenant_id=:tenant_id"),
    ("quotation_lines", "quotation_id IN (SELECT id FROM quotations WHERE tenant_id=:tenant_id)"),
    ("quotations", "tenant_id=:tenant_id"),
    ("sales_order_lines", "order_id IN (SELECT id FROM sales_orders WHERE tenant_id=:tenant_id)"),
    ("sales_orders", "tenant_id=:tenant_id"),
    ("bill_lines", "bill_id IN (SELECT id FROM bills WHERE tenant_id=:tenant_id)"),
    ("bill_payments", "tenant_id=:tenant_id"),
    ("bills", "tenant_id=:tenant_id"),
    ("debit_note_lines", "debit_note_id IN (SELECT id FROM debit_notes WHERE tenant_id=:tenant_id)"),
    ("debit_notes", "tenant_id=:tenant_id"),
    ("purchase_order_lines", "order_id IN (SELECT id FROM purchase_orders WHERE tenant_id=:tenant_id)"),
    ("purchase_orders", "tenant_id=:tenant_id"),
    ("vouchers", "tenant_id=:tenant_id"),
    ("rep_geo_events", "tenant_id=:tenant_id"),
    ("rep_locations", "tenant_id=:tenant_id"),
    ("rep_attendance", "tenant_id=:tenant_id"),
    ("rep_geo_zones", "tenant_id=:tenant_id"),
    ("supervisor_reps", "tenant_id=:tenant_id"),
    ("supervisors", "tenant_id=:tenant_id"),
    ("sales_reps", "tenant_id=:tenant_id"),
    ("hr_leave_requests", "tenant_id=:tenant_id"),
    ("hr_attendance", "tenant_id=:tenant_id"),
    ("hr_payroll", "tenant_id=:tenant_id"),
    ("hr_employees", "tenant_id=:tenant_id"),
    ("hr_departments", "tenant_id=:tenant_id"),
    ("notifications", "tenant_id=:tenant_id"),
    ("audit_logs", "tenant_id=:tenant_id"),
    ("depreciation_lines", "asset_id IN (SELECT id FROM assets WHERE tenant_id=:tenant_id)"),
    ("assets", "tenant_id=:tenant_id"),
    ("asset_categories", "tenant_id=:tenant_id"),
    ("stock_movements", "tenant_id=:tenant_id"),
    ("stock_count_sessions", "tenant_id=:tenant_id"),
    ("serial_items", "product_id IN (SELECT id FROM inventory_items WHERE tenant_id=:tenant_id)"),
    ("batch_items", "product_id IN (SELECT id FROM inventory_items WHERE tenant_id=:tenant_id)"),
    ("inventory_stock", "tenant_id=:tenant_id"),
    ("product_options", "group_id IN (SELECT id FROM product_option_groups WHERE product_id IN (SELECT id FROM inventory_items WHERE tenant_id=:tenant_id))"),
    ("product_option_groups", "product_id IN (SELECT id FROM inventory_items WHERE tenant_id=:tenant_id)"),
    ("product_variants", "product_id IN (SELECT id FROM inventory_items WHERE tenant_id=:tenant_id)"),
    ("inventory_items", "tenant_id=:tenant_id"),
    ("product_categories", "tenant_id=:tenant_id"),
    ("currencies", "tenant_id=:tenant_id"),
    ("accounting_account_mappings", "tenant_id=:tenant_id"),
    ("journal_entry_lines", "entry_id IN (SELECT id FROM journal_entries WHERE tenant_id=:tenant_id)"),
    ("journal_entries", "tenant_id=:tenant_id"),
    ("budget_lines", "budget_id IN (SELECT id FROM budgets WHERE tenant_id=:tenant_id)"),
    ("budgets", "tenant_id=:tenant_id"),
    ("bank_accounts", "tenant_id=:tenant_id"),
    ("cost_centers", "tenant_id=:tenant_id"),
    ("accounting_setups", "tenant_id=:tenant_id"),
    ("fiscal_years", "tenant_id=:tenant_id"),
    ("customers", "tenant_id=:tenant_id"),
    ("vendors", "tenant_id=:tenant_id"),
    ("warehouses", "tenant_id=:tenant_id"),
    ("stores", "tenant_id=:tenant_id"),
    ("vat_settings", "tenant_id=:tenant_id"),
    ("alert_settings", "tenant_id=:tenant_id"),
    ("ai_usage", "tenant_id=:tenant_id"),
    ("ai_tenant_settings", "tenant_id=:tenant_id"),
    ("accounts", "tenant_id=:tenant_id"),
    ("users", "tenant_id=:tenant_id"),
]


async def preview_full_delete(db: AsyncSession, tenant_id: str) -> dict[str, Any]:
    counts: dict[str, int] = {}
    total = 0
    for table, where in FULL_DELETE_PLAN:
        if not await _table_exists(db, table):
            continue
        result = await db.execute(text(f"SELECT COUNT(*) FROM {table} WHERE {where}"), {"tenant_id": tenant_id})
        count = int(result.scalar() or 0)
        if count:
            counts[table] = count
            total += count
    return {"tenant_id": tenant_id, "counts": counts, "total_records": total, "products_deleted": True, "requires_confirmation": True}


async def execute_full_delete(
    db: AsyncSession, tenant_id: str, actor_user_id: str | None,
    company_name: str, confirmation: str,
) -> dict[str, Any]:
    tenant_result = await db.execute(text("SELECT name FROM tenants WHERE id=:tenant_id"), {"tenant_id": tenant_id})
    actual_name = tenant_result.scalar_one_or_none()
    if actual_name is None:
        raise ValueError("الشركة غير موجودة")
    if company_name.strip() != actual_name.strip():
        raise ValueError("اسم الشركة لا يطابق الشركة المحددة")
    if confirmation != f"DELETE COMPANY {tenant_id}":
        raise ValueError("رمز الحذف الكلي غير صحيح")

    preview = await preview_full_delete(db, tenant_id)
    deleted: dict[str, int] = {}
    # فك العلاقات الذاتية والمراجع قبل حذف الجداول الأصلية.
    for table, column in (("customers", "ar_account_id"), ("vendors", "ap_account_id"), ("accounts", "parent_id"), ("product_categories", "parent_id")):
        if await _table_exists(db, table):
            await db.execute(text(f"UPDATE {table} SET {column}=NULL WHERE tenant_id=:tenant_id"), {"tenant_id": tenant_id})

    for table, where in FULL_DELETE_PLAN:
        if not await _table_exists(db, table):
            continue
        result = await db.execute(text(f"DELETE FROM {table} WHERE {where}"), {"tenant_id": tenant_id})
        deleted[table] = int(result.rowcount or 0)

    await db.execute(text("DELETE FROM tenants WHERE id=:tenant_id"), {"tenant_id": tenant_id})
    # لا يمكن إنشاء AuditLog بعد حذف tenant لأن العمود tenant_id غير قابل لـ NULL.
    # تُحذف سجلات التدقيق التابعة ضمن المعاملة، وتُسجّل النتيجة في سجل التطبيق.
    logger.warning(
        "super_admin_full_company_delete completed tenant_id=%s actor_user_id=%s company_name=%s total_records=%s",
        tenant_id, actor_user_id, actual_name, preview["total_records"],
    )
    await db.commit()
    return {**preview, "deleted": deleted, "completed": True}
