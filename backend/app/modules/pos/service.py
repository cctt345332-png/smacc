"""
خدمة نقطة البيع (POS) — مبنية من الصفر
متوافقة مع جميع الأنشطة ومرتبطة بها بشكل صحيح
"""
import uuid
import base64
import logging
import re
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.pos import (
    POSTerminal, POSSession, POSTransaction, POSTransactionLine, POSCashOutflow,
    POS_PURCHASE_ACTIVITIES, ACTIVITY_CONFIG,
)
from app.models.pos_maintenance import POSMaintenanceTicket, POSMaintenancePart

# قيم الحالة كـ strings مباشرة (متوافقة مع الـ DB)
SESSION_OPEN   = "open"
SESSION_CLOSED = "closed"
TX_COMPLETED   = "completed"
TX_CANCELLED   = "cancelled"
TX_REFUNDED    = "refunded"

logger = logging.getLogger(__name__)


async def _validate_customer_account_parent(db: AsyncSession, tenant_id: str, account_id: str | None):
    if not account_id:
        return None
    from app.models.accounting import Account
    account = await db.get(Account, account_id)
    if not account or account.tenant_id != tenant_id or not account.is_active:
        raise HTTPException(400, "حساب العملاء الرئيسي غير موجود أو غير فعال")
    account_type = getattr(account.account_type, "value", account.account_type)
    nature = getattr(account.nature, "value", account.nature)
    if account_type != "asset" or nature != "debit":
        raise HTTPException(400, "يجب اختيار حساب عملاء مدين ضمن الأصول")
    return account


def _validate_close_pin(pin: str | None) -> str:
    value = str(pin or "")
    if not re.fullmatch(r"\d{4}", value):
        raise HTTPException(400, "كلمة مرور إغلاق الجلسة يجب أن تكون 4 أرقام")
    return value


# ─── Helpers ─────────────────────────────────────────────────────────

def _qr_tlv(seller: str, vat: str, ts: str, total: Decimal, vat_amt: Decimal) -> str:
    def tlv(tag: int, val: str) -> bytes:
        v = val.encode("utf-8")
        return bytes([tag, len(v)]) + v
    data = tlv(1, seller) + tlv(2, vat or "") + tlv(3, ts) + tlv(4, str(total)) + tlv(5, str(vat_amt))
    return base64.b64encode(data).decode("utf-8")


async def _next_tx_number(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(
        select(func.count(POSTransaction.id)).where(POSTransaction.tenant_id == tenant_id)
    )
    return f"POS-{str((r.scalar() or 0) + 1).zfill(6)}"


# ─── Terminals ───────────────────────────────────────────────────────

async def get_terminals(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(POSTerminal)
        .where(POSTerminal.tenant_id == tenant_id, POSTerminal.is_active == True)
        .order_by(POSTerminal.name)
    )
    terminals = r.scalars().all()
    # إضافة بيانات النشاط لكل جهاز
    result = []
    for t in terminals:
        cfg = ACTIVITY_CONFIG.get(t.business_type, ACTIVITY_CONFIG["general"])
        result.append({
            "id": t.id,
            "tenant_id": t.tenant_id,
            "name": t.name,
            "branch_name": t.branch_name,
            "business_type": t.business_type,
            "business_type_label": cfg["label_ar"],
            "activity_icon": cfg["icon"],
            "activity_color": cfg["color"],
            "allow_purchase": t.allow_purchase,
            "warehouse_id": t.warehouse_id,
            "maintenance_warehouse_id": t.maintenance_warehouse_id,
            "treasury_id": t.treasury_id,
            "cash_account_id": t.cash_account_id,
            "sales_account_id": t.sales_account_id,
            "vat_account_id": t.vat_account_id,
            "bank_account_id": t.bank_account_id,
            "card_settlement_account_id": t.card_settlement_account_id,
            "tabby_account_id": t.tabby_account_id,
            "tamara_account_id": t.tamara_account_id,
            "bank_transfer_account_id": t.bank_transfer_account_id,
            "customer_account_parent_id": t.customer_account_parent_id,
            "maintenance_customer_account_parent_id": t.maintenance_customer_account_parent_id,
            "fiscal_year_id": t.fiscal_year_id,
            "receipt_header": t.receipt_header,
            "receipt_footer": t.receipt_footer,
            "print_receipt": t.print_receipt,
            "allow_discount": t.allow_discount,
            "max_discount_pct": float(t.max_discount_pct),
            "is_active": t.is_active,
            "created_at": t.created_at.isoformat(),
        })
    return result


async def get_terminal_by_user(db: AsyncSession, tenant_id: str, user_id: str):
    """جلب الجهاز المخصص لمستخدم معين"""
    r = await db.execute(
        select(POSTerminal).where(
            POSTerminal.tenant_id == tenant_id,
            POSTerminal.assigned_user_id == user_id,
            POSTerminal.is_active == True,
        )
    )
    t = r.scalar_one_or_none()
    if not t:
        return None
    cfg = ACTIVITY_CONFIG.get(t.business_type, ACTIVITY_CONFIG["general"])
    return {
        "id": t.id,
        "name": t.name,
        "branch_name": t.branch_name,
        "business_type": t.business_type,
        "activity_label": cfg["label_ar"],
        "activity_color": cfg["color"],
        "allow_purchase": t.allow_purchase,
        "allow_discount": t.allow_discount,
        "max_discount_pct": float(t.max_discount_pct),
        "print_receipt": t.print_receipt,
        "warehouse_id": t.warehouse_id,
        "maintenance_warehouse_id": t.maintenance_warehouse_id,
        "treasury_id": t.treasury_id,
        "customer_account_parent_id": t.customer_account_parent_id,
        "assigned_user_id": t.assigned_user_id,
    }


async def get_terminal_serials(db: AsyncSession, tenant_id: str, terminal_id: str, product_id: str, include_main: bool = False) -> list[dict]:
    """يعرض سيريالات الفرع فقط؛ ويقبل الرئيسي داخليًا لمسح سيريال محدد فقط."""
    from app.models.inventory import InventoryItem, SerialItem, Warehouse
    terminal = await db.get(POSTerminal, terminal_id)
    if not terminal or terminal.tenant_id != tenant_id or not terminal.is_active:
        raise HTTPException(404, "نقطة البيع غير موجودة")
    if not terminal.warehouse_id:
        raise HTTPException(400, "لم يتم ربط نقطة البيع بمستودع الفرع")
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "الصنف غير موجود")
    tracking = item.tracking_type.value if hasattr(item.tracking_type, "value") else str(item.tracking_type)
    if tracking != "serial":
        raise HTTPException(400, "هذا الصنف لا يستخدم السيريال")
    main_result = await db.execute(select(Warehouse).where(
        Warehouse.tenant_id == tenant_id,
        Warehouse.is_default == True,
        Warehouse.is_active == True,
    ).order_by(Warehouse.created_at.asc()).limit(1))
    main = main_result.scalars().first()
    warehouse_ids = [terminal.warehouse_id]
    if include_main and main and main.id not in warehouse_ids:
        warehouse_ids.append(main.id)
    result = await db.execute(select(SerialItem).where(
        SerialItem.product_id == product_id,
        SerialItem.status == "in_stock",
        SerialItem.serial_classification == "sale",
        SerialItem.warehouse_id.in_(warehouse_ids),
    ).order_by(SerialItem.created_at.desc()))
    serials = result.scalars().all()
    names = {terminal.warehouse_id: terminal.branch_name or "مستودع نقطة البيع"}
    if main:
        names[main.id] = main.name_ar
    return [{
        "id": s.id,
        "serial_number": s.serial_number,
        "condition": s.condition,
        "serial_classification": s.serial_classification,
        "classification_reference": s.classification_reference,
        "cost_price": float(s.cost_price),
        "sale_price": float(item.sale_price) if item.sale_price else (float(s.sale_price) if s.sale_price else None),
        "warehouse_id": s.warehouse_id,
        "warehouse_name": names.get(s.warehouse_id, ""),
        "will_transfer_to_terminal": s.warehouse_id != terminal.warehouse_id,
    } for s in serials]


async def create_terminal(db: AsyncSession, tenant_id: str, data: dict) -> dict:
    from app.core.security import hash_password
    close_pin = _validate_close_pin(data.get("close_pin"))
    if data.get("card_settlement_account_id"):
        from app.models.accounting import Account
        account = await db.get(Account, data["card_settlement_account_id"])
        if not account or account.tenant_id != tenant_id or account.account_type != "asset" or not account.is_active or not account.is_posting:
            raise HTTPException(400, "حساب تسوية الشبكة يجب أن يكون حساب أصول تفصيليًا ونشطًا")
    from app.models.accounting import Account
    for key, label in (("tabby_account_id", "تابي"), ("tamara_account_id", "تمارا"), ("bank_transfer_account_id", "التحويل البنكي")):
        if data.get(key):
            account = await db.get(Account, data[key])
            if not account or account.tenant_id != tenant_id or account.account_type != "asset" or not account.is_active or not account.is_posting:
                raise HTTPException(400, f"حساب {label} يجب أن يكون حساب أصول تفصيليًا ونشطًا")
    bt = data.get("business_type", "general")
    cfg = ACTIVITY_CONFIG.get(bt, ACTIVITY_CONFIG["general"])
    treasury_id = data.get("treasury_id") or None
    if treasury_id:
        from app.models.treasury import Treasury
        treasury = await db.scalar(select(Treasury).where(Treasury.id == treasury_id, Treasury.tenant_id == tenant_id, Treasury.is_active.is_(True)))
        if not treasury:
            raise HTTPException(400, "خزينة نقطة البيع غير موجودة أو غير فعالة")
        # الحساب النقدي للجهاز يجب أن يطابق حساب الخزينة فعليًا
        data["cash_account_id"] = treasury.account_id
    allow_purchase = data.get("allow_purchase", bt in POS_PURCHASE_ACTIVITIES)
    maintenance_warehouse_id = data.get("maintenance_warehouse_id") or None
    customer_account_parent = await _validate_customer_account_parent(
        db, tenant_id, data.get("customer_account_parent_id")
    )
    maintenance_customer_account_parent = await _validate_customer_account_parent(
        db, tenant_id, data.get("maintenance_customer_account_parent_id")
    )
    if maintenance_warehouse_id:
        from app.models.inventory import Warehouse
        warehouse = await db.get(Warehouse, maintenance_warehouse_id)
        if not warehouse or warehouse.tenant_id != tenant_id or not warehouse.is_active:
            raise HTTPException(400, "مستودع الصيانة غير موجود أو غير فعال")
    terminal = POSTerminal(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        name=data["name"],
        branch_name=data.get("branch_name"),
        business_type=bt,
        warehouse_id=data.get("warehouse_id"),
        maintenance_warehouse_id=maintenance_warehouse_id,
        treasury_id=treasury_id,
        cash_account_id=data.get("cash_account_id"),
        sales_account_id=data.get("sales_account_id"),
        vat_account_id=data.get("vat_account_id"),
        bank_account_id=data.get("bank_account_id"),
        card_settlement_account_id=data.get("card_settlement_account_id"),
        tabby_account_id=data.get("tabby_account_id"),
        tamara_account_id=data.get("tamara_account_id"),
        bank_transfer_account_id=data.get("bank_transfer_account_id"),
        customer_account_parent_id=customer_account_parent.id if customer_account_parent else None,
        maintenance_customer_account_parent_id=(
            maintenance_customer_account_parent.id if maintenance_customer_account_parent else None
        ),
        fiscal_year_id=data.get("fiscal_year_id"),
        receipt_header=data.get("receipt_header"),
        receipt_footer=data.get("receipt_footer"),
        print_receipt=data.get("print_receipt", True),
        allow_discount=data.get("allow_discount", True),
        max_discount_pct=Decimal(str(data.get("max_discount_pct", 10))),
        allow_purchase=allow_purchase,
        assigned_user_id=data.get("assigned_user_id"),
        close_pin_hash=hash_password(close_pin),
    )
    db.add(terminal)
    await db.commit()
    await db.refresh(terminal)
    return {
        "id": terminal.id,
        "tenant_id": terminal.tenant_id,
        "name": terminal.name,
        "branch_name": terminal.branch_name,
        "business_type": terminal.business_type,
        "business_type_label": cfg["label_ar"],
        "activity_icon": cfg["icon"],
        "activity_color": cfg["color"],
        "allow_purchase": terminal.allow_purchase,
        "warehouse_id": terminal.warehouse_id,
        "maintenance_warehouse_id": terminal.maintenance_warehouse_id,
        "treasury_id": terminal.treasury_id,
        "cash_account_id": terminal.cash_account_id,
        "sales_account_id": terminal.sales_account_id,
        "vat_account_id": terminal.vat_account_id,
        "bank_account_id": terminal.bank_account_id,
        "card_settlement_account_id": terminal.card_settlement_account_id,
        "tabby_account_id": terminal.tabby_account_id,
        "tamara_account_id": terminal.tamara_account_id,
        "bank_transfer_account_id": terminal.bank_transfer_account_id,
        "customer_account_parent_id": terminal.customer_account_parent_id,
        "maintenance_customer_account_parent_id": terminal.maintenance_customer_account_parent_id,
        "fiscal_year_id": terminal.fiscal_year_id,
        "receipt_header": terminal.receipt_header,
        "receipt_footer": terminal.receipt_footer,
        "print_receipt": terminal.print_receipt,
        "allow_discount": terminal.allow_discount,
        "max_discount_pct": float(terminal.max_discount_pct),
        "is_active": terminal.is_active,
        "created_at": terminal.created_at.isoformat(),
    }


async def update_terminal(db: AsyncSession, tenant_id: str, terminal_id: str, data: dict) -> dict:
    t = await db.get(POSTerminal, terminal_id)
    if not t or t.tenant_id != tenant_id:
        raise HTTPException(404, "Terminal not found")
    if data.get("treasury_id"):
        from app.models.treasury import Treasury
        treasury = await db.scalar(select(Treasury).where(Treasury.id == data["treasury_id"], Treasury.tenant_id == tenant_id, Treasury.is_active.is_(True)))
        if not treasury:
            raise HTTPException(400, "خزينة نقطة البيع غير موجودة أو غير فعالة")
        data["cash_account_id"] = treasury.account_id
    if data.get("card_settlement_account_id"):
        from app.models.accounting import Account
        account = await db.get(Account, data["card_settlement_account_id"])
        if not account or account.tenant_id != tenant_id or account.account_type != "asset" or not account.is_active or not account.is_posting:
            raise HTTPException(400, "حساب تسوية الشبكة يجب أن يكون حساب أصول تفصيليًا ونشطًا")
    from app.models.accounting import Account
    for key, label in (("tabby_account_id", "تابي"), ("tamara_account_id", "تمارا"), ("bank_transfer_account_id", "التحويل البنكي")):
        if data.get(key):
            account = await db.get(Account, data[key])
            if not account or account.tenant_id != tenant_id or account.account_type != "asset" or not account.is_active or not account.is_posting:
                raise HTTPException(400, f"حساب {label} يجب أن يكون حساب أصول تفصيليًا ونشطًا")
    if "maintenance_warehouse_id" in data and data.get("maintenance_warehouse_id"):
        from app.models.inventory import Warehouse
        warehouse = await db.get(Warehouse, data["maintenance_warehouse_id"])
        if not warehouse or warehouse.tenant_id != tenant_id or not warehouse.is_active:
            raise HTTPException(400, "مستودع الصيانة غير موجود أو غير فعال")
    if "customer_account_parent_id" in data:
        customer_account_parent = await _validate_customer_account_parent(
            db, tenant_id, data.get("customer_account_parent_id")
        )
    else:
        customer_account_parent = None
    if "maintenance_customer_account_parent_id" in data:
        maintenance_customer_account_parent = await _validate_customer_account_parent(
            db, tenant_id, data.get("maintenance_customer_account_parent_id")
        )
    else:
        maintenance_customer_account_parent = None
    allowed = [
        "name", "branch_name", "business_type", "warehouse_id", "maintenance_warehouse_id", "treasury_id",
        "cash_account_id", "sales_account_id", "vat_account_id",
        "bank_account_id", "card_settlement_account_id", "tabby_account_id", "tamara_account_id", "bank_transfer_account_id", "fiscal_year_id",
        "customer_account_parent_id",
        "maintenance_customer_account_parent_id",
        "receipt_header", "receipt_footer", "print_receipt",
        "allow_discount", "max_discount_pct", "allow_purchase", "is_active",
        "assigned_user_id",
    ]
    for k in allowed:
        if k == "maintenance_warehouse_id" and k in data:
            setattr(t, k, data[k] or None)
        elif k == "customer_account_parent_id" and k in data:
            setattr(t, k, data[k] or None)
        elif k == "maintenance_customer_account_parent_id" and k in data:
            setattr(t, k, data[k] or None)
        elif k == "treasury_id" and k in data:
            setattr(t, k, data[k] or None)
        elif k in data and data[k] is not None:
            setattr(t, k, data[k])
    if data.get("close_pin"):
        from app.core.security import hash_password
        t.close_pin_hash = hash_password(_validate_close_pin(data["close_pin"]))
    # إذا تغيّر النشاط، حدّث allow_purchase تلقائياً
    if "business_type" in data:
        bt = data["business_type"]
        if "allow_purchase" not in data:
            t.allow_purchase = bt in POS_PURCHASE_ACTIVITIES
    await db.commit()
    await db.refresh(t)
    cfg = ACTIVITY_CONFIG.get(t.business_type, ACTIVITY_CONFIG["general"])
    return {
        "id": t.id,
        "tenant_id": t.tenant_id,
        "name": t.name,
        "branch_name": t.branch_name,
        "business_type": t.business_type,
        "business_type_label": cfg["label_ar"],
        "activity_icon": cfg["icon"],
        "activity_color": cfg["color"],
        "allow_purchase": t.allow_purchase,
        "warehouse_id": t.warehouse_id,
        "maintenance_warehouse_id": t.maintenance_warehouse_id,
        "treasury_id": t.treasury_id,
        "cash_account_id": t.cash_account_id,
        "sales_account_id": t.sales_account_id,
        "vat_account_id": t.vat_account_id,
        "bank_account_id": t.bank_account_id,
        "card_settlement_account_id": t.card_settlement_account_id,
        "tabby_account_id": t.tabby_account_id,
        "tamara_account_id": t.tamara_account_id,
        "bank_transfer_account_id": t.bank_transfer_account_id,
        "customer_account_parent_id": t.customer_account_parent_id,
        "maintenance_customer_account_parent_id": t.maintenance_customer_account_parent_id,
        "fiscal_year_id": t.fiscal_year_id,
        "receipt_header": t.receipt_header,
        "receipt_footer": t.receipt_footer,
        "print_receipt": t.print_receipt,
        "allow_discount": t.allow_discount,
        "max_discount_pct": float(t.max_discount_pct),
        "is_active": t.is_active,
        "created_at": t.created_at.isoformat(),
    }


async def delete_terminal(db: AsyncSession, tenant_id: str, terminal_id: str):
    t = await db.get(POSTerminal, terminal_id)
    if not t or t.tenant_id != tenant_id:
        raise HTTPException(404, "Terminal not found")
    t.is_active = False
    await db.commit()
    return {"message": "تم حذف الجهاز"}


# ─── Sessions ────────────────────────────────────────────────────────

async def get_sessions(db: AsyncSession, tenant_id: str, terminal_id: str | None = None, limit: int = 50):
    q = (
        select(POSSession)
        .options(selectinload(POSSession.terminal))
        .join(POSTerminal, POSTerminal.id == POSSession.terminal_id)
        .where(POSSession.tenant_id == tenant_id)
        # لا نعرض جلسة مفتوحة لجهاز حُذف/عُطّل، مع إبقاء الجلسات المغلقة كسجل تاريخي.
        .where(or_(POSSession.status != SESSION_OPEN, POSTerminal.is_active == True))
    )
    if terminal_id:
        q = q.where(POSSession.terminal_id == terminal_id)
    q = q.order_by(POSSession.opened_at.desc()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


async def get_active_session(db: AsyncSession, tenant_id: str, terminal_id: str) -> POSSession | None:
    from sqlalchemy import cast, Text
    r = await db.execute(
        select(POSSession).join(POSTerminal, POSTerminal.id == POSSession.terminal_id).where(
            POSSession.tenant_id == tenant_id,
            POSSession.terminal_id == terminal_id,
            POSTerminal.is_active == True,
            cast(POSSession.status, Text) == "open",
        )
    )
    return r.scalar_one_or_none()


async def open_session(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> POSSession:
    terminal_id = data["terminal_id"]

    # التحقق من الجهاز
    terminal = await db.get(POSTerminal, terminal_id)
    if not terminal or terminal.tenant_id != tenant_id or not terminal.is_active:
        raise HTTPException(404, "الجهاز غير موجود")

    # التحقق من عدم وجود جلسة مفتوحة
    existing = await get_active_session(db, tenant_id, terminal_id)
    if existing:
        raise HTTPException(400, "يوجد جلسة مفتوحة بالفعل لهذا الجهاز")

    opening_cash = Decimal(str(data.get("opening_cash", 0)))
    if opening_cash < 0:
        raise HTTPException(400, "رصيد الافتتاح لا يمكن أن يكون سالبًا")

    session = POSSession(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        terminal_id=terminal_id,
        cashier_id=user_id,
        opening_cash=opening_cash,
        status="open",
        opened_at=datetime.utcnow(),
        notes=data.get("notes"),
    )
    db.add(session)

    # الرصيد الافتتاحي ليس مبيعات؛ يُثبت كقيد مستقل: مدين صندوق الجهاز
    # ودائن رأس المال/الأرصدة الافتتاحية، حتى يظهر في دفتر الأستاذ وفي تقرير الإغلاق.
    if opening_cash > 0:
        from app.models.accounting import Account, FiscalYear, FiscalYearStatus, JournalEntry, JournalEntryLine, JournalEntryStatus
        from app.modules.accounting.service import get_operational_account

        cash_account = await db.get(Account, terminal.cash_account_id) if terminal.cash_account_id else None
        if not cash_account or cash_account.tenant_id != tenant_id or not cash_account.is_active or not cash_account.is_posting:
            raise HTTPException(409, "اربط حساب صندوق نشط وقابل للقيد بجهاز نقطة البيع قبل إدخال رصيد افتتاحي")
        try:
            capital_account = await get_operational_account(db, tenant_id, "capital")
        except HTTPException:
            raise HTTPException(409, "حساب حقوق الملكية/الأرصدة الافتتاحية غير مهيأ في ربط الحسابات")
        fiscal_id = terminal.fiscal_year_id
        if fiscal_id:
            fiscal = await db.get(FiscalYear, fiscal_id)
        else:
            fiscal = await db.scalar(select(FiscalYear).where(
                FiscalYear.tenant_id == tenant_id,
                FiscalYear.status == FiscalYearStatus.OPEN,
            ).order_by(FiscalYear.start_date).limit(1))
        if not fiscal:
            raise HTTPException(409, "لا توجد سنة مالية مفتوحة لقيد رصيد افتتاح نقطة البيع")
        entry_id = str(uuid.uuid4())
        db.add(JournalEntry(
            id=entry_id, tenant_id=tenant_id,
            entry_number=f"POS-OPEN-{session.id[:8].upper()}",
            entry_date=datetime.utcnow(), fiscal_year_id=fiscal.id,
            description_ar=f"رصيد افتتاح صندوق نقطة البيع: {terminal.name}",
            description_en=f"POS opening cash: {terminal.name}",
            status=JournalEntryStatus.POSTED, reference=session.id,
            source="pos_opening", total_debit=opening_cash, total_credit=opening_cash,
            created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow(),
        ))
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry_id, account_id=cash_account.id,
            description=f"رصيد افتتاح صندوق {terminal.name}", debit=opening_cash,
            credit=Decimal("0"), line_order=0,
        ))
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry_id, account_id=capital_account.id,
            description="مقابل رصيد افتتاح نقطة البيع", debit=Decimal("0"),
            credit=opening_cash, line_order=1,
        ))

    await db.commit()
    await db.refresh(session)
    return session


async def close_session(db: AsyncSession, tenant_id: str, session_id: str, data: dict) -> dict:
    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id:
        raise HTTPException(404, "الجلسة غير موجودة")
    if session.status != "open":
        raise HTTPException(400, "الجلسة مغلقة بالفعل")
    terminal = await db.get(POSTerminal, session.terminal_id)
    if not terminal or not terminal.close_pin_hash:
        raise HTTPException(409, "لم يتم تعيين كلمة مرور إغلاق لهذا الجهاز؛ اطلب من المدير إعدادها")
    from app.core.security import verify_password
    if not verify_password(str(data.get("close_pin") or ""), terminal.close_pin_hash):
        raise HTTPException(403, "كلمة مرور إغلاق الجلسة غير صحيحة")

    closing_cash = Decimal(str(data.get("closing_cash", 0)))
    outflows_total = await db.scalar(
        select(func.coalesce(func.sum(POSCashOutflow.amount), 0)).where(
            POSCashOutflow.session_id == session.id,
            POSCashOutflow.tenant_id == tenant_id,
        )
    ) or Decimal("0")
    maintenance_paid = await db.scalar(
        select(func.coalesce(func.sum(POSMaintenanceTicket.paid_amount), 0)).where(
            POSMaintenanceTicket.session_id == session.id,
            POSMaintenanceTicket.tenant_id == tenant_id,
        )
    ) or Decimal("0")
    maintenance_parts_total = await db.scalar(
        select(func.coalesce(func.sum(POSMaintenancePart.quantity * POSMaintenancePart.unit_price), 0))
        .join(POSMaintenanceTicket, POSMaintenanceTicket.id == POSMaintenancePart.ticket_id)
        .where(
            POSMaintenanceTicket.session_id == session.id,
            POSMaintenanceTicket.tenant_id == tenant_id,
        )
    ) or Decimal("0")
    maintenance_total_approved = await db.scalar(
        select(func.coalesce(func.sum(POSMaintenanceTicket.approved_cost), 0)).where(
            POSMaintenanceTicket.session_id == session.id,
            POSMaintenanceTicket.tenant_id == tenant_id,
        )
    ) or Decimal("0")
    maintenance_fees = max(
        Decimal("0"),
        Decimal(str(maintenance_total_approved)) - Decimal(str(maintenance_parts_total)),
    )
    expected = session.opening_cash + session.total_cash + Decimal(str(maintenance_paid)) - Decimal(str(outflows_total))
    difference = closing_cash - expected

    session.closing_cash = closing_cash
    session.expected_cash = expected
    session.status = "closed"
    session.closed_at = datetime.utcnow()
    session.notes = data.get("notes") or session.notes

    await db.commit()
    await db.refresh(session)

    return {
        "session_id": session.id,
        "terminal_id": session.terminal_id,
        "opened_at": session.opened_at.isoformat(),
        "closed_at": session.closed_at.isoformat(),
        "opening_cash": float(session.opening_cash),
        "closing_cash": float(closing_cash),
        "expected_cash": float(expected),
        "difference": float(difference),
        "total_sales": float(session.total_sales),
        "total_cash": float(session.total_cash),
        "total_card": float(session.total_card),
        "total_tabby": float(session.total_tabby),
        "total_tamara": float(session.total_tamara),
        "total_bank_transfer": float(session.total_bank_transfer),
        "total_cash_outflows": float(outflows_total),
        "total_maintenance_paid": float(maintenance_paid),
        "total_maintenance_parts": float(maintenance_parts_total),
        "total_maintenance_fees": float(maintenance_fees),
        "total_vat": float(session.total_vat),
        "transaction_count": session.transaction_count,
        "status": "closed",
    }


async def create_pos_receipt(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> dict:
    """إنشاء سند قبض من جهاز POS وربطه بالجلسة والخزينة وحساب العميل."""
    from app.models.accounting import Account, FiscalYear, FiscalYearStatus, JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.models.sales import Customer, Invoice, InvoiceStatus, Payment, PaymentMethod
    from app.models.treasury import Treasury, Voucher, VoucherType, VoucherStatus
    from app.modules.sales.orders_service import get_customer_statement
    from app.modules.sales.service import _next_payment_number
    from app.modules.treasury.service import _next_number as next_voucher_number

    session_id = str(data.get("session_id") or "")
    customer_id = str(data.get("customer_id") or "")
    if not session_id or not customer_id:
        raise HTTPException(400, "الجلسة والعميل مطلوبان لإنشاء سند القبض")
    try:
        amount = Decimal(str(data.get("amount"))).quantize(Decimal("0.01"))
    except Exception as exc:
        raise HTTPException(400, "مبلغ سند القبض غير صحيح") from exc
    if amount <= 0:
        raise HTTPException(400, "مبلغ سند القبض يجب أن يكون أكبر من صفر")

    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id or session.status != SESSION_OPEN:
        raise HTTPException(400, "الجلسة غير موجودة أو مغلقة")
    terminal = await db.get(POSTerminal, session.terminal_id)
    if not terminal or terminal.tenant_id != tenant_id:
        raise HTTPException(404, "جهاز نقطة البيع غير موجود")
    if not terminal.customer_account_parent_id:
        raise HTTPException(409, "لم يتم إعداد حساب عملاء نقطة البيع لهذا الجهاز")

    customer = await db.get(Customer, customer_id)
    if not customer or customer.tenant_id != tenant_id or not customer.is_active or not customer.ar_account_id:
        raise HTTPException(404, "العميل غير موجود أو غير مرتبط بحساب مدين")
    accounts = (await db.execute(select(Account.id, Account.parent_id).where(Account.tenant_id == tenant_id))).all()
    parent_by_id = {account_id: parent_id for account_id, parent_id in accounts}
    current, visited, belongs = customer.ar_account_id, set(), False
    while current and current not in visited:
        if current == terminal.customer_account_parent_id:
            belongs = True
            break
        visited.add(current)
        current = parent_by_id.get(current)
    if not belongs:
        raise HTTPException(403, "هذا العميل غير تابع لحساب عملاء جهاز نقطة البيع")

    method = str(data.get("payment_method") or "cash")
    method_map = {
        "cash": PaymentMethod.CASH,
        "mada": PaymentMethod.MADA,
        "credit_card": PaymentMethod.CREDIT_CARD,
        "stc_pay": PaymentMethod.STC_PAY,
        "bank_transfer": PaymentMethod.BANK_TRANSFER,
    }
    payment_method = method_map.get(method)
    if not payment_method:
        raise HTTPException(400, "طريقة الدفع غير مدعومة لسند قبض POS")

    payment_date = datetime.utcnow()
    invoice = None
    if data.get("invoice_id"):
        invoice = await db.get(Invoice, data["invoice_id"])
        if not invoice or invoice.tenant_id != tenant_id or invoice.customer_id != customer.id:
            raise HTTPException(400, "الفاتورة لا تتبع العميل المختار")
        if invoice.status == InvoiceStatus.CANCELLED:
            raise HTTPException(400, "لا يمكن التحصيل من فاتورة ملغاة")
        remaining = Decimal(str(invoice.total or 0)) - Decimal(str(invoice.paid_amount or 0))
        if amount > remaining + Decimal("0.01"):
            raise HTTPException(400, f"المبلغ أكبر من المتبقي على الفاتورة ({remaining:.2f})")
    else:
        statement = await get_customer_statement(db, tenant_id, customer.id, datetime(1970, 1, 1), payment_date)
        balance_due = Decimal(str(statement["summary"].get("closing_balance") or 0))
        if balance_due <= Decimal("0.01"):
            raise HTTPException(400, "لا يوجد رصيد مستحق على هذا العميل")
        if amount > balance_due + Decimal("0.01"):
            raise HTTPException(400, f"المبلغ أكبر من رصيد العميل ({balance_due:.2f})")

    fiscal = await db.get(FiscalYear, terminal.fiscal_year_id) if terminal.fiscal_year_id else None
    if not fiscal:
        fiscal = await db.scalar(select(FiscalYear).where(
            FiscalYear.tenant_id == tenant_id, FiscalYear.status == FiscalYearStatus.OPEN,
            FiscalYear.start_date <= payment_date, FiscalYear.end_date >= payment_date,
        ).order_by(FiscalYear.is_default.desc(), FiscalYear.start_date.desc()).limit(1))
    if not fiscal or fiscal.status != FiscalYearStatus.OPEN:
        raise HTTPException(409, "لا توجد سنة مالية مفتوحة لسند القبض")

    treasury_id = None
    if method == "cash":
        if not terminal.treasury_id:
            raise HTTPException(409, "اربط جهاز نقطة البيع بخزينة درج أولاً")
        treasury = await db.scalar(select(Treasury).where(
            Treasury.id == terminal.treasury_id, Treasury.tenant_id == tenant_id, Treasury.is_active.is_(True)
        ))
        if not treasury:
            raise HTTPException(409, "خزينة درج جهاز نقطة البيع غير موجودة أو غير فعالة")
        debit_account = await db.get(Account, treasury.account_id)
        treasury_id = treasury.id
    else:
        account_id = terminal.card_settlement_account_id if method in {"mada", "credit_card", "stc_pay"} else terminal.bank_transfer_account_id
        debit_account = await db.get(Account, account_id) if account_id else None
    if not debit_account or debit_account.tenant_id != tenant_id or not debit_account.is_active or not debit_account.is_posting:
        raise HTTPException(409, "حساب طريقة الدفع غير مهيأ لجهاز نقطة البيع")

    payment_number = await _next_payment_number(db, tenant_id)
    payment = Payment(
        id=str(uuid.uuid4()), tenant_id=tenant_id, payment_number=payment_number,
        payment_type="receipt", status="posted", invoice_id=invoice.id if invoice else None,
        customer_id=customer.id, payment_date=payment_date, amount=amount,
        payment_method=payment_method, reference=data.get("reference"),
        notes=data.get("notes") or f"تحصيل من نقطة البيع {terminal.name}", created_by=user_id,
        pos_session_id=session.id, pos_terminal_id=terminal.id,
    )
    db.add(payment)
    if invoice:
        invoice.paid_amount = Decimal(str(invoice.paid_amount or 0)) + amount
        remaining = Decimal(str(invoice.total or 0)) - invoice.paid_amount
        invoice.status = InvoiceStatus.PAID if remaining <= Decimal("0.01") else InvoiceStatus.PARTIAL

    entry_id = str(uuid.uuid4())
    entry = JournalEntry(
        id=entry_id, tenant_id=tenant_id, entry_number=f"POS-RC-{payment_number}", entry_date=payment_date,
        fiscal_year_id=fiscal.id, description_ar=f"سند قبض POS {payment_number} — {customer.name_ar}",
        description_en=f"POS receipt {payment_number} — {customer.name_ar}", status=JournalEntryStatus.POSTED,
        source="pos_receipt", reference=payment_number, total_debit=amount, total_credit=amount,
        created_by=user_id, posted_by=user_id, posted_at=payment_date,
    )
    db.add(entry)
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry_id, account_id=debit_account.id,
                            description=f"تحصيل {payment_number} — {method}", debit=amount, credit=Decimal("0"), line_order=0))
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry_id, account_id=customer.ar_account_id,
                            description=f"تسوية رصيد العميل {customer.name_ar}", debit=Decimal("0"), credit=amount, line_order=1))
    payment.journal_entry_id = entry_id
    voucher = Voucher(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        voucher_number=await next_voucher_number(db, tenant_id, VoucherType.RECEIPT),
        voucher_type=VoucherType.RECEIPT, status=VoucherStatus.POSTED, voucher_date=payment_date,
        amount=amount, vat_amount=Decimal("0"), currency_code="SAR", payment_method=payment_method,
        treasury_id=treasury_id, party_type="customer", party_id=customer.id, party_name=customer.name_ar,
        invoice_id=invoice.id if invoice else None, debit_account_id=debit_account.id,
        credit_account_id=customer.ar_account_id, fiscal_year_id=fiscal.id, journal_entry_id=entry_id,
        description_ar=f"سند قبض POS {payment_number} — {customer.name_ar}",
        description_en=f"POS receipt {payment_number} — {customer.name_ar}", reference=payment_number,
        notes=data.get("notes"), created_by=user_id, posted_by=user_id, posted_at=payment_date,
    )
    db.add(voucher)
    if method == "cash":
        session.total_cash += amount
    elif method in {"mada", "credit_card", "stc_pay"}:
        session.total_card += amount
    else:
        session.total_bank_transfer += amount
    await db.commit()
    await db.refresh(payment)
    return {
        "id": payment.id, "payment_number": payment.payment_number, "voucher_number": voucher.voucher_number,
        "customer_id": customer.id, "customer_name": customer.name_ar, "invoice_id": invoice.id if invoice else None,
        "amount": float(amount), "payment_method": method, "session_id": session.id, "treasury_id": treasury_id,
        "journal_entry_id": entry_id, "payment_date": payment_date.isoformat(),
    }


async def get_session_by_id(db: AsyncSession, tenant_id: str, session_id: str) -> POSSession:
    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id:
        raise HTTPException(404, "الجلسة غير موجودة")
    return session


async def get_session_report(db: AsyncSession, tenant_id: str, session_id: str) -> dict:
    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id:
        raise HTTPException(404, "الجلسة غير موجودة")

    txs_r = await db.execute(
        select(POSTransaction)
        .options(selectinload(POSTransaction.lines))
        .where(
            POSTransaction.session_id == session_id,
            POSTransaction.status == "completed",
        )
        .order_by(POSTransaction.created_at)
    )
    txs = txs_r.scalars().all()

    outflows_r = await db.execute(
        select(POSCashOutflow)
        .where(POSCashOutflow.session_id == session_id, POSCashOutflow.tenant_id == tenant_id)
        .order_by(POSCashOutflow.created_at)
    )
    outflows = outflows_r.scalars().all()
    outflows_total = sum((Decimal(str(item.amount)) for item in outflows), Decimal("0"))
    maintenance_rows = (await db.execute(
        select(POSMaintenanceTicket).where(
            POSMaintenanceTicket.session_id == session.id,
            POSMaintenanceTicket.tenant_id == tenant_id,
        ).order_by(POSMaintenanceTicket.created_at)
    )).scalars().all()
    maintenance_paid = sum((Decimal(str(row.paid_amount or 0)) for row in maintenance_rows), Decimal("0"))
    maintenance_parts_total = await db.scalar(
        select(func.coalesce(func.sum(POSMaintenancePart.quantity * POSMaintenancePart.unit_price), 0))
        .join(POSMaintenanceTicket, POSMaintenanceTicket.id == POSMaintenancePart.ticket_id)
        .where(
            POSMaintenanceTicket.session_id == session.id,
            POSMaintenanceTicket.tenant_id == tenant_id,
        )
    ) or Decimal("0")
    maintenance_fees = max(
        Decimal("0"),
        sum((Decimal(str(row.approved_cost or 0)) for row in maintenance_rows), Decimal("0"))
        - Decimal(str(maintenance_parts_total)),
    )

    by_method: dict[str, float] = {}
    for tx in txs:
        m = tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)
        by_method[m] = by_method.get(m, 0) + float(tx.total)

    return {
        "session": {
            "id": session.id,
            "terminal_id": session.terminal_id,
            "cashier_id": session.cashier_id,
            "status": session.status.value if hasattr(session.status, "value") else session.status,
            "opened_at": session.opened_at.isoformat(),
            "closed_at": session.closed_at.isoformat() if session.closed_at else None,
            "opening_cash": float(session.opening_cash),
            "closing_cash": float(session.closing_cash or 0),
            "expected_cash": float(session.expected_cash if session.expected_cash is not None else (session.opening_cash + session.total_cash + maintenance_paid - outflows_total)),
            "difference": float((session.closing_cash or 0) - (session.expected_cash if session.expected_cash is not None else (session.opening_cash + session.total_cash + maintenance_paid - outflows_total))),
            "total_sales": float(session.total_sales),
            "total_cash": float(session.total_cash),
            "total_card": float(session.total_card),
            "total_tabby": float(session.total_tabby),
            "total_tamara": float(session.total_tamara),
        "total_bank_transfer": float(session.total_bank_transfer),
            "total_vat": float(session.total_vat),
            "transaction_count": session.transaction_count,
            "total_cash_outflows": float(outflows_total),
            "total_maintenance_paid": float(maintenance_paid),
            "total_maintenance_parts": float(maintenance_parts_total),
            "total_maintenance_fees": float(maintenance_fees),
            "maintenance_count": len(maintenance_rows),
        },
        "by_payment_method": by_method,
        "cash_outflows": [
            {
                "id": item.id,
                "outflow_type": item.outflow_type,
                "amount": float(item.amount),
                "description": item.description,
                "journal_entry_id": item.journal_entry_id,
                "created_at": item.created_at.isoformat(),
            }
            for item in outflows
        ],
        "maintenance": [
            {
                "id": row.id,
                "ticket_number": row.ticket_number,
                "customer_name": row.customer_name,
                "device_name": row.device_name,
                "status": row.status,
                "approved_cost": float(row.approved_cost or 0),
                "paid_amount": float(row.paid_amount or 0),
                "outstanding": float(max(Decimal("0"), Decimal(str(row.approved_cost or 0)) - Decimal(str(row.paid_amount or 0)))),
                "created_at": row.created_at.isoformat(),
            }
            for row in maintenance_rows
        ],
        "transactions": [
            {
                "id": tx.id,
                "transaction_number": tx.transaction_number,
                "total": float(tx.total),
                # حالة تنفيذ العملية ليست حالة التحصيل؛ الدفع الجزئي يجب أن
                # يبقى ظاهرًا كجزئي في تقرير الجلسة والفاتورة المرتبطة.
                "paid_amount": float(min(
                    Decimal(str(tx.total or 0)),
                    (Decimal(str(tx.cash_tendered or 0)) if (tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)) in ("cash", "split") else Decimal("0"))
                    + (Decimal(str(tx.card_amount or 0)) if (tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)) in ("mada", "tabby", "tamara", "bank_transfer", "split") else Decimal("0")),
                )),
                "remaining_amount": float(max(Decimal("0"), Decimal(str(tx.total or 0)) - min(
                    Decimal(str(tx.total or 0)),
                    (Decimal(str(tx.cash_tendered or 0)) if (tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)) in ("cash", "split") else Decimal("0"))
                    + (Decimal(str(tx.card_amount or 0)) if (tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)) in ("mada", "tabby", "tamara", "bank_transfer", "split") else Decimal("0")),
                ))),
                "payment_status": "paid" if (
                    (Decimal(str(tx.cash_tendered or 0)) if (tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)) in ("cash", "split") else Decimal("0"))
                    + (Decimal(str(tx.card_amount or 0)) if (tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)) in ("mada", "tabby", "tamara", "bank_transfer", "split") else Decimal("0"))
                ) >= Decimal(str(tx.total or 0)) - Decimal("0.01") else "partial",
                "vat_amount": float(tx.vat_amount),
                "status": tx.status.value if hasattr(tx.status, "value") else str(tx.status),
                "payment_method": tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method),
                "created_at": tx.created_at.isoformat(),
                "lines_count": len(tx.lines),
            }
            for tx in txs
        ],
    }


# ─── Cash outflows (مخرجات درج الكاشير) ───────────────────────────────
async def create_cash_outflow(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> dict:
    """تسجيل سحب نقدي من درج الجلسة مع قيد مصروف/صندوق مستقل."""
    session_id = str(data.get("session_id") or "")
    outflow_type = str(data.get("outflow_type") or "").strip()
    description = str(data.get("description") or "").strip() or None
    allowed_types = {"donation", "food", "fuel", "delivery", "employee_advance", "other"}
    if outflow_type not in allowed_types:
        raise HTTPException(400, "نوع المخرج النقدي غير صحيح")
    try:
        amount = Decimal(str(data.get("amount")))
    except Exception:
        raise HTTPException(400, "مبلغ المخرج النقدي غير صحيح")
    if amount <= 0:
        raise HTTPException(400, "مبلغ المخرج النقدي يجب أن يكون أكبر من صفر")

    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id:
        raise HTTPException(404, "الجلسة غير موجودة")
    if session.status != SESSION_OPEN:
        raise HTTPException(400, "لا يمكن تسجيل مخرج نقدي لجلسة مغلقة")
    terminal = await db.get(POSTerminal, session.terminal_id)
    if not terminal or terminal.tenant_id != tenant_id:
        raise HTTPException(404, "جهاز نقطة البيع غير موجود")

    existing_total = await db.scalar(
        select(func.coalesce(func.sum(POSCashOutflow.amount), 0)).where(
            POSCashOutflow.session_id == session.id, POSCashOutflow.tenant_id == tenant_id
        )
    ) or Decimal("0")
    available_cash = session.opening_cash + session.total_cash - Decimal(str(existing_total))
    if amount > available_cash:
        raise HTTPException(400, f"المبلغ أكبر من النقد المتاح في الدرج ({available_cash:.2f})")

    from app.models.accounting import Account, FiscalYear, FiscalYearStatus, JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import get_operational_account
    cash_account = await db.get(Account, terminal.cash_account_id) if terminal.cash_account_id else None
    if not cash_account or cash_account.tenant_id != tenant_id or not cash_account.is_active or not cash_account.is_posting:
        raise HTTPException(409, "اربط حساب صندوق نشط وقابل للقيد بجهاز نقطة البيع أولًا")
    # الخرج النقدي يستخدم حساب المصروفات التشغيلية المربوط في دليل الحسابات.
    # other_expense ليس مفتاح ربط معتمدًا في DEFAULT_MAPPING_CODES.
    expense_account = await get_operational_account(db, tenant_id, "operating_expenses")
    fiscal = await db.get(FiscalYear, terminal.fiscal_year_id) if terminal.fiscal_year_id else None
    if not fiscal:
        fiscal = await db.scalar(select(FiscalYear).where(FiscalYear.tenant_id == tenant_id, FiscalYear.status == FiscalYearStatus.OPEN).order_by(FiscalYear.start_date).limit(1))
    if not fiscal:
        raise HTTPException(409, "لا توجد سنة مالية مفتوحة لقيد المخرج النقدي")

    label = {"donation": "صدقة", "food": "مصروف أكل", "fuel": "مصروف بنزين", "delivery": "مصروف توصيل", "employee_advance": "سلفة موظف", "other": "مخرج نقدي آخر"}[outflow_type]
    outflow = POSCashOutflow(
        id=str(uuid.uuid4()), tenant_id=tenant_id, session_id=session.id,
        terminal_id=terminal.id, created_by=user_id, outflow_type=outflow_type,
        amount=amount, description=description,
    )
    entry_id = str(uuid.uuid4())
    db.add(JournalEntry(
        id=entry_id, tenant_id=tenant_id, entry_number=f"POS-OUT-{outflow.id[:8].upper()}",
        entry_date=datetime.utcnow(), fiscal_year_id=fiscal.id,
        description_ar=f"{label} من درج نقطة البيع: {description or ''}".strip(),
        description_en=f"POS cash outflow: {label} {description or ''}".strip(),
        status=JournalEntryStatus.POSTED, reference=outflow.id, source="pos_cash_outflow",
        total_debit=amount, total_credit=amount, created_by=user_id,
        posted_by=user_id, posted_at=datetime.utcnow(),
    ))
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry_id, account_id=expense_account.id, description=label, debit=amount, credit=Decimal("0"), line_order=0))
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry_id, account_id=cash_account.id, description=f"سحب من صندوق {terminal.name}", debit=Decimal("0"), credit=amount, line_order=1))
    outflow.journal_entry_id = entry_id
    db.add(outflow)
    await db.commit()
    await db.refresh(outflow)
    return {"id": outflow.id, "outflow_type": outflow.outflow_type, "amount": float(outflow.amount), "description": outflow.description, "journal_entry_id": outflow.journal_entry_id, "created_at": outflow.created_at.isoformat()}


# ─── Transactions (عمليات البيع) ─────────────────────────────────────

async def create_transaction(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> dict:
    """
    تسجيل عملية بيع في POS
    يدعم: كمية عادية، سيريال، تشغيلة (FEFO)، متغيرات، وزن
    """
    session_id = data["session_id"]

    # التحقق من الجلسة
    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id:
        raise HTTPException(404, "الجلسة غير موجودة")
    if session.status != "open":
        raise HTTPException(400, "الجلسة مغلقة")
    terminal = await db.get(POSTerminal, session.terminal_id)
    if not terminal or terminal.tenant_id != tenant_id:
        raise HTTPException(404, "نقطة البيع غير موجودة")
    if not terminal.warehouse_id:
        raise HTTPException(400, "لم يتم ربط نقطة البيع بمستودع الفرع")

    # جلب بيانات الشركة للـ QR
    from app.models.tenant import Tenant
    from app.modules.accounting.service import get_vat_settings
    tenant = await db.get(Tenant, tenant_id)
    vat_settings = await get_vat_settings(db, tenant_id)
    effective_vat_number = (
        vat_settings.vat_number if vat_settings and vat_settings.vat_number
        else (tenant.vat_number if tenant else "")
    )

    lines_data = data.get("lines", [])
    if not lines_data:
        raise HTTPException(400, "لا توجد أصناف في الفاتورة")

    # حساب الإجماليات
    subtotal = Decimal("0")
    discount_total = Decimal("0")
    vat_total = Decimal("0")
    grand_total = Decimal("0")

    tx_id = str(uuid.uuid4())
    processed_lines = []

    for line in lines_data:
        qty = Decimal(str(line["quantity"]))
        price = Decimal(str(line["unit_price"]))
        disc_pct = Decimal(str(line.get("discount_pct", 0)))
        vat_rate = Decimal(str(line.get("vat_rate", 15)))
        prices_include_vat = bool(line.get("prices_include_vat", True))

        # أسعار البيع المخزنة والمستخدمة في POS شاملة الضريبة.
        gross = qty * price
        disc_amt = (gross * disc_pct / 100).quantize(Decimal("0.01"))
        line_total = gross - disc_amt
        vat_amt = (
            (line_total * vat_rate / (Decimal("100") + vat_rate)).quantize(Decimal("0.01"))
            if prices_include_vat and vat_rate > 0 else
            (line_total * vat_rate / Decimal("100")).quantize(Decimal("0.01"))
            if vat_rate > 0 else Decimal("0")
        )
        taxable = line_total - vat_amt if prices_include_vat else line_total
        if not prices_include_vat:
            line_total = taxable + vat_amt

        subtotal += gross
        discount_total += disc_amt
        vat_total += vat_amt
        grand_total += line_total

        processed_lines.append({
            **line,
            "gross": gross,
            "disc_amt": disc_amt,
            "vat_amt": vat_amt,
            "line_total": line_total,
        })

    # طريقة الدفع
    payment_method = data.get("payment_method", "cash")
    cash_tendered = Decimal(str(data.get("cash_tendered", grand_total)))
    card_amount = Decimal(str(data.get("card_amount", 0)))

    # الخصم الإجمالي على مستوى الفاتورة كاملة
    overall_discount = Decimal(str(data.get("discount_amount", 0)))
    if overall_discount > 0:
        grand_total = max(Decimal("0"), grand_total - overall_discount)
        discount_total += overall_discount

    if payment_method not in {"cash", "mada", "tabby", "tamara", "bank_transfer", "split"}:
        raise HTTPException(400, "طريقة الدفع يجب أن تكون نقدي أو شبكة أو تابي أو تمارا أو تحويل بنكي أو مقسّم")
    has_customer = bool(data.get("customer_id"))
    if payment_method == "cash" and cash_tendered < grand_total and not has_customer:
        raise HTTPException(400, "المبلغ النقدي أقل من إجمالي الفاتورة — اختر عميلاً للدفعة الجزئية")
    if payment_method == "cash" and cash_tendered <= 0:
        raise HTTPException(400, "أدخل مبلغ التحصيل")
    if payment_method in {"mada", "tabby", "tamara", "bank_transfer"}:
        if card_amount <= 0 or card_amount > grand_total + Decimal("0.01") or (card_amount < grand_total and not has_customer):
            raise HTTPException(400, "أدخل دفعة صحيحة — الدفعة الجزئية تتطلب اختيار عميل")
        cash_tendered = Decimal("0")
    if payment_method == "split":
        paid = cash_tendered + card_amount
        if cash_tendered < 0 or card_amount < 0 or paid <= 0 or paid > grand_total + Decimal("0.01") or (paid < grand_total and not has_customer):
            raise HTTPException(400, "يجب أن يساوي الدفع الإجمالي، أو اختر عميلاً للدفعة الجزئية")

    change_amount = max(Decimal("0"), cash_tendered - grand_total) if payment_method == "cash" else Decimal("0")

    # QR Code زاتكا
    qr = _qr_tlv(
        seller=tenant.name if tenant else "",
        vat=effective_vat_number,
        ts=datetime.utcnow().isoformat(),
        total=grand_total,
        vat_amt=vat_total,
    )

    # إنشاء المعاملة
    tx = POSTransaction(
        id=tx_id,
        tenant_id=tenant_id,
        session_id=session_id,
        transaction_number=await _next_tx_number(db, tenant_id),
        customer_id=data.get("customer_id"),
        customer_name=data.get("customer_name"),
        customer_phone=data.get("customer_phone"),
        subtotal=subtotal,
        discount_amount=discount_total,
        vat_amount=vat_total,
        total=grand_total,
        payment_method=payment_method,
        cash_tendered=cash_tendered,
        change_amount=change_amount,
        card_amount=card_amount if payment_method in {"split", "mada", "tabby", "tamara", "bank_transfer"} else None,
        qr_code=qr,
        uuid=str(uuid.uuid4()),
        status="completed",
    )
    db.add(tx)

    # أسطر المعاملة + خصم المخزون
    for i, line in enumerate(processed_lines):
        db.add(POSTransactionLine(
            id=str(uuid.uuid4()),
            transaction_id=tx_id,
            inventory_item_id=line.get("inventory_item_id"),
            product_name_ar=line["product_name_ar"],
            barcode=line.get("barcode"),
            quantity=Decimal(str(line["quantity"])),
            unit_price=Decimal(str(line["unit_price"])),
            discount_pct=Decimal(str(line.get("discount_pct", 0))),
            discount_amount=line["disc_amt"],
            vat_rate=Decimal(str(line.get("vat_rate", 15))),
            vat_amount=line["vat_amt"],
            total=line["line_total"],
            # حقول التتبع الدقيق
            serial_item_id=line.get("serial_item_id"),
            variant_id=line.get("variant_id"),
            batch_id=line.get("batch_id"),
        ))

        # خصم المخزون حسب نوع التتبع
        if line.get("inventory_item_id"):
            await _deduct_inventory(db, tenant_id, user_id, tx_id, line, terminal.warehouse_id)

    # تحديث إجماليات الجلسة
    session.total_sales += grand_total
    session.total_vat += vat_total
    session.transaction_count += 1
    if payment_method in ("cash",):
        # لا يدخل في الخزنة إلا المبلغ المحصل فعليًا؛ المتبقي على العميل
        # لا يُعد نقدًا للجلسة حتى يتم تحصيله لاحقًا.
        session.total_cash += min(cash_tendered, grand_total)
    elif payment_method in ("mada", "credit_card", "stc_pay"):
        session.total_card += min(card_amount, grand_total)
    elif payment_method == "tabby":
        session.total_tabby += min(card_amount, grand_total)
    elif payment_method == "tamara":
        session.total_tamara += min(card_amount, grand_total)
    elif payment_method == "bank_transfer":
        session.total_bank_transfer += min(card_amount, grand_total)
    elif payment_method == "split":
        session.total_cash += min(cash_tendered, grand_total)
        session.total_card += min(card_amount, grand_total)

    # إنشاء فاتورة مبسطة تلقائياً
    invoice_id = await _create_pos_invoice(db, tenant_id, user_id, tx, session, tenant, vat_settings)
    if invoice_id:
        tx.invoice_id = invoice_id
    tx.journal_entry_id = await _create_pos_journal(db, tenant_id, user_id, tx, terminal, vat_settings, invoice_id)

    await db.commit()
    await db.refresh(tx)

    zatca_result = {"status": "zatca_pending", "reason": "لم تتم محاولة الإبلاغ بعد"}
    if invoice_id:
        from app.modules.zatca_service import submit_invoice_reporting_simulation
        from app.models.sales import Invoice
        try:
            logger.info("POS ZATCA reporting started: transaction=%s invoice=%s", tx.transaction_number, invoice_id)
            zatca_result = await submit_invoice_reporting_simulation(db, tenant_id, user_id, invoice_id)
            invoice = await db.get(Invoice, invoice_id)
            if invoice and tx.qr_code != invoice.qr_code:
                tx.qr_code = invoice.qr_code
                await db.commit()
            logger.info(
                "POS ZATCA reporting finished: transaction=%s invoice=%s status=%s http_status=%s error=%s",
                tx.transaction_number, invoice_id, zatca_result.get("status"),
                zatca_result.get("http_status"), zatca_result.get("error"),
            )
        except Exception as exc:
            invoice = await db.get(Invoice, invoice_id)
            if invoice:
                invoice.zatca_status = "zatca_pending"
                invoice.zatca_response = str(exc)[:10000]
            zatca_result = {"status": "zatca_pending", "reason": str(exc)[:500]}
            logger.exception(
                "POS ZATCA reporting pending: transaction=%s invoice=%s reason=%s",
                tx.transaction_number, invoice_id, exc,
            )
            await db.commit()
    else:
        logger.error(
            "POS invoice was not created; automatic ZATCA reporting skipped: transaction=%s session=%s",
            tx.transaction_number, session.id,
        )
        zatca_result = {"status": "zatca_pending", "reason": "لم يتم إنشاء فاتورة POS؛ تحقق من ربط السنة المالية بجهاز نقطة البيع"}

    return {
        "transaction_id": tx.id,
        "transaction_number": tx.transaction_number,
        "total": float(grand_total),
        "paid_amount": float(min(grand_total, (
            cash_tendered if payment_method in ("cash", "split") else Decimal("0")
        ) + (
            card_amount if payment_method in ("mada", "tabby", "tamara", "bank_transfer", "split") else Decimal("0")
        ))),
        "remaining_amount": float(max(Decimal("0"), grand_total - min(grand_total, (
            cash_tendered if payment_method in ("cash", "split") else Decimal("0")
        ) + (
            card_amount if payment_method in ("mada", "tabby", "tamara", "bank_transfer", "split") else Decimal("0")
        )))),
        "payment_status": "paid" if (
            (cash_tendered if payment_method in ("cash", "split") else Decimal("0"))
            + (card_amount if payment_method in ("mada", "tabby", "tamara", "bank_transfer", "split") else Decimal("0"))
        ) >= grand_total - Decimal("0.01") else "partial",
        "vat_amount": float(vat_total),
        "change_amount": float(change_amount),
        "qr_code": tx.qr_code,
        "invoice_id": invoice_id,
        "status": "completed",
        "zatca": zatca_result,
    }


async def _create_pos_journal(db: AsyncSession, tenant_id: str, user_id: str, tx, terminal, vat_settings, invoice_id: str | None) -> str:
    """قيد POS: النقد للصندوق، والشبكة لحساب التسوية، لا للبنك مباشرة."""
    from app.models.accounting import Account, JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.models.sales import Invoice, Customer
    from app.modules.accounting.service import _next_entry_number, get_operational_account

    cash_account = await db.get(Account, terminal.cash_account_id) if terminal.cash_account_id else None
    if not cash_account:
        cash_account = await get_operational_account(db, tenant_id, "default_cash")
    sales_account = await db.get(Account, terminal.sales_account_id) if terminal.sales_account_id else None
    if not sales_account:
        sales_account = await get_operational_account(db, tenant_id, "sales_goods")
    vat_account = await db.get(Account, terminal.vat_account_id) if terminal.vat_account_id else None
    if not vat_account and vat_settings and vat_settings.vat_account_id:
        vat_account = await db.get(__import__("app.models.accounting", fromlist=["Account"]).Account, vat_settings.vat_account_id)
    if not cash_account or not sales_account or (tx.vat_amount > 0 and not vat_account):
        raise HTTPException(409, "إعداد الحسابات المحاسبية لنقطة البيع غير مكتمل")

    method = tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)
    card_amount = Decimal(str(tx.card_amount or 0)) if method in ("split", "mada", "credit_card", "stc_pay", "tabby", "tamara", "bank_transfer") else Decimal("0")
    cash_amount = min(Decimal(str(tx.cash_tendered or 0)), tx.total) if method in ("cash", "split") else Decimal("0")
    paid_amount = min(tx.total, cash_amount + card_amount)
    receivable_amount = max(Decimal("0"), tx.total - paid_amount)
    settlement_account = None
    if card_amount > 0:
        account_id = terminal.card_settlement_account_id
        if method == "tabby":
            account_id = terminal.tabby_account_id
        elif method == "tamara":
            account_id = terminal.tamara_account_id
        elif method == "bank_transfer":
            account_id = terminal.bank_transfer_account_id
        settlement_account = await db.get(Account, account_id) if account_id else None
        if not settlement_account and method not in ("tabby", "tamara", "bank_transfer"):
            settlement_account = await get_operational_account(db, tenant_id, "default_card")
        if not settlement_account:
            label = "تابي" if method == "tabby" else "تمارا" if method == "tamara" else "التحويل البنكي" if method == "bank_transfer" else "الشبكة/مدى"
            raise HTTPException(409, f"يجب تحديد حساب تسوية {label} من شجرة الحسابات")

    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        entry_number=await _next_entry_number(db, tenant_id),
        entry_date=tx.created_at, fiscal_year_id=terminal.fiscal_year_id,
        description_ar=f"مبيعات نقطة البيع {tx.transaction_number}",
        description_en=f"POS sale {tx.transaction_number}", status=JournalEntryStatus.POSTED,
        source="pos_transaction", reference=tx.transaction_number,
        total_debit=tx.total, total_credit=tx.total,
        created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow(),
    )
    db.add(entry)
    order = 0
    if cash_amount > 0:
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=cash_account.id,
            description=f"نقدية {tx.transaction_number}", debit=cash_amount, credit=0, line_order=order)); order += 1
    if card_amount > 0:
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=settlement_account.id,
            description=f"تسوية شبكة {tx.transaction_number}", debit=card_amount, credit=0, line_order=order)); order += 1
    if receivable_amount > 0 and invoice_id:
        invoice = await db.get(Invoice, invoice_id)
        customer = await db.get(Customer, invoice.customer_id) if invoice else None
        if not customer or not customer.ar_account_id:
            raise HTTPException(409, "لا يوجد حساب عميل لإثبات المبلغ المتبقي")
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=customer.ar_account_id,
            description=f"متبقي على العميل {tx.transaction_number}", debit=receivable_amount, credit=0, line_order=order)); order += 1
    taxable = tx.total - tx.vat_amount
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=sales_account.id,
        description=f"مبيعات {tx.transaction_number}", debit=0, credit=taxable, line_order=order)); order += 1
    if tx.vat_amount > 0:
        db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=vat_account.id,
            description="ضريبة مخرجات POS", debit=0, credit=tx.vat_amount, line_order=order))
    if invoice_id:
        invoice = await db.get(Invoice, invoice_id)
        if invoice:
            invoice.journal_entry_id = entry.id
    return entry.id


async def _deduct_inventory(db: AsyncSession, tenant_id: str, user_id: str, tx_id: str, line: dict, terminal_warehouse_id: str):
    """خصم المخزون حسب نوع التتبع"""
    from app.models.inventory import InventoryItem, SerialItem, Warehouse, StockMovement
    from app.modules.inventory.service import sell_serial, deduct_stock, deduct_batch_fefo

    item = await db.get(InventoryItem, line["inventory_item_id"])
    if not item:
        return

    tracking = item.tracking_type.value if hasattr(item.tracking_type, "value") else str(item.tracking_type)

    if tracking == "serial":
        serial_id = line.get("serial_item_id")
        if serial_id:
            serial_result = await db.execute(select(SerialItem).where(
                SerialItem.id == serial_id,
                SerialItem.product_id == item.id,
            ).with_for_update())
            serial = serial_result.scalar_one_or_none()
            if not serial:
                raise HTTPException(404, "السيريال غير موجود لهذا الصنف")
            if serial.status != "in_stock":
                raise HTTPException(400, f"السيريال {serial.serial_number} غير متاح — الحالة: {serial.status}")
            if serial.warehouse_id != terminal_warehouse_id:
                main_result = await db.execute(select(Warehouse).where(
                    Warehouse.tenant_id == tenant_id,
                    Warehouse.is_default == True,
                    Warehouse.is_active == True,
                ).order_by(Warehouse.created_at.asc()).limit(1))
                main = main_result.scalars().first()
                if not main or serial.warehouse_id != main.id:
                    raise HTTPException(400, f"السيريال {serial.serial_number} ليس في مستودع نقطة البيع ولا المستودع الرئيسي")
                source_warehouse_id = serial.warehouse_id
                serial.warehouse_id = terminal_warehouse_id
                db.add(StockMovement(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    product_id=item.id,
                    warehouse_id=source_warehouse_id,
                    to_warehouse_id=terminal_warehouse_id,
                    movement_type="transfer",
                    quantity=Decimal("1"),
                    unit_cost=serial.cost_price,
                    serial_item_id=serial.id,
                    reference_type="pos_auto_transfer",
                    reference_id=tx_id,
                    notes="تحويل تلقائي من المستودع الرئيسي إلى نقطة البيع قبل البيع",
                    created_by=user_id,
                ))
            await sell_serial(
                db=db, tenant_id=tenant_id,
                serial_id=serial_id,
                sale_price=Decimal(str(line["unit_price"])),
                invoice_id=tx_id,
                warehouse_id=terminal_warehouse_id,
                user_id=user_id,
                auto_commit=False,
            )
    elif tracking == "batch":
        await deduct_batch_fefo(
            db=db, tenant_id=tenant_id,
            product_id=line["inventory_item_id"],
            quantity=Decimal(str(line["quantity"])),
            reference_type="pos",
            reference_id=tx_id,
            user_id=user_id,
            auto_commit=False,
        )
    elif tracking == "variant":
        variant_id = line.get("variant_id")
        if variant_id:
            from app.models.inventory import ProductVariant
            variant = await db.get(ProductVariant, variant_id)
            if variant:
                if variant.quantity < Decimal(str(line["quantity"])):
                    raise HTTPException(400, f"الكمية المتاحة للمتغير غير كافية")
                variant.quantity -= Decimal(str(line["quantity"]))
                item.quantity_on_hand -= Decimal(str(line["quantity"]))
    else:
        # quantity / weight / spare_parts
        await deduct_stock(
            db=db, tenant_id=tenant_id,
            product_id=line["inventory_item_id"],
            quantity=Decimal(str(line["quantity"])),
            warehouse_id=terminal_warehouse_id,
            reference_type="pos",
            reference_id=tx_id,
            user_id=user_id,
            auto_commit=False,
        )


async def _get_or_create_pos_cash_customer(db: AsyncSession, tenant_id: str, user_id: str):
    """يعيد عميل POS النقدي الثابت حتى لا تبقى فاتورة POS بلا customer_id."""
    from app.models.sales import Customer, CustomerType
    from app.models.accounting import Account, AccountType, AccountNature, AccountingAccountMapping
    from app.modules.accounting.service import get_operational_account
    from app.modules.sales.service import _next_customer_account_code

    customer = await db.scalar(select(Customer).where(
        Customer.tenant_id == tenant_id,
        Customer.customer_number == "POS-CASH",
    ))
    if customer:
        return customer

    try:
        parent = await get_operational_account(db, tenant_id, "default_ar")
    except HTTPException:
        # بعض الشركات القديمة تربط default_ar بحساب تجميعي (مثل 01131).
        # هذا الحساب صالح كفرع للشجرة لكنه ليس حساب قيد نهائيًا، لذلك نختار
        # حساب العملاء النهائي النشط تحته ونصحح الربط نفسه بدل إنشاء حساب عشوائي.
        mapping = await db.scalar(select(AccountingAccountMapping).where(
            AccountingAccountMapping.tenant_id == tenant_id,
            AccountingAccountMapping.mapping_key == "default_ar",
        ))
        mapped = await db.get(Account, mapping.account_id) if mapping else None
        candidates = select(Account).where(
            Account.tenant_id == tenant_id,
            Account.is_active.is_(True),
            Account.is_posting.is_(True),
            Account.is_customer_account.is_(True),
            Account.account_type == AccountType.ASSET,
            Account.nature == AccountNature.DEBIT,
        )
        if mapped:
            candidates = candidates.where(
                or_(Account.parent_id == mapped.id, Account.code.startswith(str(mapped.code)))
            )
        parent = (await db.execute(candidates.order_by(Account.code))).scalars().first()
        if parent and mapping:
            mapping.account_id = parent.id
            await db.flush()
    if not parent:
        raise HTTPException(409, "لم يتم إعداد حساب عملاء نهائي نشط لنقاط البيع")

    customer = Customer(
        id=str(uuid.uuid4()), tenant_id=tenant_id, customer_number="POS-CASH",
        customer_type=CustomerType.INDIVIDUAL, name_ar="عميل نقدي POS",
        name_en="POS Cash Customer", vat_number=None, cr_number=None,
        address_country="SA", is_active=True,
    )
    db.add(customer)
    account = Account(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        code=await _next_customer_account_code(db, tenant_id, parent),
        name_ar="عميل نقدي POS", name_en="POS Cash Customer",
        account_type=AccountType.ASSET, nature=AccountNature.DEBIT,
        parent_id=parent.id, level=parent.level + 1, is_active=True,
        is_posting=True, allow_direct_posting=True, is_customer_account=True,
        notes="حساب العميل النقدي الافتراضي لنقاط البيع",
    )
    db.add(account)
    customer.ar_account_id = account.id
    await db.flush()
    return customer


async def _create_pos_invoice(db, tenant_id, user_id, tx, session, tenant, vat_settings) -> str | None:
    """إنشاء فاتورة مبسطة ZATCA تلقائياً عند كل عملية بيع"""
    from app.models.sales import Invoice, InvoiceLine, InvoiceStatus, Payment, PaymentMethod
    from app.modules.sales.service import _next_invoice_number, _next_payment_number

    terminal = await db.get(POSTerminal, session.terminal_id)
    fiscal_year_id = terminal.fiscal_year_id if terminal else None
    if not fiscal_year_id:
        return None

    invoice_id = str(uuid.uuid4())
    now = datetime.utcnow()

    lines_r = await db.execute(
        select(POSTransactionLine).where(POSTransactionLine.transaction_id == tx.id)
    )
    lines = lines_r.scalars().all()
    payment_method = tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)
    if payment_method == "cash":
        paid_amount = min(Decimal(str(tx.cash_tendered or 0)), Decimal(str(tx.total or 0)))
    elif payment_method == "split":
        paid_amount = min(Decimal(str(tx.card_amount or 0)) + Decimal(str(tx.cash_tendered or 0)), Decimal(str(tx.total or 0)))
    else:
        paid_amount = min(Decimal(str(tx.card_amount or 0)), Decimal(str(tx.total or 0)))
    invoice_subtotal = Decimal("0")
    invoice_discount = Decimal("0")
    for line in lines:
        rate = Decimal(str(line.vat_rate or 0))
        divisor = Decimal("1") + rate / Decimal("100") if rate > 0 else Decimal("1")
        invoice_subtotal += (Decimal(str(line.quantity)) * Decimal(str(line.unit_price)) / divisor).quantize(Decimal("0.01"))
        invoice_discount += (Decimal(str(line.discount_amount or 0)) / divisor).quantize(Decimal("0.01"))

    customer_id = tx.customer_id
    if not customer_id:
        customer = await _get_or_create_pos_cash_customer(db, tenant_id, user_id)
        customer_id = customer.id
        tx.customer_id = customer_id

    effective_vat_number = (
        vat_settings.vat_number if vat_settings and vat_settings.vat_number
        else (tenant.vat_number if tenant else "")
    )
    invoice = Invoice(
        id=invoice_id,
        tenant_id=tenant_id,
        invoice_number=await _next_invoice_number(db, tenant_id),
        uuid=str(uuid.uuid4()),
        invoice_type="simplified",
        customer_id=customer_id,
        issue_date=now,
        supply_date=now,
        fiscal_year_id=fiscal_year_id,
        seller_name_ar=tenant.name if tenant else "",
        seller_vat_number=effective_vat_number,
        seller_cr_number=vat_settings.cr_number if vat_settings else (tenant.cr_number if tenant else ""),
        buyer_name_ar=tx.customer_name or "عميل نقدي",
        # نوحّد تخزين الفاتورة مع فواتير المندوب والإدارة: subtotal وunit_price
        # قبل الضريبة، بينما total هو السعر النهائي الشامل للضريبة.
        subtotal=invoice_subtotal,
        discount_amount=invoice_discount,
        taxable_amount=invoice_subtotal - invoice_discount,
        vat_amount=tx.vat_amount,
        total=tx.total,
        currency_code="SAR",
        qr_code=tx.qr_code,
        paid_amount=paid_amount,
        notes=f"POS:{tx.transaction_number}|PAYMENT:{tx.payment_method}",
        status=InvoiceStatus.CONFIRMED,
        created_by=user_id,
    )
    db.add(invoice)

    # عملية POS مدفوعة لحظيًا؛ سجّل الدفعة حتى تظهر في عمود «المدفوع»
    # وتقارير المتبقي. لا ننشئ قيدًا هنا لأن قيد POS يُنشأ في create_transaction
    # عبر _create_pos_journal، ومنعًا لتكرار القيد المحاسبي.
    payment_parts: list[tuple[Decimal, PaymentMethod]] = []
    if payment_method == "split":
        cash_amount = min(Decimal(str(tx.cash_tendered or 0)), Decimal(str(tx.total or 0)))
        if cash_amount > 0:
            payment_parts.append((cash_amount, PaymentMethod.CASH))
        if Decimal(str(tx.card_amount or 0)) > 0:
            payment_parts.append((Decimal(str(tx.card_amount)), PaymentMethod.MADA))
    else:
        method_map = {
            "cash": PaymentMethod.CASH,
            "mada": PaymentMethod.MADA,
            "credit_card": PaymentMethod.CREDIT_CARD,
            "stc_pay": PaymentMethod.STC_PAY,
            # Payment enum القديمة لا تحتوي مزودي التقسيط؛ تحفظ الدفعة كشبكة
            # ويظل اسم المزود محفوظًا في ملاحظات الفاتورة/الدفعة.
            "tabby": PaymentMethod.CREDIT_CARD,
            "tamara": PaymentMethod.CREDIT_CARD,
            "bank_transfer": PaymentMethod.BANK_TRANSFER,
        }
        payment_method_enum = method_map.get(payment_method, PaymentMethod.CASH)
        if paid_amount > 0:
            payment_parts.append((paid_amount, payment_method_enum))

    for amount, payment_method in payment_parts:
        if amount <= 0:
            continue
        db.add(Payment(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            payment_number=await _next_payment_number(db, tenant_id),
            payment_type="receipt",
            invoice_id=invoice_id,
            customer_id=customer_id,
            payment_date=now,
            amount=amount,
            payment_method=payment_method,
            reference=tx.transaction_number,
            notes=f"دفعة تلقائية من نقطة البيع {tx.transaction_number} — طريقة الدفع: {tx.payment_method}",
            created_by=user_id,
        ))
    invoice.status = InvoiceStatus.PAID if paid_amount >= Decimal(str(tx.total or 0)) - Decimal("0.01") else InvoiceStatus.PARTIAL

    # أسطر الفاتورة من أسطر المعاملة، مع تخزين سعر الوحدة قبل الضريبة.
    for i, line in enumerate(lines):
        import json as _json
        rate = Decimal(str(line.vat_rate or 0))
        divisor = Decimal("1") + rate / Decimal("100") if rate > 0 else Decimal("1")
        net_unit_price = (Decimal(str(line.unit_price)) / divisor).quantize(Decimal("0.01"))
        net_discount = (Decimal(str(line.discount_amount or 0)) / divisor).quantize(Decimal("0.01"))
        db.add(InvoiceLine(
            id=str(uuid.uuid4()),
            invoice_id=invoice_id,
            line_order=i,
            description_ar=line.product_name_ar,
            quantity=line.quantity,
            unit_price=net_unit_price,
            discount_pct=line.discount_pct,
            discount_amount=net_discount,
            vat_rate=line.vat_rate,
            vat_amount=line.vat_amount,
            subtotal=(Decimal(str(line.quantity)) * net_unit_price).quantize(Decimal("0.01")),
            total=line.total,
            inventory_item_id=line.inventory_item_id,
            serial_item_id=line.serial_item_id,
            serial_ids_json=_json.dumps([line.serial_item_id]) if line.serial_item_id else None,
            variant_id=line.variant_id,
        ))

    return invoice_id


# ─── POS Purchase (شراء من نقطة البيع — جوالات وقطع غيار) ───────────

async def pos_purchase(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> dict:
    """
    شراء مباشر من نقطة البيع
    مخصص للجوالات وقطع الغيار — يضيف سيريال للمخزون فوراً
    """
    from app.modules.inventory.service import add_serial, add_stock
    from app.models.inventory import InventoryItem

    item_id = data["inventory_item_id"]
    item = await db.get(InventoryItem, item_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "الصنف غير موجود")

    tracking = item.tracking_type.value if hasattr(item.tracking_type, "value") else str(item.tracking_type)

    if tracking == "serial":
        # جوالات / قطع غيار بسيريال
        serial_number = data.get("serial_number")
        if not serial_number:
            raise HTTPException(400, "رقم السيريال مطلوب")

        result = await add_serial(
            db=db,
            tenant_id=tenant_id,
            product_id=item_id,
            serial_number=serial_number,
            condition=data.get("condition", "new"),
            cost_price=Decimal(str(data["cost_price"])),
            sale_price=Decimal(str(data["sale_price"])) if data.get("sale_price") else None,
            warehouse_id=data.get("warehouse_id"),
            notes=data.get("notes"),
        )
        return {
            "type": "serial",
            "serial_id": result.id,
            "serial_number": result.serial_number,
            "product_name": item.name_ar,
            "cost_price": float(result.cost_price),
            "sale_price": float(result.sale_price) if result.sale_price else None,
            "status": "added_to_stock",
        }
    else:
        # كمية عادية
        quantity = Decimal(str(data.get("quantity", 1)))
        cost_price = Decimal(str(data["cost_price"]))
        result = await add_stock(
            db=db,
            tenant_id=tenant_id,
            product_id=item_id,
            quantity=quantity,
            unit_cost=cost_price,
            warehouse_id=data.get("warehouse_id"),
            reference_type="pos_purchase",
            user_id=user_id,
        )
        return {
            "type": "quantity",
            "product_name": item.name_ar,
            "quantity_added": float(quantity),
            "new_quantity": float(result.quantity_on_hand),
            "cost_price": float(cost_price),
            "status": "added_to_stock",
        }


# ─── Get Session Transactions ────────────────────────────────────────

async def get_session_transactions(db: AsyncSession, tenant_id: str, session_id: str) -> list:
    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id:
        raise HTTPException(404, "الجلسة غير موجودة")

    r = await db.execute(
        select(POSTransaction)
        .where(POSTransaction.session_id == session_id)
        .order_by(POSTransaction.created_at.desc())
    )
    txs = r.scalars().all()
    return [
        {
            "id": tx.id,
            "transaction_number": tx.transaction_number,
            "total": float(tx.total),
            "vat_amount": float(tx.vat_amount),
            "payment_method": tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method),
            "status": tx.status.value if hasattr(tx.status, "value") else str(tx.status),
            "created_at": tx.created_at.isoformat(),
        }
        for tx in txs
    ]


async def get_my_transactions(db: AsyncSession, tenant_id: str, user_id: str, limit: int = 100) -> list:
    """فواتير POS السابقة للمستخدم الحالي فقط، عبر جلساته هو دون بقية الكاشيرين."""
    r = await db.execute(
        select(POSTransaction)
        .join(POSSession, POSTransaction.session_id == POSSession.id)
        .where(
            POSTransaction.tenant_id == tenant_id,
            POSSession.tenant_id == tenant_id,
            POSSession.cashier_id == user_id,
        )
        .order_by(POSTransaction.created_at.desc())
        .limit(min(max(limit, 1), 200))
    )
    txs = r.scalars().all()
    return [
        {
            "id": tx.id,
            "transaction_number": tx.transaction_number,
            "invoice_id": tx.invoice_id,
            "total": float(tx.total),
            "vat_amount": float(tx.vat_amount),
            "payment_method": tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method),
            "status": tx.status.value if hasattr(tx.status, "value") else str(tx.status),
            "customer_name": tx.customer_name,
            "created_at": tx.created_at.isoformat(),
        }
        for tx in txs
    ]


# ─── Refund Transaction ───────────────────────────────────────────────

async def refund_transaction(db: AsyncSession, tenant_id: str, user_id: str, tx_id: str) -> dict:
    tx = await db.get(POSTransaction, tx_id)
    if not tx or tx.tenant_id != tenant_id:
        raise HTTPException(404, "المعاملة غير موجودة")
    already_refunded = tx.status == "refunded"
    if tx.status not in ("completed", "refunded"):
        raise HTTPException(400, "لا يمكن استرداد هذه المعاملة")

    # منع إنشاء مرتجعين لنفس فاتورة POS.
    from app.models.sales import CreditNote, CreditNoteLine, Invoice, InvoiceLine
    existing_return = await db.scalar(select(CreditNote).where(
        CreditNote.tenant_id == tenant_id,
        CreditNote.original_invoice_id == tx.invoice_id,
        CreditNote.reason == f"مرتجع نقطة البيع {tx.transaction_number}",
    )) if tx.invoice_id else None
    if existing_return:
        raise HTTPException(409, "تم إنشاء مرتجع لهذه الفاتورة مسبقًا")

    # ── إرجاع المخزون ──────────────────────────────────────────────
    lines_r = await db.execute(
        select(POSTransactionLine).where(POSTransactionLine.transaction_id == tx_id)
    )
    lines = lines_r.scalars().all()
    inventory_lines = [] if already_refunded else lines

    for line in inventory_lines:
        if not line.inventory_item_id:
            continue
        from app.models.inventory import InventoryItem
        item = await db.get(InventoryItem, line.inventory_item_id)
        if not item:
            continue

        tracking = item.tracking_type.value if hasattr(item.tracking_type, "value") else str(item.tracking_type)

        if tracking == "serial" and line.serial_item_id:
            # إرجاع السيريال لحالة in_stock
            from app.models.inventory import SerialItem, StockMovement
            serial = await db.get(SerialItem, line.serial_item_id)
            if serial and serial.status == "sold":
                serial.status = "in_stock"
                serial.sold_at = None
                serial.sale_invoice_id = None
                db.add(StockMovement(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    product_id=line.inventory_item_id,
                    movement_type="return",
                    quantity=Decimal("1"),
                    unit_cost=serial.cost_price,
                    serial_item_id=line.serial_item_id,
                    reference_type="pos_refund",
                    reference_id=tx_id,
                ))

        elif tracking == "variant" and line.variant_id:
            from app.models.inventory import ProductVariant, StockMovement
            variant = await db.get(ProductVariant, line.variant_id)
            if variant:
                variant.quantity += line.quantity
                item.quantity_on_hand += line.quantity
                db.add(StockMovement(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    product_id=line.inventory_item_id,
                    movement_type="return",
                    quantity=line.quantity,
                    unit_cost=item.cost_price,
                    reference_type="pos_refund",
                    reference_id=tx_id,
                ))

        elif tracking == "batch" and line.batch_id:
            from app.models.inventory import BatchItem, StockMovement
            batch = await db.get(BatchItem, line.batch_id)
            if batch:
                batch.quantity += line.quantity
                item.quantity_on_hand += line.quantity
                db.add(StockMovement(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    product_id=line.inventory_item_id,
                    movement_type="return",
                    quantity=line.quantity,
                    unit_cost=batch.cost_price,
                    batch_item_id=line.batch_id,
                    reference_type="pos_refund",
                    reference_id=tx_id,
                ))

        else:
            # quantity / weight
            from app.models.inventory import StockMovement
            item.quantity_on_hand += line.quantity
            db.add(StockMovement(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                product_id=line.inventory_item_id,
                movement_type="return",
                quantity=line.quantity,
                unit_cost=item.cost_price,
                reference_type="pos_refund",
                reference_id=tx_id,
            ))

    # إنشاء إشعار دائن ظاهر في «مرتجعات المبيعات» مرتبط بفاتورة POS الأصلية.
    # هذا مستند عكسي فقط؛ لا ينشئ مبيعات جديدة ولا يضيف معاملة جديدة للجلسة.
    invoice = await db.get(Invoice, tx.invoice_id) if tx.invoice_id else None
    if invoice:
        cn_id = str(uuid.uuid4())
        cn = CreditNote(
            id=cn_id, tenant_id=tenant_id,
            credit_note_number=f"CN-{str((await db.execute(select(func.count(CreditNote.id)).where(CreditNote.tenant_id == tenant_id))).scalar() + 1).zfill(5)}",
            uuid=str(uuid.uuid4()), note_type="credit", original_invoice_id=invoice.id,
            customer_id=invoice.customer_id, issue_date=datetime.utcnow(),
            reason=f"مرتجع نقطة البيع {tx.transaction_number}", subtotal=tx.total - tx.vat_amount,
            vat_amount=tx.vat_amount, total=tx.total, created_by=user_id,
        )
        db.add(cn)
        invoice_lines = (await db.execute(
            select(InvoiceLine).where(InvoiceLine.invoice_id == invoice.id).order_by(InvoiceLine.line_order)
        )).scalars().all()
        for index, line in enumerate(lines):
            subtotal = Decimal(str(line.total or 0)) - Decimal(str(line.vat_amount or 0))
            db.add(CreditNoteLine(
                id=str(uuid.uuid4()), credit_note_id=cn_id,
                original_invoice_line_id=invoice_lines[index].id if index < len(invoice_lines) else None,
                line_order=index, description_ar=line.product_name_ar, quantity=line.quantity,
                unit_price=line.unit_price,
                vat_rate=line.vat_rate, subtotal=subtotal, vat_amount=line.vat_amount,
                total=line.total, inventory_item_id=line.inventory_item_id,
                serial_ids_json=(__import__("json").dumps([line.serial_item_id]) if line.serial_item_id else None),
                variant_id=line.variant_id, return_condition="resalable",
            ))
        await db.flush()

        # عكس قيد البيع الأصلي مرة واحدة؛ لا ننشئ قيد مبيعات جديدًا للمرتجع.
        if tx.journal_entry_id:
            from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
            original_entry = await db.get(JournalEntry, tx.journal_entry_id, with_for_update=True)
            if original_entry and original_entry.status == JournalEntryStatus.POSTED:
                original_entry.status = JournalEntryStatus.CANCELLED
                original_lines = (await db.execute(select(JournalEntryLine).where(
                    JournalEntryLine.entry_id == original_entry.id
                ))).scalars().all()
                reversal = JournalEntry(
                    id=str(uuid.uuid4()), tenant_id=tenant_id,
                    entry_number=f"REV-{tx.transaction_number}", entry_date=datetime.utcnow(),
                    fiscal_year_id=original_entry.fiscal_year_id,
                    description_ar=f"عكس مرتجع نقطة البيع {tx.transaction_number}",
                    description_en=f"POS refund reversal {tx.transaction_number}",
                    status=JournalEntryStatus.POSTED, source="pos_refund",
                    reference=tx.transaction_number, total_debit=original_entry.total_credit,
                    total_credit=original_entry.total_debit, created_by=user_id,
                    posted_by=user_id, posted_at=datetime.utcnow(),
                )
                db.add(reversal)
                for journal_line in original_lines:
                    db.add(JournalEntryLine(
                        id=str(uuid.uuid4()), entry_id=reversal.id,
                        account_id=journal_line.account_id, cost_center_id=journal_line.cost_center_id,
                        description=f"عكس مرتجع {tx.transaction_number}",
                        debit=journal_line.credit, credit=journal_line.debit,
                        line_order=journal_line.line_order,
                    ))
                cn.journal_entry_id = reversal.id

    tx.status = "refunded"

    # تحديث إجماليات الجلسة
    session = None if already_refunded else await db.get(POSSession, tx.session_id)
    if session:
        session.total_sales -= tx.total
        session.total_vat -= tx.vat_amount
        session.transaction_count = max(0, session.transaction_count - 1)
        pm = tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)
        collected_cash = min(Decimal(str(tx.cash_tendered or 0)), tx.total)
        collected_card = min(Decimal(str(tx.card_amount or 0)), tx.total)
        if pm == "cash":
            session.total_cash -= collected_cash
        elif pm in ("mada", "credit_card", "stc_pay"):
            session.total_card -= collected_card
        elif pm == "split":
            session.total_cash -= collected_cash
            session.total_card -= collected_card
        elif pm == "tabby":
            session.total_tabby -= tx.total
        elif pm == "tamara":
            session.total_tamara -= tx.total
        elif pm == "bank_transfer":
            session.total_bank_transfer -= tx.total

    await db.commit()
    return {"message": "تم الاسترداد بنجاح وإنشاء إشعار دائن وإرجاع المخزون", "transaction_id": tx_id, "status": "refunded", "credit_note_id": cn.id if invoice else None}


# ─── Get Transaction ──────────────────────────────────────────────────

async def get_transaction(db: AsyncSession, tenant_id: str, tx_id: str) -> dict:
    r = await db.execute(
        select(POSTransaction)
        .options(selectinload(POSTransaction.lines))
        .where(POSTransaction.id == tx_id, POSTransaction.tenant_id == tenant_id)
    )
    tx = r.scalar_one_or_none()
    if not tx:
        raise HTTPException(404, "المعاملة غير موجودة")

    return {
        "id": tx.id,
        "transaction_number": tx.transaction_number,
        "session_id": tx.session_id,
        "customer_name": tx.customer_name,
        "customer_phone": tx.customer_phone,
        "subtotal": float(tx.subtotal),
        "discount_amount": float(tx.discount_amount),
        "vat_amount": float(tx.vat_amount),
        "total": float(tx.total),
        "payment_method": tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method),
        "cash_tendered": float(tx.cash_tendered or 0),
        "change_amount": float(tx.change_amount or 0),
        "card_amount": float(tx.card_amount or 0),
        "qr_code": tx.qr_code,
        "invoice_id": tx.invoice_id,
        "status": tx.status.value if hasattr(tx.status, "value") else str(tx.status),
        "created_at": tx.created_at.isoformat(),
        "lines": [
            {
                "product_name_ar": l.product_name_ar,
                "barcode": l.barcode,
                "quantity": float(l.quantity),
                "unit_price": float(l.unit_price),
                "discount_pct": float(l.discount_pct),
                "vat_rate": float(l.vat_rate),
                "vat_amount": float(l.vat_amount),
                "total": float(l.total),
            }
            for l in tx.lines
        ],
    }


# ─── POS Reports ─────────────────────────────────────────────────────

async def get_top_items_report(
    db: AsyncSession, tenant_id: str,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int = 20,
) -> dict:
    """أفضل الأصناف مبيعاً في POS خلال فترة محددة"""
    from sqlalchemy import text as sa_text

    # جلب جميع أسطر المعاملات المكتملة في الفترة
    q = (
        select(POSTransactionLine)
        .join(POSTransaction, POSTransactionLine.transaction_id == POSTransaction.id)
        .where(
            POSTransaction.tenant_id == tenant_id,
            POSTransaction.status == TX_COMPLETED,
        )
    )
    if from_date:
        from datetime import datetime as dt
        q = q.where(POSTransaction.created_at >= dt.fromisoformat(from_date))
    if to_date:
        from datetime import datetime as dt
        q = q.where(POSTransaction.created_at <= dt.fromisoformat(to_date + "T23:59:59"))

    r = await db.execute(q)
    lines = r.scalars().all()

    # تجميع حسب اسم المنتج
    agg: dict[str, dict] = {}
    total_revenue_all = Decimal("0")

    for line in lines:
        key = line.product_name_ar
        if key not in agg:
            agg[key] = {
                "product_name_ar": key,
                "inventory_item_id": line.inventory_item_id,
                "total_qty": Decimal("0"),
                "total_revenue": Decimal("0"),
                "count": 0,
            }
        agg[key]["total_qty"] += line.quantity
        agg[key]["total_revenue"] += line.total
        agg[key]["count"] += 1
        total_revenue_all += line.total

    items = sorted(agg.values(), key=lambda x: x["total_revenue"], reverse=True)[:limit]

    result = []
    for item in items:
        avg_price = item["total_revenue"] / item["total_qty"] if item["total_qty"] > 0 else Decimal("0")
        share_pct = float(item["total_revenue"] / total_revenue_all * 100) if total_revenue_all > 0 else 0
        result.append({
            "product_name_ar": item["product_name_ar"],
            "inventory_item_id": item["inventory_item_id"],
            "total_qty": float(item["total_qty"]),
            "total_revenue": float(item["total_revenue"]),
            "avg_price": float(avg_price),
            "share_pct": round(share_pct, 2),
            "transactions_count": item["count"],
        })

    return {
        "items": result,
        "summary": {
            "total_items_sold": len(agg),
            "total_revenue": float(total_revenue_all),
            "period_from": from_date,
            "period_to": to_date,
        }
    }


async def get_terminal_performance_report(
    db: AsyncSession,
    tenant_id: str,
    from_date: str | None = None,
    to_date: str | None = None,
    terminal_id: str | None = None,
) -> dict:
    """تقرير أداء أجهزة POS: المبيعات والتكلفة والربح ومخرجات النقد."""
    from datetime import datetime as dt, time as dt_time
    from app.models.inventory import InventoryItem, SerialItem, BatchItem, ProductVariant

    try:
        start = dt.fromisoformat(from_date).replace(hour=0, minute=0, second=0, microsecond=0) if from_date else None
        end = dt.fromisoformat(to_date).replace(hour=23, minute=59, second=59, microsecond=999999) if to_date else None
    except ValueError:
        raise HTTPException(400, "صيغة التاريخ غير صحيحة")

    terminals_q = select(POSTerminal).where(
        POSTerminal.tenant_id == tenant_id,
        POSTerminal.is_active == True,
    )
    if terminal_id:
        terminals_q = terminals_q.where(POSTerminal.id == terminal_id)
    terminals = (await db.execute(terminals_q.order_by(POSTerminal.name))).scalars().all()
    if terminal_id and not terminals:
        raise HTTPException(404, "جهاز نقطة البيع غير موجود")

    tx_q = (
        select(POSTransaction)
        .join(POSSession, POSSession.id == POSTransaction.session_id)
        .where(
            POSTransaction.tenant_id == tenant_id,
            POSTransaction.status == TX_COMPLETED,
        )
        .options(selectinload(POSTransaction.lines))
    )
    if terminal_id:
        tx_q = tx_q.where(POSSession.terminal_id == terminal_id)
    if start:
        tx_q = tx_q.where(POSTransaction.created_at >= start)
    if end:
        tx_q = tx_q.where(POSTransaction.created_at <= end)
    transactions = (await db.execute(tx_q)).scalars().all()

    outflow_q = (
        select(POSCashOutflow)
        .join(POSSession, POSSession.id == POSCashOutflow.session_id)
        .where(POSCashOutflow.tenant_id == tenant_id)
    )
    if terminal_id:
        outflow_q = outflow_q.where(POSCashOutflow.terminal_id == terminal_id)
    if start:
        outflow_q = outflow_q.where(POSCashOutflow.created_at >= start)
    if end:
        outflow_q = outflow_q.where(POSCashOutflow.created_at <= end)
    outflows = (await db.execute(outflow_q)).scalars().all()

    # تكلفة السطر تؤخذ من الوحدة الفعلية عند وجود سيريال/تشغيلة/متغير،
    # وإلا من متوسط تكلفة الصنف. هذا يمنع احتساب الربح من سعر البيع فقط.
    serial_ids = {line.serial_item_id for tx in transactions for line in tx.lines if line.serial_item_id}
    batch_ids = {line.batch_id for tx in transactions for line in tx.lines if line.batch_id}
    variant_ids = {line.variant_id for tx in transactions for line in tx.lines if line.variant_id}
    item_ids = {line.inventory_item_id for tx in transactions for line in tx.lines if line.inventory_item_id}
    serial_costs = {x.id: x.cost_price for x in (await db.execute(select(SerialItem).where(SerialItem.id.in_(serial_ids)))).scalars().all()} if serial_ids else {}
    batch_costs = {x.id: x.cost_price for x in (await db.execute(select(BatchItem).where(BatchItem.id.in_(batch_ids)))).scalars().all()} if batch_ids else {}
    variant_costs = {x.id: x.cost_price for x in (await db.execute(select(ProductVariant).where(ProductVariant.id.in_(variant_ids)))).scalars().all()} if variant_ids else {}
    item_costs = {x.id: x.cost_price for x in (await db.execute(select(InventoryItem).where(InventoryItem.id.in_(item_ids)))).scalars().all()} if item_ids else {}

    def blank(t: POSTerminal) -> dict:
        return {
            "terminal_id": t.id, "terminal_name": t.name, "branch_name": t.branch_name,
            "warehouse_id": t.warehouse_id, "sessions": 0, "transactions": 0,
            "sales": Decimal("0"), "cost": Decimal("0"), "gross_profit": Decimal("0"),
            "expenses": Decimal("0"), "net_profit": Decimal("0"),
            "cash": Decimal("0"), "mada": Decimal("0"), "credit_card": Decimal("0"),
            "stc_pay": Decimal("0"), "tabby": Decimal("0"), "tamara": Decimal("0"),
            "split_cash": Decimal("0"), "split_card": Decimal("0"), "bank_transfer": Decimal("0"),
            "other_payment": Decimal("0"),
        }

    rows = {t.id: blank(t) for t in terminals}
    session_ids = {tx.session_id for tx in transactions}
    session_terminal_rows = await db.execute(select(POSSession.id, POSSession.terminal_id).where(POSSession.id.in_(session_ids))) if session_ids else None
    session_terminal = dict(session_terminal_rows.all()) if session_terminal_rows else {}

    for tx in transactions:
        tid = session_terminal.get(tx.session_id)
        if tid not in rows:
            continue
        row = rows[tid]
        row["transactions"] += 1
        row["sales"] += tx.total or Decimal("0")
        method = tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)
        tx_total = Decimal(str(tx.total or 0))
        cash_paid = min(Decimal(str(tx.cash_tendered or 0)), tx_total)
        card_paid = min(Decimal(str(tx.card_amount or 0)), max(Decimal("0"), tx_total - cash_paid))
        if method == "split":
            row["split_cash"] += cash_paid
            row["split_card"] += card_paid
        elif method in ("cash", "mada", "credit_card", "stc_pay", "tabby", "tamara", "bank_transfer"):
            # البيع قد يكون آجلًا/جزئيًا؛ التحصيل لا يساوي إجمالي الفاتورة.
            paid = cash_paid if method == "cash" else card_paid
            row[method] += paid
        else:
            row.setdefault("other_payment", Decimal("0"))
            row["other_payment"] += tx.total or Decimal("0")
        for line in tx.lines:
            if line.serial_item_id:
                unit_cost = serial_costs.get(line.serial_item_id, Decimal("0"))
            elif line.batch_id:
                unit_cost = batch_costs.get(line.batch_id, Decimal("0"))
            elif line.variant_id:
                unit_cost = variant_costs.get(line.variant_id, Decimal("0"))
            else:
                unit_cost = item_costs.get(line.inventory_item_id, Decimal("0"))
            row["cost"] += (line.quantity or Decimal("0")) * (unit_cost or Decimal("0"))

    for outflow in outflows:
        if outflow.terminal_id in rows:
            rows[outflow.terminal_id]["expenses"] += outflow.amount or Decimal("0")
    for row in rows.values():
        row["gross_profit"] = row["sales"] - row["cost"]
        row["net_profit"] = row["gross_profit"] - row["expenses"]
        row["sales"] = float(row["sales"]); row["cost"] = float(row["cost"])
        row["gross_profit"] = float(row["gross_profit"]); row["expenses"] = float(row["expenses"])
        row["net_profit"] = float(row["net_profit"])
        for key in ("cash", "mada", "credit_card", "stc_pay", "tabby", "tamara", "split_cash", "split_card", "bank_transfer", "other_payment"):
            row[key] = float(row[key])

    # عدد الجلسات حسب تاريخ الفتح، مستقل عن وجود مبيعات في الجلسة.
    sessions_q = select(POSSession.terminal_id).where(POSSession.tenant_id == tenant_id)
    if terminal_id: sessions_q = sessions_q.where(POSSession.terminal_id == terminal_id)
    if start: sessions_q = sessions_q.where(POSSession.opened_at >= start)
    if end: sessions_q = sessions_q.where(POSSession.opened_at <= end)
    for tid in (await db.execute(sessions_q)).scalars().all():
        if tid in rows: rows[tid]["sessions"] += 1

    # لا تعرض التقرير كل الأجهزة النشطة في الحساب أو الجلسات الفارغة؛ اعرض
    # فقط الأجهزة التي لديها بيع أو مخرج نقدي فعلي ضمن الفترة المحددة.
    values = [row for row in rows.values() if row["transactions"] or row["expenses"]]
    payment_keys = ("cash", "mada", "credit_card", "stc_pay", "tabby", "tamara", "split_cash", "split_card", "bank_transfer", "other_payment")
    totals = {key: sum((r[key] for r in values), 0) for key in ("sessions", "transactions", "sales", "cost", "gross_profit", "expenses", "net_profit", *payment_keys)}
    totals["payments"] = {key: totals[key] for key in payment_keys}
    for row in values:
        row["payments"] = {key: row[key] for key in payment_keys}
    return {"from_date": from_date, "to_date": to_date, "terminal_id": terminal_id, "totals": totals, "terminals": values}
