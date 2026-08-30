"""عمليات تصفير الشركة الانتقائية للمدير العام.

لا تُنفّذ أي عملية إلا من خلال endpoint محمي وبـ confirmation token صريح.
"""
from __future__ import annotations

from typing import Any
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import record_audit


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

# الترتيب من التابع إلى الأصل. الجداول التابعة بلا tenant_id تُقيّد عبر parent subquery.
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
        ("bill_lines", "bill_id IN (SELECT id FROM bills WHERE tenant_id=:tenant_id)"),
        ("bill_payments", "tenant_id=:tenant_id"),
        ("bills", "tenant_id=:tenant_id"),
        ("purchase_order_lines", "order_id IN (SELECT id FROM purchase_orders WHERE tenant_id=:tenant_id)"),
        ("purchase_orders", "tenant_id=:tenant_id"),
        ("debit_note_lines", "debit_note_id IN (SELECT id FROM debit_notes WHERE tenant_id=:tenant_id)"),
        ("debit_notes", "tenant_id=:tenant_id"),
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
    sections = _validate_sections(sections)
    counts: dict[str, dict[str, int]] = {}
    total = 0
    for section in sections:
        section_counts: dict[str, int] = {}
        for table, where in SECTION_TABLES[section]:
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


async def _validate_dependencies(db: AsyncSession, sections: list[str]) -> None:
    """يمنع حذف الأصول المرجعية قبل مستنداتها التابعة."""
    if "customers" in sections and "sales" not in sections:
        raise ValueError("لتصفير العملاء يجب اختيار قسم مستندات المبيعات أولاً")
    if "vendors" in sections and "purchases" not in sections:
        raise ValueError("لتصفير الموردين يجب اختيار قسم مستندات المشتريات أولاً")
    if "accounting" in sections and ("sales" not in sections or "purchases" not in sections):
        raise ValueError("لتصفير القيود والشجرة يجب اختيار المبيعات والمشتريات معها أولاً")


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
    await _validate_dependencies(db, sections)

    # نرتب الأقسام داخلياً من التابع إلى الأصل مهما كان ترتيب اختيار المستخدم.
    sections = sorted(sections, key=lambda section: RESET_ORDER.index(section))
    preview = await preview_reset(db, tenant_id, sections)
    deleted: dict[str, dict[str, int]] = {}
    for section in sections:
        deleted[section] = {}
        for table, where in SECTION_TABLES[section]:
            if table == "accounts":
                # فك مراجع الأطراف والعلاقة الذاتية قبل حذف دليل الشركة.
                await db.execute(text("UPDATE customers SET ar_account_id=NULL WHERE tenant_id=:tenant_id"), {"tenant_id": tenant_id})
                await db.execute(text("UPDATE vendors SET ap_account_id=NULL WHERE tenant_id=:tenant_id"), {"tenant_id": tenant_id})
                await db.execute(text("UPDATE accounts SET parent_id=NULL WHERE tenant_id=:tenant_id"), {"tenant_id": tenant_id})
            result = await db.execute(text(f"DELETE FROM {table} WHERE {where}"), {"tenant_id": tenant_id})
            deleted[section][table] = int(result.rowcount or 0)

    # التصفير المخزني يحذف السجلات التشغيلية فقط ويبقي تعريف المنتج.
    if "inventory" in sections:
        await db.execute(
            text("UPDATE inventory_items SET quantity_on_hand=0, quantity_reserved=0 WHERE tenant_id=:tenant_id"),
            {"tenant_id": tenant_id},
        )

    record_audit(
        db,
        tenant_id=tenant_id,
        actor_user_id=actor_user_id,
        action="super_admin_company_reset",
        entity_type="tenant",
        entity_id=tenant_id,
        sections=sections,
        deleted=deleted,
        total_records=preview["total_records"],
        products_preserved=True,
    )
    await db.commit()
    return {**preview, "deleted": deleted, "completed": True}
