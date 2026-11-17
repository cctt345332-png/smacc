"""خدمة صيانة نقاط البيع — منفصلة عن الفواتير والبيع والتقارير اليومية."""
import uuid
from datetime import datetime
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pos import POSTerminal
from app.models.pos_maintenance import POSMaintenanceTicket, POSMaintenancePart
from app.models.inventory import InventoryItem, InventoryStock, SerialItem, Warehouse


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


async def _out(db: AsyncSession, tenant_id: str, ticket: POSMaintenanceTicket) -> dict:
    data = {
        "id": ticket.id, "ticket_number": ticket.ticket_number,
        "terminal_id": ticket.terminal_id, "maintenance_warehouse_id": ticket.maintenance_warehouse_id,
        "status": ticket.status, "customer_name": ticket.customer_name,
        "customer_phone": ticket.customer_phone, "device_name": ticket.device_name,
        "device_serial": ticket.device_serial, "reported_problem": ticket.reported_problem,
        "diagnosis": ticket.diagnosis, "notes": ticket.notes,
        "assigned_to": ticket.assigned_to, "estimated_cost": float(ticket.estimated_cost or 0),
        "approved_cost": float(ticket.approved_cost or 0), "paid_amount": float(ticket.paid_amount or 0),
        "created_at": ticket.created_at.isoformat(), "updated_at": ticket.updated_at.isoformat(),
    }
    data["parts"] = await _parts(db, tenant_id, ticket.id)
    data["parts_total"] = round(sum(p["total"] for p in data["parts"]), 2)
    return data


async def list_tickets(db: AsyncSession, tenant_id: str, status: str | None = None, terminal_id: str | None = None):
    q = select(POSMaintenanceTicket).where(POSMaintenanceTicket.tenant_id == tenant_id)
    if status:
        q = q.where(POSMaintenanceTicket.status == status)
    if terminal_id:
        q = q.where(POSMaintenanceTicket.terminal_id == terminal_id)
    rows = (await db.execute(q.order_by(POSMaintenanceTicket.created_at.desc()).limit(300))).scalars().all()
    return [await _out(db, tenant_id, row) for row in rows]


async def create_ticket(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    terminal = await db.get(POSTerminal, data.get("terminal_id"))
    if not terminal or terminal.tenant_id != tenant_id or not terminal.is_active:
        raise HTTPException(404, "جهاز الكاشير غير موجود أو غير فعال")
    warehouse_id = data.get("maintenance_warehouse_id") or terminal.maintenance_warehouse_id
    if not warehouse_id:
        raise HTTPException(400, "اربط جهاز الكاشير بمستودع صيانة أولاً")
    warehouse = await db.get(Warehouse, warehouse_id)
    if not warehouse or warehouse.tenant_id != tenant_id or not warehouse.is_active:
        raise HTTPException(400, "مستودع الصيانة غير موجود أو غير فعال")
    device_name = str(data.get("device_name") or "").strip()
    problem = str(data.get("reported_problem") or "").strip()
    if not device_name or not problem:
        raise HTTPException(400, "اسم الجهاز ووصف العطل مطلوبان")
    now = datetime.utcnow()
    ticket = POSMaintenanceTicket(
        id=str(uuid.uuid4()), tenant_id=tenant_id, terminal_id=terminal.id,
        maintenance_warehouse_id=warehouse.id, ticket_number=await _next_number(db, tenant_id),
        customer_name=(data.get("customer_name") or None), customer_phone=(data.get("customer_phone") or None),
        device_name=device_name, device_serial=(data.get("device_serial") or None),
        reported_problem=problem, diagnosis=(data.get("diagnosis") or None), notes=(data.get("notes") or None),
        assigned_to=data.get("assigned_to") or None,
        estimated_cost=Decimal(str(data.get("estimated_cost") or 0)),
        created_by=user_id, created_at=now, updated_at=now,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return await _out(db, tenant_id, ticket)


async def update_ticket(db: AsyncSession, tenant_id: str, ticket_id: str, data: dict):
    ticket = await _ticket(db, tenant_id, ticket_id)
    allowed = {"status", "customer_name", "customer_phone", "device_name", "device_serial", "reported_problem", "diagnosis", "notes", "assigned_to", "estimated_cost", "approved_cost", "paid_amount"}
    for key in allowed:
        if key in data:
            setattr(ticket, key, Decimal(str(data[key] or 0)) if key in {"estimated_cost", "approved_cost", "paid_amount"} else (data[key] or None if key not in {"status", "device_name", "reported_problem"} else data[key]))
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(ticket)
    return await _out(db, tenant_id, ticket)


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
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    return await _out(db, tenant_id, ticket)


async def issue_part(db: AsyncSession, tenant_id: str, user_id: str, ticket_id: str, part_id: str):
    ticket = await _ticket(db, tenant_id, ticket_id)
    part = await db.scalar(select(POSMaintenancePart).where(POSMaintenancePart.id == part_id, POSMaintenancePart.ticket_id == ticket.id, POSMaintenancePart.tenant_id == tenant_id))
    if not part:
        raise HTTPException(404, "قطعة الصيانة غير موجودة")
    if part.status == "issued":
        return await _out(db, tenant_id, ticket)
    item = await db.get(InventoryItem, part.product_id)
    tracking = getattr(item.tracking_type, "value", item.tracking_type)
    if tracking == "serial":
        raise HTTPException(400, "صرف القطع ذات السيريال سيُفعل في خطوة ربط السيريال بتذكرة الصيانة")
    stock = await db.scalar(select(InventoryStock).where(InventoryStock.item_id == item.id, InventoryStock.warehouse_id == ticket.maintenance_warehouse_id))
    if not stock or stock.quantity < part.quantity:
        raise HTTPException(400, f"الكمية المتاحة في مستودع الصيانة غير كافية للصنف {item.name_ar}")
    from app.modules.inventory.service import deduct_stock
    await deduct_stock(db, tenant_id, item.id, part.quantity, ticket.maintenance_warehouse_id, "pos_maintenance", ticket.id, user_id, auto_commit=False)
    part.status = "issued"
    part.issued_by = user_id
    part.issued_at = datetime.utcnow()
    ticket.updated_at = datetime.utcnow()
    await db.commit()
    return await _out(db, tenant_id, ticket)
