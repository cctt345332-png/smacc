"""خدمة صيانة نقاط البيع — منفصلة عن الفواتير والبيع والتقارير اليومية."""
import json
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pos import POSTerminal, POSSession
from app.models.pos_maintenance import POSMaintenanceTicket, POSMaintenancePart, POSMaintenancePayment, POSMaintenanceServiceLine
from app.models.inventory import InventoryItem, InventoryStock, SerialItem, Warehouse
from app.models.sales import Customer
from app.models.reps import SalesRep
from app.models.sales import InvoicePaymentMethod, InvoiceType
from app.modules.sales.schemas import InvoiceCreate, InvoiceLineCreate
from app.modules.maintenance.service import _encrypt_secret

MAINTENANCE_STATUSES = {"open", "in_progress", "ready", "completed", "cancelled"}


async def _ticket(db: AsyncSession, tenant_id: str, ticket_id: str) -> POSMaintenanceTicket:
    row = await db.scalar(select(POSMaintenanceTicket).where(
        POSMaintenanceTicket.id == ticket_id,
        POSMaintenanceTicket.tenant_id == tenant_id,
    ))
    if not row:
        raise HTTPException(404, "تذكرة الصيانة غير موجودة")
    return row


async def _next_number(db: AsyncSession, tenant_id: str) -> str:
    count = await db.scalar(select(func.count(POSMaintenanceTicket.id)).where(POSMaintenanceTicket.tenant_id == tenant_id))
    return f"MNT-{int(count or 0) + 1:06d}"


async def _parts(db: AsyncSession, tenant_id: str, ticket_id: str) -> list[dict]:
    rows = (await db.execute(
        select(POSMaintenancePart, InventoryItem)
        .join(InventoryItem, InventoryItem.id == POSMaintenancePart.product_id)
        .where(POSMaintenancePart.tenant_id == tenant_id, POSMaintenancePart.ticket_id == ticket_id)
        .order_by(POSMaintenancePart.created_at)
    )).all()
    return [{
        "id": part.id, "product_id": part.product_id,
        "product_name": item.name_ar, "sku": item.sku,
        "quantity": float(part.quantity), "unit_price": float(part.unit_price),
        "total": float(part.quantity * part.unit_price),
        "serial_item_id": part.serial_item_id, "status": part.status,
        "stock_document_id": part.stock_document_id,
        "issued_at": part.issued_at.isoformat() if part.issued_at else None,
    } for part, item in rows]


async def _payments(db: AsyncSession, tenant_id: str, ticket_id: str) -> list[dict]:
    rows = (await db.execute(
        select(POSMaintenancePayment)
        .where(POSMaintenancePayment.tenant_id == tenant_id, POSMaintenancePayment.ticket_id == ticket_id)
        .order_by(POSMaintenancePayment.created_at)
    )).scalars().all()
    return [{
        "id": row.id, "session_id": row.session_id, "amount": float(row.amount),
        "payment_method": row.payment_method, "journal_entry_id": row.journal_entry_id,
        "received_by": row.received_by, "created_at": row.created_at.isoformat(),
    } for row in rows]


async def _services(db: AsyncSession, tenant_id: str, ticket_id: str) -> list[dict]:
    rows = (await db.execute(select(POSMaintenanceServiceLine).where(
        POSMaintenanceServiceLine.tenant_id == tenant_id,
        POSMaintenanceServiceLine.ticket_id == ticket_id,
    ).order_by(POSMaintenanceServiceLine.created_at))).scalars().all()
    return [{"id": row.id, "service_name": row.service_name, "amount": float(row.amount), "created_by": row.created_by, "created_at": row.created_at.isoformat()} for row in rows]


async def _out(db: AsyncSession, tenant_id: str, ticket: POSMaintenanceTicket) -> dict:
    terminal = await db.get(POSTerminal, ticket.terminal_id)
    rep = await db.get(SalesRep, ticket.rep_id) if ticket.rep_id else None
    customer = await db.get(Customer, ticket.customer_id) if ticket.customer_id else None
    rep_name = None
    if rep:
        from app.models.user import User
        rep_user = await db.get(User, rep.user_id)
        rep_name = (rep_user.full_name if rep_user else None) or rep.rep_code
    data = {
        "id": ticket.id, "ticket_number": ticket.ticket_number,
        "terminal_id": ticket.terminal_id, "session_id": ticket.session_id, "maintenance_warehouse_id": ticket.maintenance_warehouse_id,
        "terminal_name": terminal.name if terminal else None,
        "branch_name": terminal.branch_name if terminal else None,
        "customer_id": ticket.customer_id, "customer_number": customer.customer_number if customer else None,
        "rep_id": ticket.rep_id, "invoice_id": ticket.invoice_id,
        "rep_name": rep_name,
        "status": ticket.status, "customer_name": ticket.customer_name,
        "customer_phone": ticket.customer_phone, "customer_email": ticket.customer_email,
        "customer_address": ticket.customer_address, "device_name": ticket.device_name,
        "device_color": ticket.device_color, "device_capacity": ticket.device_capacity,
        "device_serial": ticket.device_serial,
        "purchase_date": ticket.purchase_date.isoformat() if ticket.purchase_date else None,
        "lock_type": ticket.lock_type, "lock_secret_provided": bool(ticket.lock_secret_provided),
        "problem_type": ticket.problem_type,
        "symptoms": json.loads(ticket.symptoms_json) if ticket.symptoms_json else [],
        "attachment_urls": json.loads(ticket.attachment_urls_json) if ticket.attachment_urls_json else [],
        "reported_problem": ticket.reported_problem,
        "diagnosis": ticket.diagnosis, "notes": ticket.notes,
        "assigned_to": ticket.assigned_to, "estimated_cost": float(ticket.estimated_cost or 0),
        "approved_cost": float(ticket.approved_cost or 0), "paid_amount": float(ticket.paid_amount or 0),
        "created_at": ticket.created_at.isoformat(), "updated_at": ticket.updated_at.isoformat(),
    }
    data["parts"] = await _parts(db, tenant_id, ticket.id)
    data["parts_total"] = round(sum(p["total"] for p in data["parts"]), 2)
    data["payments"] = await _payments(db, tenant_id, ticket.id)
    data["services"] = await _services(db, tenant_id, ticket.id)
    data["services_total"] = round(sum(line["amount"] for line in data["services"]), 2)
    # approved_cost هو الإجمالي المعتمد الوحيد للتذكرة. يتم تحديثه عند إضافة
    # خدمة أو قطعة، لذلك لا نجمع تفاصيل الخدمات والقطع معه مرة ثانية هنا.
    # الجمع السابق كان يضاعف أجرة الإصلاح: حفظ 150 في approved_cost وإنشاء
    # سطر خدمة بقيمة 150 كان يعيد 300 ريال.
    data["approved_cost"] = round(float(ticket.approved_cost or 0), 2)
    data["outstanding"] = round(max(0.0, data["approved_cost"] - float(ticket.paid_amount or 0)), 2)
    return data


async def list_tickets(db: AsyncSession, tenant_id: str, status: str | None = None, terminal_id: str | None = None, session_id: str | None = None):
    q = select(POSMaintenanceTicket).where(POSMaintenanceTicket.tenant_id == tenant_id)
    if status:
        q = q.where(POSMaintenanceTicket.status == status)
    if terminal_id:
        q = q.where(POSMaintenanceTicket.terminal_id == terminal_id)
    if session_id:
        q = q.where(POSMaintenanceTicket.session_id == session_id)
    rows = (await db.execute(q.order_by(POSMaintenanceTicket.created_at.desc()).limit(300))).scalars().all()
    return [await _out(db, tenant_id, row) for row in rows]


async def management_report(
    db: AsyncSession,
    tenant_id: str,
    from_date: str | None = None,
    to_date: str | None = None,
    status: str | None = None,
    terminal_id: str | None = None,
):
    """تقرير إداري مستقل للصيانة: الأجهزة، العهدة، القطع، والتحصيل."""
    # يشمل طلبات نقاط البيع والطلبات التي أضافتها الإدارة، حتى لا تختفي التذاكر السابقة.
    q = select(POSMaintenanceTicket).where(POSMaintenanceTicket.tenant_id == tenant_id)
    try:
        if from_date:
            start = datetime.fromisoformat(from_date.replace("Z", "+00:00")).replace(tzinfo=None)
            q = q.where(POSMaintenanceTicket.created_at >= start)
        if to_date:
            end = datetime.fromisoformat(to_date.replace("Z", "+00:00")).replace(tzinfo=None)
            q = q.where(POSMaintenanceTicket.created_at <= end)
    except ValueError:
        raise HTTPException(400, "صيغة التاريخ غير صحيحة")
    if status:
        q = q.where(POSMaintenanceTicket.status == status)
    if terminal_id:
        q = q.where(POSMaintenanceTicket.terminal_id == terminal_id)

    rows = (await db.execute(q.order_by(POSMaintenanceTicket.created_at.desc()).limit(1000))).scalars().all()
    tickets = []
    terminal_totals: dict[str, dict] = {}
    approved_total = paid_total = parts_total = Decimal("0")
    issued_parts = 0
    terminal_cache: dict[str, POSTerminal | None] = {}
    for ticket in rows:
        details = await _out(db, tenant_id, ticket)
        ticket_parts = Decimal(str(details["parts_total"]))
        # approved_cost هو الإجمالي المحاسبي المعتمد، والتفاصيل للتوضيح فقط.
        approved = Decimal(str(ticket.approved_cost or 0))
        paid = Decimal(str(ticket.paid_amount or 0))
        fees = max(Decimal("0"), approved - ticket_parts)
        outstanding = max(Decimal("0"), approved - paid)
        issued = sum(1 for part in details["parts"] if part["status"] == "issued")
        issued_parts += issued
        approved_total += approved
        paid_total += paid
        parts_total += ticket_parts
        if ticket.terminal_id not in terminal_cache:
            terminal_cache[ticket.terminal_id] = await db.get(POSTerminal, ticket.terminal_id)
        terminal = terminal_cache[ticket.terminal_id]
        group = terminal_totals.setdefault(ticket.terminal_id, {
            "terminal_id": ticket.terminal_id,
            "terminal_name": terminal.name if terminal else ticket.terminal_id,
            "ticket_count": 0, "approved_total": Decimal("0"), "paid_total": Decimal("0"),
            "outstanding": Decimal("0"), "parts_total": Decimal("0"), "fees_total": Decimal("0"),
        })
        group["ticket_count"] += 1
        group["approved_total"] += approved
        group["paid_total"] += paid
        group["outstanding"] += outstanding
        group["parts_total"] += ticket_parts
        group["fees_total"] += fees
        tickets.append({**details, "parts_total": float(ticket_parts), "fees_total": float(fees), "outstanding": float(outstanding), "issued_parts": issued})

    def clean(group: dict) -> dict:
        return {key: (float(value) if isinstance(value, Decimal) else value) for key, value in group.items()}

    return {
        "summary": {
            "ticket_count": len(rows),
            "approved_total": float(approved_total),
            "paid_total": float(paid_total),
            "outstanding_total": float(max(Decimal("0"), approved_total - paid_total)),
            "parts_total": float(parts_total),
            "fees_total": float(max(Decimal("0"), approved_total - parts_total)),
            "issued_parts": issued_parts,
        },
        "by_terminal": [clean(group) for group in terminal_totals.values()],
        "tickets": tickets,
    }


async def create_ticket(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    terminal = await db.get(POSTerminal, data.get("terminal_id"))
    if not terminal or terminal.tenant_id != tenant_id or not terminal.is_active:
        raise HTTPException(404, "جهاز الكاشير غير موجود أو غير فعال")
    session_id = data.get("session_id") or None
    if session_id:
        session = await db.get(POSSession, session_id)
        if not session or session.tenant_id != tenant_id or session.terminal_id != terminal.id or session.status != "open":
            raise HTTPException(400, "جلسة الكاشير غير موجودة أو مغلقة أو لا تخص هذا الجهاز")
    warehouse_id = data.get("maintenance_warehouse_id") or terminal.maintenance_warehouse_id
    if not warehouse_id:
        raise HTTPException(400, "اربط جهاز الكاشير بمستودع صيانة أولاً")
    warehouse = await db.get(Warehouse, warehouse_id)
    if not warehouse or warehouse.tenant_id != tenant_id or not warehouse.is_active:
        raise HTTPException(400, "مستودع الصيانة غير موجود أو غير فعال")
    if data.get("assigned_to"):
        from app.models.user import User
        mechanic = await db.get(User, data["assigned_to"])
        if not mechanic or mechanic.tenant_id != tenant_id or not mechanic.is_active:
            raise HTTPException(400, "فني الصيانة غير موجود أو غير فعال")
    device_name = str(data.get("device_name") or "").strip()
    problem = str(data.get("reported_problem") or "").strip()
    if not device_name or not problem:
        raise HTTPException(400, "اسم الجهاز ووصف العطل مطلوبان")
    customer_id = data.get("customer_id") or None
    if customer_id:
        customer = await db.get(Customer, customer_id)
        if not customer or customer.tenant_id != tenant_id or not customer.is_active:
            raise HTTPException(400, "العميل غير موجود أو غير فعال")
    rep_id = data.get("rep_id") or None
    if rep_id:
        rep = await db.get(SalesRep, rep_id)
        if not rep or rep.tenant_id != tenant_id or not rep.is_active:
            raise HTTPException(400, "المندوب غير موجود أو غير فعال")
    now = datetime.utcnow()
    estimated_cost = Decimal(str(data.get("estimated_cost") or 0))
    approved_cost = Decimal(str(data.get("approved_cost") or 0))
    paid_amount = Decimal(str(data.get("paid_amount") or 0))
    if min(estimated_cost, approved_cost, paid_amount) < 0 or paid_amount > approved_cost:
        raise HTTPException(400, "مبلغ التحصيل لا يمكن أن يتجاوز أجرة الصيانة المعتمدة")
    if paid_amount > 0 and not session_id:
        raise HTTPException(400, "لا يمكن تسجيل تحصيل بدون جلسة كاشير مفتوحة")
    ticket = POSMaintenanceTicket(
        id=str(uuid.uuid4()), tenant_id=tenant_id, terminal_id=terminal.id,
        session_id=session_id,
        maintenance_warehouse_id=warehouse.id, ticket_number=await _next_number(db, tenant_id),
        customer_id=customer_id,
        rep_id=rep_id,
        customer_name=(data.get("customer_name") or None), customer_phone=(data.get("customer_phone") or None),
        customer_email=(data.get("customer_email") or None), customer_address=(data.get("customer_address") or None),
        device_name=device_name, device_color=(data.get("device_color") or None),
        device_capacity=(data.get("device_capacity") or None), device_serial=(data.get("device_serial") or None),
        purchase_date=datetime.strptime(data["purchase_date"], "%Y-%m-%d").date() if data.get("purchase_date") else None,
        lock_type=(data.get("lock_type") or None),
        lock_secret_encrypted=_encrypt_secret(data.get("lock_secret")),
        lock_secret_provided=bool(data.get("lock_secret")),
        problem_type=(data.get("problem_type") or None),
        symptoms_json=json.dumps(data.get("symptoms") or [], ensure_ascii=False),
        attachment_urls_json=json.dumps(data.get("attachment_urls") or [], ensure_ascii=False),
        reported_problem=problem, diagnosis=(data.get("diagnosis") or None), notes=(data.get("notes") or None),
        assigned_to=data.get("assigned_to") or None,
        estimated_cost=estimated_cost, approved_cost=approved_cost, paid_amount=paid_amount,
        created_by=user_id, created_at=now, updated_at=now,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return await _out(db, tenant_id, ticket)


async def update_ticket(db: AsyncSession, tenant_id: str, ticket_id: str, data: dict):
    ticket = await _ticket(db, tenant_id, ticket_id)
    # بعد التحصيل/إصدار الفاتورة لا نسمح بتغيير المبلغ أو الحالة المالية،
    # لكن يجب أن يستطيع المدير تصحيح تقرير الفحص والوصف دون إنشاء تذكرة جديدة.
    # شاشة POS كانت ترسل approved_cost مع diagnosis دائمًا، لذلك كان حفظ التقرير
    # يُرفض بالكامل حتى عندما لم يتغير السعر.
    if ticket.status == "cancelled" and any(key != "status" for key in data):
        raise HTTPException(400, "لا يمكن تعديل تذكرة مكتملة أو ملغاة؛ أنشئ إجراء تصحيح إداري مستقل")
    if ticket.status == "completed":
        allowed_completed = {"diagnosis", "notes", "reported_problem"}
        if any(key not in allowed_completed for key in data):
            raise HTTPException(400, "التذكرة مكتملة؛ يمكن تصحيح تقرير الفحص والوصف فقط، ولا يمكن تغيير السعر أو الحالة")
    if "status" in data and data["status"] not in MAINTENANCE_STATUSES:
        raise HTTPException(400, "حالة الصيانة غير صحيحة")
    if data.get("assigned_to"):
        from app.models.user import User
        mechanic = await db.get(User, data["assigned_to"])
        if not mechanic or mechanic.tenant_id != tenant_id or not mechanic.is_active:
            raise HTTPException(400, "فني الصيانة غير موجود أو غير فعال")
    if data.get("customer_id"):
        customer = await db.get(Customer, data["customer_id"])
        if not customer or customer.tenant_id != tenant_id or not customer.is_active:
            raise HTTPException(400, "العميل غير موجود أو غير فعال")
    if data.get("rep_id"):
        rep = await db.get(SalesRep, data["rep_id"])
        if not rep or rep.tenant_id != tenant_id or not rep.is_active:
            raise HTTPException(400, "المندوب غير موجود أو غير فعال")
    if data.get("terminal_id"):
        terminal = await db.get(POSTerminal, data["terminal_id"])
        if not terminal or terminal.tenant_id != tenant_id or not terminal.is_active or not terminal.maintenance_warehouse_id:
            raise HTTPException(400, "جهاز الكاشير غير صالح أو لا يوجد له مستودع صيانة")
        ticket.terminal_id = terminal.id
        ticket.maintenance_warehouse_id = terminal.maintenance_warehouse_id
    allowed = {"status", "customer_id", "rep_id", "customer_name", "customer_phone", "customer_email", "customer_address", "device_name", "device_color", "device_capacity", "device_serial", "purchase_date", "lock_type", "problem_type", "reported_problem", "diagnosis", "notes", "assigned_to", "estimated_cost", "approved_cost"}
    for key in allowed:
        if key in data:
            if key == "purchase_date" and data[key]:
                setattr(ticket, key, datetime.strptime(str(data[key]), "%Y-%m-%d").date())
            else:
                setattr(ticket, key, Decimal(str(data[key] or 0)) if key in {"estimated_cost", "approved_cost", "paid_amount"} else (data[key] or None if key not in {"status", "device_name", "reported_problem"} else data[key]))
    if "lock_secret" in data:
        ticket.lock_secret_encrypted = _encrypt_secret(data.get("lock_secret"))
        ticket.lock_secret_provided = bool(data.get("lock_secret"))
    if "symptoms" in data:
        ticket.symptoms_json = json.dumps(data.get("symptoms") or [], ensure_ascii=False)
    if "attachment_urls" in data:
        ticket.attachment_urls_json = json.dumps(data.get("attachment_urls") or [], ensure_ascii=False)
    if ticket.approved_cost is not None and ticket.paid_amount is not None:
        if min(Decimal(str(ticket.approved_cost)), Decimal(str(ticket.paid_amount))) < 0 or Decimal(str(ticket.paid_amount)) > Decimal(str(ticket.approved_cost)):
            raise HTTPException(400, "المبلغ المحصل لا يمكن أن يتجاوز المبلغ المعتمد")
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(ticket)
    return await _out(db, tenant_id, ticket)


async def delete_ticket(db: AsyncSession, tenant_id: str, ticket_id: str):
    ticket = await _ticket(db, tenant_id, ticket_id)
    if ticket.invoice_id:
        raise HTTPException(400, "لا يمكن حذف تذكرة لها فاتورة؛ ألغِ الفاتورة بإجراء إداري")
    payments = await db.scalar(select(func.count(POSMaintenancePayment.id)).where(POSMaintenancePayment.ticket_id == ticket.id))
    issued_parts = await db.scalar(select(func.count(POSMaintenancePart.id)).where(
        POSMaintenancePart.ticket_id == ticket.id, POSMaintenancePart.status == "issued"
    ))
    if payments or issued_parts:
        raise HTTPException(400, "لا يمكن حذف تذكرة عليها تحصيل أو قطع مصروفة؛ استخدم الإلغاء الإداري")
    await db.delete(ticket)
    await db.commit()
    return {"deleted": True, "id": ticket_id}


async def add_part(db: AsyncSession, tenant_id: str, ticket_id: str, data: dict):
    ticket = await _ticket(db, tenant_id, ticket_id)
    if ticket.status in {"closed", "cancelled"}:
        raise HTTPException(400, "لا يمكن إضافة قطعة إلى تذكرة مغلقة")
    item = await db.get(InventoryItem, data.get("product_id"))
    if not item or item.tenant_id != tenant_id or not item.is_active:
        raise HTTPException(404, "الصنف غير موجود أو غير فعال")
    quantity = Decimal(str(data.get("quantity") or 0))
    if quantity <= 0:
        raise HTTPException(400, "الكمية يجب أن تكون أكبر من صفر")
    tracking = getattr(item.tracking_type, "value", item.tracking_type)
    serial_id = data.get("serial_item_id") or None
    if tracking == "serial" and not serial_id:
        raise HTTPException(400, "اختر السيريال لقطعة الصيانة")
    if serial_id:
        serial = await db.get(SerialItem, serial_id)
        if not serial or serial.product_id != item.id or serial.warehouse_id != ticket.maintenance_warehouse_id or str(getattr(serial.status, "value", serial.status)) != "in_stock":
            raise HTTPException(400, "السيريال غير متاح في مستودع الصيانة")
        quantity = Decimal("1")
    price = Decimal(str(data.get("unit_price") if data.get("unit_price") is not None else item.sale_price or 0))
    part = POSMaintenancePart(
        id=str(uuid.uuid4()), tenant_id=tenant_id, ticket_id=ticket.id, product_id=item.id,
        quantity=quantity, unit_price=price, serial_item_id=serial_id,
    )
    db.add(part)
    ticket.approved_cost = Decimal(str(ticket.approved_cost or 0)) + (quantity * price)
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    return await _out(db, tenant_id, ticket)


async def get_part_serials(db: AsyncSession, tenant_id: str, ticket_id: str, product_id: str):
    ticket = await _ticket(db, tenant_id, ticket_id)
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "الصنف غير موجود")
    rows = (await db.execute(select(SerialItem).where(
        SerialItem.product_id == item.id,
        SerialItem.warehouse_id == ticket.maintenance_warehouse_id,
        SerialItem.status == "in_stock",
    ).order_by(SerialItem.created_at.desc()))).scalars().all()
    return [{"id": row.id, "serial_number": row.serial_number, "cost_price": float(row.cost_price or 0)} for row in rows]


async def get_terminal_part_serials(db: AsyncSession, tenant_id: str, terminal_id: str, product_id: str):
    terminal = await db.get(POSTerminal, terminal_id)
    if not terminal or terminal.tenant_id != tenant_id or not terminal.maintenance_warehouse_id:
        raise HTTPException(400, "لا يوجد مستودع صيانة مربوط بالجهاز")
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "الصنف غير موجود")
    rows = (await db.execute(select(SerialItem).where(
        SerialItem.product_id == item.id,
        SerialItem.warehouse_id == terminal.maintenance_warehouse_id,
        SerialItem.status == "in_stock",
    ).order_by(SerialItem.created_at.desc()))).scalars().all()
    return [{"id": row.id, "serial_number": row.serial_number, "cost_price": float(row.cost_price or 0)} for row in rows]


async def issue_part(db: AsyncSession, tenant_id: str, user_id: str, ticket_id: str, part_id: str):
    ticket = await _ticket(db, tenant_id, ticket_id)
    if ticket.status in {"completed", "cancelled"}:
        raise HTTPException(400, "لا يمكن صرف قطعة لتذكرة مكتملة أو ملغاة")
    part = await db.scalar(select(POSMaintenancePart).where(POSMaintenancePart.id == part_id, POSMaintenancePart.ticket_id == ticket.id, POSMaintenancePart.tenant_id == tenant_id))
    if not part:
        raise HTTPException(404, "قطعة الصيانة غير موجودة")
    if part.status == "issued":
        return await _out(db, tenant_id, ticket)
    item = await db.get(InventoryItem, part.product_id)
    tracking = getattr(item.tracking_type, "value", item.tracking_type)
    if tracking == "serial":
        serial = await db.get(SerialItem, part.serial_item_id)
        if not serial or serial.product_id != item.id or serial.warehouse_id != ticket.maintenance_warehouse_id or str(getattr(serial.status, "value", serial.status)) != "in_stock":
            raise HTTPException(400, "السيريال غير متاح في مستودع الصيانة")
        from app.models.inventory import StockMovement
        serial.status = "damaged"
        serial.warehouse_id = None
        db.add(StockMovement(
            id=str(uuid.uuid4()), tenant_id=tenant_id, product_id=item.id,
            warehouse_id=ticket.maintenance_warehouse_id, movement_type="damage", quantity=Decimal("-1"),
            unit_cost=serial.cost_price, serial_item_id=serial.id,
            reference_type="pos_maintenance", reference_id=ticket.id,
            notes=f"صرف سيريال للصيانة {ticket.ticket_number}", created_by=user_id,
        ))
        part.status = "issued"
        part.issued_by = user_id
        part.issued_at = datetime.utcnow()
        if ticket.status == "open":
            ticket.status = "in_progress"
        ticket.updated_at = datetime.utcnow()
        await db.commit()
        return await _out(db, tenant_id, ticket)
    stock = await db.scalar(select(InventoryStock).where(InventoryStock.item_id == item.id, InventoryStock.warehouse_id == ticket.maintenance_warehouse_id))
    if not stock or stock.quantity < part.quantity:
        raise HTTPException(400, f"الكمية المتاحة في مستودع الصيانة غير كافية للصنف {item.name_ar}")
    from app.modules.inventory.service import deduct_stock
    await deduct_stock(db, tenant_id, item.id, part.quantity, ticket.maintenance_warehouse_id, "pos_maintenance", ticket.id, user_id, auto_commit=False)
    part.status = "issued"
    part.issued_by = user_id
    part.issued_at = datetime.utcnow()
    if ticket.status == "open":
        ticket.status = "in_progress"
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    return await _out(db, tenant_id, ticket)


async def record_payment(db: AsyncSession, tenant_id: str, user_id: str, ticket_id: str, data: dict):
    ticket = await _ticket(db, tenant_id, ticket_id)
    if ticket.status == "cancelled":
        raise HTTPException(400, "لا يمكن تحصيل تذكرة ملغاة")
    amount = Decimal(str(data.get("amount") or 0))
    if amount <= 0:
        raise HTTPException(400, "مبلغ الدفعة يجب أن يكون أكبر من صفر")
    # استخدم نفس الإجمالي الذي تعرضه التذكرة والواجهة؛ لا تعُد إلى جمع
    # تفاصيل الخدمات والقطع فوق approved_cost أثناء قبول الدفعة.
    effective_total = Decimal(str(ticket.approved_cost or 0))
    outstanding = effective_total - Decimal(str(ticket.paid_amount or 0))
    if amount > outstanding:
        raise HTTPException(400, "مبلغ الدفعة أكبر من المتبقي على التذكرة")
    session_id = data.get("session_id") or ticket.session_id
    if not session_id:
        raise HTTPException(400, "اختر جلسة كاشير مفتوحة للتحصيل")
    session = await db.get(POSSession, session_id)
    if not session or session.tenant_id != tenant_id or session.status != "open" or session.terminal_id != ticket.terminal_id:
        raise HTTPException(400, "جلسة الكاشير غير صالحة أو لا تخص جهاز التذكرة")
    method = str(data.get("payment_method") or "cash")
    if method != "cash":
        raise HTTPException(400, "تحصيل الصيانة النقدي فقط في هذه المرحلة")
    db.add(POSMaintenancePayment(
        id=str(uuid.uuid4()), tenant_id=tenant_id, ticket_id=ticket.id,
        session_id=session.id, amount=amount, payment_method=method,
        received_by=user_id, created_at=datetime.utcnow(),
    ))
    ticket.paid_amount = Decimal(str(ticket.paid_amount or 0)) + amount
    ticket.session_id = session.id
    ticket.updated_at = datetime.utcnow()
    if ticket.approved_cost and ticket.paid_amount >= ticket.approved_cost:
        ticket.status = "completed"
    await db.commit()
    return await _out(db, tenant_id, ticket)


async def add_service(db: AsyncSession, tenant_id: str, user_id: str, ticket_id: str, data: dict):
    ticket = await _ticket(db, tenant_id, ticket_id)
    if ticket.status in {"completed", "cancelled"}:
        raise HTTPException(400, "لا يمكن إضافة خدمة لتذكرة مكتملة أو ملغاة")
    name = str(data.get("service_name") or "").strip()
    amount = Decimal(str(data.get("amount") or 0))
    if not name or amount <= 0:
        raise HTTPException(400, "اسم الخدمة والسعر مطلوبان ويجب أن يكون السعر أكبر من صفر")
    db.add(POSMaintenanceServiceLine(
        id=str(uuid.uuid4()), tenant_id=tenant_id, ticket_id=ticket.id,
        service_name=name, amount=amount, created_by=user_id, created_at=datetime.utcnow(),
    ))
    ticket.approved_cost = Decimal(str(ticket.approved_cost or 0)) + amount
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    return await _out(db, tenant_id, ticket)


async def issue_invoice(db: AsyncSession, tenant_id: str, user_id: str, ticket_id: str):
    ticket = await _ticket(db, tenant_id, ticket_id)
    if ticket.invoice_id:
        raise HTTPException(400, "تم إصدار فاتورة لهذه التذكرة مسبقًا")
    if not ticket.customer_id:
        raise HTTPException(400, "اربط التذكرة بعميل قبل إصدار الفاتورة")
    services = await _services(db, tenant_id, ticket.id)
    parts = await _parts(db, tenant_id, ticket.id)
    lines = [InvoiceLineCreate(
        description_ar=line["service_name"], description_en=line["service_name"],
        quantity=Decimal("1"), unit_price=Decimal(str(line["amount"])),
        vat_rate=Decimal("15"), prices_include_vat=True, line_order=index,
    ) for index, line in enumerate(services)]
    lines.extend(InvoiceLineCreate(
        description_ar=f"قطعة صيانة: {line['product_name']}", description_en=f"Maintenance part: {line['product_name']}",
        quantity=Decimal(str(line["quantity"])), unit_price=Decimal(str(line["unit_price"])),
        vat_rate=Decimal("15"), prices_include_vat=True, line_order=len(lines) + index,
    ) for index, line in enumerate(parts))
    if not lines:
        raise HTTPException(400, "أضف خدمة أو قطعة قبل إصدار الفاتورة")
    from app.modules.sales.service import create_invoice, confirm_invoice
    now = datetime.utcnow()
    invoice = await create_invoice(db, tenant_id, user_id, InvoiceCreate(
        customer_id=ticket.customer_id, invoice_type=InvoiceType.STANDARD,
        issue_date=now, supply_date=now, invoice_payment_method=InvoicePaymentMethod.CREDIT,
        notes=f"فاتورة صيانة — {ticket.ticket_number}", lines=lines,
    ))
    invoice = await confirm_invoice(db, tenant_id, user_id, invoice.id)
    ticket.invoice_id = invoice.id
    ticket.status = "completed"
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    rep = await db.get(SalesRep, ticket.rep_id) if ticket.rep_id else None
    if rep and rep.user_id:
        from app.modules.notifications.service import notify_users_event
        await notify_users_event(
            db, tenant_id, user_id, [rep.user_id],
            "تم إصدار فاتورة صيانة", "Maintenance invoice issued",
            f"تمت صيانة جهاز {ticket.device_name} وإصدار الفاتورة {invoice.invoice_number} بمبلغ {invoice.total} ريال.",
            f"Device {ticket.device_name} was serviced. Invoice {invoice.invoice_number} total: {invoice.total} SAR.",
            ticket.id, "pos_maintenance_invoice",
        )
    return {**(await _out(db, tenant_id, ticket)), "invoice_number": invoice.invoice_number, "invoice_total": float(invoice.total)}
