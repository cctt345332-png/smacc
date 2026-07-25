"""
خدمة نقطة البيع (POS) — مبنية من الصفر
متوافقة مع جميع الأنشطة ومرتبطة بها بشكل صحيح
"""
import uuid
import base64
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.pos import (
    POSTerminal, POSSession, POSTransaction, POSTransactionLine,
    POS_PURCHASE_ACTIVITIES, ACTIVITY_CONFIG,
)

# قيم الحالة كـ strings مباشرة (متوافقة مع الـ DB)
SESSION_OPEN   = "open"
SESSION_CLOSED = "closed"
TX_COMPLETED   = "completed"
TX_CANCELLED   = "cancelled"
TX_REFUNDED    = "refunded"


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
            "cash_account_id": t.cash_account_id,
            "sales_account_id": t.sales_account_id,
            "vat_account_id": t.vat_account_id,
            "bank_account_id": t.bank_account_id,
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
        "assigned_user_id": t.assigned_user_id,
    }


async def create_terminal(db: AsyncSession, tenant_id: str, data: dict) -> dict:
    bt = data.get("business_type", "general")
    cfg = ACTIVITY_CONFIG.get(bt, ACTIVITY_CONFIG["general"])
    allow_purchase = data.get("allow_purchase", bt in POS_PURCHASE_ACTIVITIES)
    terminal = POSTerminal(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        name=data["name"],
        branch_name=data.get("branch_name"),
        business_type=bt,
        warehouse_id=data.get("warehouse_id"),
        cash_account_id=data.get("cash_account_id"),
        sales_account_id=data.get("sales_account_id"),
        vat_account_id=data.get("vat_account_id"),
        bank_account_id=data.get("bank_account_id"),
        fiscal_year_id=data.get("fiscal_year_id"),
        receipt_header=data.get("receipt_header"),
        receipt_footer=data.get("receipt_footer"),
        print_receipt=data.get("print_receipt", True),
        allow_discount=data.get("allow_discount", True),
        max_discount_pct=Decimal(str(data.get("max_discount_pct", 10))),
        allow_purchase=allow_purchase,
        assigned_user_id=data.get("assigned_user_id"),
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
        "cash_account_id": terminal.cash_account_id,
        "sales_account_id": terminal.sales_account_id,
        "vat_account_id": terminal.vat_account_id,
        "bank_account_id": terminal.bank_account_id,
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
    allowed = [
        "name", "branch_name", "business_type", "warehouse_id",
        "cash_account_id", "sales_account_id", "vat_account_id",
        "bank_account_id", "fiscal_year_id",
        "receipt_header", "receipt_footer", "print_receipt",
        "allow_discount", "max_discount_pct", "allow_purchase", "is_active",
        "assigned_user_id",
    ]
    for k in allowed:
        if k in data and data[k] is not None:
            setattr(t, k, data[k])
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
        "cash_account_id": t.cash_account_id,
        "sales_account_id": t.sales_account_id,
        "vat_account_id": t.vat_account_id,
        "bank_account_id": t.bank_account_id,
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
        .where(POSSession.tenant_id == tenant_id)
    )
    if terminal_id:
        q = q.where(POSSession.terminal_id == terminal_id)
    q = q.order_by(POSSession.opened_at.desc()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


async def get_active_session(db: AsyncSession, tenant_id: str, terminal_id: str) -> POSSession | None:
    from sqlalchemy import cast, Text
    r = await db.execute(
        select(POSSession).where(
            POSSession.tenant_id == tenant_id,
            POSSession.terminal_id == terminal_id,
            cast(POSSession.status, Text) == "open",
        )
    )
    return r.scalar_one_or_none()


async def open_session(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> POSSession:
    terminal_id = data["terminal_id"]

    # التحقق من الجهاز
    terminal = await db.get(POSTerminal, terminal_id)
    if not terminal or terminal.tenant_id != tenant_id:
        raise HTTPException(404, "الجهاز غير موجود")

    # التحقق من عدم وجود جلسة مفتوحة
    existing = await get_active_session(db, tenant_id, terminal_id)
    if existing:
        raise HTTPException(400, "يوجد جلسة مفتوحة بالفعل لهذا الجهاز")

    session = POSSession(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        terminal_id=terminal_id,
        cashier_id=user_id,
        opening_cash=Decimal(str(data.get("opening_cash", 0))),
        status="open",
        opened_at=datetime.utcnow(),
        notes=data.get("notes"),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def close_session(db: AsyncSession, tenant_id: str, session_id: str, data: dict) -> dict:
    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id:
        raise HTTPException(404, "الجلسة غير موجودة")
    if session.status != "open":
        raise HTTPException(400, "الجلسة مغلقة بالفعل")

    closing_cash = Decimal(str(data.get("closing_cash", 0)))
    expected = session.opening_cash + session.total_cash
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
        "total_vat": float(session.total_vat),
        "transaction_count": session.transaction_count,
        "status": "closed",
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
            "expected_cash": float(session.expected_cash or 0),
            "difference": float((session.closing_cash or 0) - (session.expected_cash or 0)),
            "total_sales": float(session.total_sales),
            "total_cash": float(session.total_cash),
            "total_card": float(session.total_card),
            "total_vat": float(session.total_vat),
            "transaction_count": session.transaction_count,
        },
        "by_payment_method": by_method,
        "transactions": [
            {
                "id": tx.id,
                "transaction_number": tx.transaction_number,
                "total": float(tx.total),
                "vat_amount": float(tx.vat_amount),
                "payment_method": tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method),
                "created_at": tx.created_at.isoformat(),
                "lines_count": len(tx.lines),
            }
            for tx in txs
        ],
    }


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

    # جلب بيانات الشركة للـ QR
    from app.models.tenant import Tenant
    from app.modules.accounting.service import get_vat_settings
    tenant = await db.get(Tenant, tenant_id)
    vat_settings = await get_vat_settings(db, tenant_id)

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

        gross = qty * price
        disc_amt = (gross * disc_pct / 100).quantize(Decimal("0.01"))
        taxable = gross - disc_amt
        vat_amt = (taxable * vat_rate / 100).quantize(Decimal("0.01"))
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

    change_amount = max(Decimal("0"), cash_tendered - grand_total) if payment_method == "cash" else Decimal("0")

    # QR Code زاتكا
    qr = _qr_tlv(
        seller=tenant.name if tenant else "",
        vat=vat_settings.vat_number if vat_settings else "",
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
        card_amount=card_amount if payment_method == "split" else None,
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
            await _deduct_inventory(db, tenant_id, user_id, tx_id, line)

    # تحديث إجماليات الجلسة
    session.total_sales += grand_total
    session.total_vat += vat_total
    session.transaction_count += 1
    if payment_method in ("cash",):
        session.total_cash += grand_total
    elif payment_method in ("mada", "credit_card", "stc_pay"):
        session.total_card += grand_total
    elif payment_method == "split":
        session.total_cash += (grand_total - card_amount)
        session.total_card += card_amount

    # إنشاء فاتورة مبسطة تلقائياً
    invoice_id = await _create_pos_invoice(db, tenant_id, user_id, tx, session, tenant, vat_settings)
    if invoice_id:
        tx.invoice_id = invoice_id

    await db.commit()
    await db.refresh(tx)

    return {
        "transaction_id": tx.id,
        "transaction_number": tx.transaction_number,
        "total": float(grand_total),
        "vat_amount": float(vat_total),
        "change_amount": float(change_amount),
        "qr_code": qr,
        "invoice_id": invoice_id,
        "status": "completed",
    }


async def _deduct_inventory(db: AsyncSession, tenant_id: str, user_id: str, tx_id: str, line: dict):
    """خصم المخزون حسب نوع التتبع"""
    from app.models.inventory import InventoryItem
    from app.modules.inventory.service import sell_serial, deduct_stock, deduct_batch_fefo

    item = await db.get(InventoryItem, line["inventory_item_id"])
    if not item:
        return

    tracking = item.tracking_type.value if hasattr(item.tracking_type, "value") else str(item.tracking_type)

    if tracking == "serial":
        serial_id = line.get("serial_item_id")
        if serial_id:
            await sell_serial(
                db=db, tenant_id=tenant_id,
                serial_id=serial_id,
                sale_price=Decimal(str(line["unit_price"])),
                invoice_id=tx_id,
            )
    elif tracking == "batch":
        await deduct_batch_fefo(
            db=db, tenant_id=tenant_id,
            product_id=line["inventory_item_id"],
            quantity=Decimal(str(line["quantity"])),
            reference_type="pos",
            reference_id=tx_id,
            user_id=user_id,
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
            reference_type="pos",
            reference_id=tx_id,
            user_id=user_id,
        )


async def _create_pos_invoice(db, tenant_id, user_id, tx, session, tenant, vat_settings) -> str | None:
    """إنشاء فاتورة مبسطة ZATCA تلقائياً عند كل عملية بيع"""
    from app.models.sales import Invoice, InvoiceLine, InvoiceStatus
    from app.modules.sales.service import _next_invoice_number

    terminal = await db.get(POSTerminal, session.terminal_id)
    fiscal_year_id = terminal.fiscal_year_id if terminal else None
    if not fiscal_year_id:
        return None

    invoice_id = str(uuid.uuid4())
    now = datetime.utcnow()

    invoice = Invoice(
        id=invoice_id,
        tenant_id=tenant_id,
        invoice_number=await _next_invoice_number(db, tenant_id),
        uuid=str(uuid.uuid4()),
        invoice_type="simplified",
        customer_id=tx.customer_id,
        issue_date=now,
        supply_date=now,
        fiscal_year_id=fiscal_year_id,
        seller_name_ar=tenant.name if tenant else "",
        seller_vat_number=vat_settings.vat_number if vat_settings else "",
        seller_cr_number=vat_settings.cr_number if vat_settings else "",
        buyer_name_ar=tx.customer_name or "عميل نقدي",
        subtotal=tx.subtotal,
        discount_amount=tx.discount_amount,
        taxable_amount=tx.subtotal - tx.discount_amount,
        vat_amount=tx.vat_amount,
        total=tx.total,
        currency_code="SAR",
        qr_code=tx.qr_code,
        status=InvoiceStatus.CONFIRMED,
        created_by=user_id,
    )
    db.add(invoice)

    # أسطر الفاتورة من أسطر المعاملة
    lines_r = await db.execute(
        select(POSTransactionLine).where(POSTransactionLine.transaction_id == tx.id)
    )
    lines = lines_r.scalars().all()
    for i, line in enumerate(lines):
        db.add(InvoiceLine(
            id=str(uuid.uuid4()),
            invoice_id=invoice_id,
            line_order=i,
            description_ar=line.product_name_ar,
            quantity=line.quantity,
            unit_price=line.unit_price,
            discount_pct=line.discount_pct,
            discount_amount=line.discount_amount,
            vat_rate=line.vat_rate,
            vat_amount=line.vat_amount,
            subtotal=line.quantity * line.unit_price,
            total=line.total,
            inventory_item_id=line.inventory_item_id,
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


# ─── Refund Transaction ───────────────────────────────────────────────

async def refund_transaction(db: AsyncSession, tenant_id: str, tx_id: str) -> dict:
    tx = await db.get(POSTransaction, tx_id)
    if not tx or tx.tenant_id != tenant_id:
        raise HTTPException(404, "المعاملة غير موجودة")
    if tx.status != "completed":
        raise HTTPException(400, "لا يمكن استرداد هذه المعاملة")

    # ── إرجاع المخزون ──────────────────────────────────────────────
    lines_r = await db.execute(
        select(POSTransactionLine).where(POSTransactionLine.transaction_id == tx_id)
    )
    lines = lines_r.scalars().all()

    for line in lines:
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

    tx.status = "refunded"

    # تحديث إجماليات الجلسة
    session = await db.get(POSSession, tx.session_id)
    if session:
        session.total_sales -= tx.total
        session.total_vat -= tx.vat_amount
        session.transaction_count = max(0, session.transaction_count - 1)
        pm = tx.payment_method.value if hasattr(tx.payment_method, "value") else str(tx.payment_method)
        if pm == "cash":
            session.total_cash -= tx.total
        elif pm in ("mada", "credit_card", "stc_pay"):
            session.total_card -= tx.total
        elif pm == "split":
            card_amt = tx.card_amount or Decimal("0")
            session.total_cash -= (tx.total - card_amt)
            session.total_card -= card_amt

    await db.commit()
    return {"message": "تم الاسترداد بنجاح وإرجاع المخزون", "transaction_id": tx_id, "status": "refunded"}


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
