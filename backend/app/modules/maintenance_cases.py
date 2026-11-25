"""واجهة التشغيل الجديدة للصيانة، مستقلة عن نظام POS القديم."""
import json
import uuid
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db
from app.core.tenant import get_current_user, require_role
from app.models.maintenance_case import MaintenanceCase, MaintenanceCaseStatusLog, MaintenanceInspection, MaintenanceInspectionPart, MaintenanceBilling
from app.models.inventory import InventoryItem, InventoryStock, Warehouse
from app.modules.inventory.service import add_stock, deduct_stock
from app.models.sales import InvoiceType, InvoicePaymentMethod
from app.modules.sales.schemas import InvoiceCreate, InvoiceLineCreate

router = APIRouter(prefix="/maintenance-cases", tags=["maintenance-cases"])
WORKFLOW = {
    "received": {"awaiting_inspection", "cancelled", "unrepairable"},
    "awaiting_inspection": {"inspected", "cancelled", "unrepairable"},
    "inspected": {"awaiting_customer_approval", "awaiting_parts", "in_repair", "cancelled", "unrepairable"},
    "awaiting_customer_approval": {"awaiting_parts", "in_repair", "cancelled", "unrepairable"},
    "awaiting_parts": {"in_repair", "cancelled", "unrepairable"},
    "in_repair": {"testing", "awaiting_parts", "unrepairable"},
    "testing": {"ready", "in_repair", "unrepairable"},
    "ready": {"delivered"},
    "delivered": set(), "cancelled": set(), "unrepairable": set(),
}
LABELS = {
    "received": "تم الاستلام", "awaiting_inspection": "بانتظار الفحص", "inspected": "تم الفحص",
    "awaiting_customer_approval": "بانتظار موافقة العميل", "awaiting_parts": "بانتظار قطع الغيار",
    "in_repair": "تحت الإصلاح", "testing": "تحت الاختبار", "ready": "جاهز للتسليم",
    "delivered": "تم التسليم", "cancelled": "ملغي", "unrepairable": "غير قابل للإصلاح",
}

async def _case(db, tenant_id, case_id):
    case = await db.scalar(select(MaintenanceCase).where(MaintenanceCase.id == case_id, MaintenanceCase.tenant_id == tenant_id))
    if not case:
        raise HTTPException(404, "طلب الصيانة غير موجود")
    return case

async def _inspection_out(db, tenant_id, case_id):
    inspection = await db.scalar(select(MaintenanceInspection).where(MaintenanceInspection.case_id == case_id, MaintenanceInspection.tenant_id == tenant_id))
    if not inspection:
        return None
    rows = (await db.execute(select(MaintenanceInspectionPart, InventoryItem).join(InventoryItem, InventoryItem.id == MaintenanceInspectionPart.product_id).where(MaintenanceInspectionPart.inspection_id == inspection.id).order_by(MaintenanceInspectionPart.created_at))).all()
    return {"id": inspection.id, "diagnosis": inspection.diagnosis, "failure_cause": inspection.failure_cause, "repair_required": inspection.repair_required, "warranty_status": inspection.warranty_status, "cost_responsibility": inspection.cost_responsibility, "labor_amount": float(inspection.labor_amount or 0), "expected_days": inspection.expected_days, "customer_approval": inspection.customer_approval, "customer_approved_at": inspection.customer_approved_at.isoformat() if inspection.customer_approved_at else None, "parts": [{"id": part.id, "product_id": part.product_id, "product_name": item.name_ar, "sku": item.sku, "quantity": float(part.quantity), "unit_price": float(part.unit_price), "status": part.status, "warehouse_id": part.warehouse_id, "issued_by": part.issued_by, "issued_at": part.issued_at.isoformat() if part.issued_at else None, "returned_by": part.returned_by, "returned_at": part.returned_at.isoformat() if part.returned_at else None} for part, item in rows]}


async def _billing_out(db, tenant_id, case_id):
    billing = await db.scalar(select(MaintenanceBilling).where(MaintenanceBilling.case_id == case_id, MaintenanceBilling.tenant_id == tenant_id))
    if not billing: return None
    return {"id": billing.id, "labor_amount": float(billing.labor_amount or 0), "parts_amount": float(billing.parts_amount or 0), "discount_amount": float(billing.discount_amount or 0), "vat_amount": float(billing.vat_amount or 0), "total_amount": float(billing.total_amount or 0), "invoice_id": billing.invoice_id, "created_at": billing.created_at.isoformat(), "updated_at": billing.updated_at.isoformat()}


async def _out(db, tenant_id, case):
    inspection = await _inspection_out(db, tenant_id, case.id)
    logs = (await db.execute(select(MaintenanceCaseStatusLog).where(MaintenanceCaseStatusLog.case_id == case.id).order_by(MaintenanceCaseStatusLog.created_at))).scalars().all()
    return {"id": case.id, "case_number": case.case_number, "status": case.status, "status_label": LABELS.get(case.status, case.status), "source": case.source, "terminal_id": case.terminal_id, "customer_id": case.customer_id, "rep_id": case.rep_id, "device_name": case.device_name, "device_model": case.device_model, "device_serial": case.device_serial, "customer_name": case.customer_name, "customer_phone": case.customer_phone, "purchase_date": case.purchase_date.isoformat() if case.purchase_date else None, "reported_problem": case.reported_problem, "device_condition": case.device_condition, "received_accessories": case.received_accessories, "attachment_urls": json.loads(case.attachment_urls_json or "[]"), "created_by": case.created_by, "received_by": case.received_by, "created_at": case.created_at.isoformat(), "updated_at": case.updated_at.isoformat(), "inspection": inspection, "billing": await _billing_out(db, tenant_id, case.id), "status_history": [{"from_status": x.from_status, "to_status": x.to_status, "status_label": LABELS.get(x.to_status, x.to_status), "note": x.note, "changed_by": x.changed_by, "created_at": x.created_at.isoformat()} for x in logs]}

@router.get("")
async def list_cases(status: str | None = None, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(MaintenanceCase).where(MaintenanceCase.tenant_id == user["tenant_id"])
    if status: q = q.where(MaintenanceCase.status == status)
    rows = (await db.execute(q.order_by(MaintenanceCase.created_at.desc()).limit(500))).scalars().all()
    return [await _out(db, user["tenant_id"], row) for row in rows]

@router.post("", status_code=201)
async def create_case(data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    required = ["device_name", "customer_name", "customer_phone", "reported_problem"]
    if any(not str(data.get(key) or "").strip() for key in required):
        raise HTTPException(400, "الجهاز واسم العميل ورقم الجوال ووصف العطل حقول مطلوبة")
    count = await db.scalar(select(func.count(MaintenanceCase.id)).where(MaintenanceCase.tenant_id == user["tenant_id"]))
    now = datetime.utcnow(); case_id = str(uuid.uuid4())
    case = MaintenanceCase(id=case_id, tenant_id=user["tenant_id"], case_number=f"MNT-{int(count or 0)+1:06d}", status="received", source=data.get("source") or "management", terminal_id=data.get("terminal_id") or None, customer_id=data.get("customer_id") or None, rep_id=data.get("rep_id") or None, device_name=str(data["device_name"]).strip(), device_model=data.get("device_model") or None, device_serial=data.get("device_serial") or None, customer_name=str(data["customer_name"]).strip(), customer_phone=str(data["customer_phone"]).strip(), purchase_date=datetime.strptime(data["purchase_date"], "%Y-%m-%d").date() if data.get("purchase_date") else None, reported_problem=str(data["reported_problem"]).strip(), device_condition=data.get("device_condition") or None, received_accessories=data.get("received_accessories") or None, attachment_urls_json=json.dumps(data.get("attachment_urls") or [], ensure_ascii=False), created_by=user["user_id"], received_by=user["user_id"], created_at=now, updated_at=now)
    db.add(case); db.add(MaintenanceCaseStatusLog(id=str(uuid.uuid4()), tenant_id=user["tenant_id"], case_id=case_id, to_status="received", note="إنشاء طلب استلام جديد", changed_by=user["user_id"], created_at=now))
    await db.commit(); await db.refresh(case)
    return await _out(db, user["tenant_id"], case)

@router.get("/{case_id}")
async def get_case(case_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _out(db, user["tenant_id"], await _case(db, user["tenant_id"], case_id))

@router.post("/{case_id}/status")
async def change_status(case_id: str, data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    case = await _case(db, user["tenant_id"], case_id); target = str(data.get("status") or "")
    if target not in WORKFLOW.get(case.status, set()): raise HTTPException(400, "الانتقال المطلوب غير مسموح؛ يجب اتباع دورة الصيانة بالترتيب")
    now = datetime.utcnow(); old = case.status; case.status = target; case.updated_at = now
    db.add(MaintenanceCaseStatusLog(id=str(uuid.uuid4()), tenant_id=user["tenant_id"], case_id=case.id, from_status=old, to_status=target, note=data.get("note") or None, changed_by=user["user_id"], created_at=now))
    await db.commit(); return await _out(db, user["tenant_id"], case)


@router.get("/{case_id}/inspection")
async def get_inspection(case_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _case(db, user["tenant_id"], case_id)
    return await _inspection_out(db, user["tenant_id"], case_id)

@router.post("/{case_id}/inspection")
async def save_inspection(case_id: str, data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    case = await _case(db, user["tenant_id"], case_id)
    if case.status not in {"awaiting_inspection", "inspected"}:
        raise HTTPException(400, "ابدأ مرحلة الفحص أولاً قبل حفظ التقرير")
    diagnosis = str(data.get("diagnosis") or "").strip()
    if not diagnosis:
        raise HTTPException(400, "نتيجة الفحص مطلوبة")
    inspection = await db.scalar(select(MaintenanceInspection).where(MaintenanceInspection.case_id == case.id))
    now = datetime.utcnow()
    if not inspection:
        inspection = MaintenanceInspection(id=str(uuid.uuid4()), tenant_id=user["tenant_id"], case_id=case.id, created_by=user["user_id"], created_at=now, updated_at=now)
        db.add(inspection)
    inspection.diagnosis = diagnosis; inspection.failure_cause = data.get("failure_cause") or None; inspection.repair_required = data.get("repair_required") or None
    inspection.warranty_status = data.get("warranty_status") or "unknown"; inspection.cost_responsibility = data.get("cost_responsibility") or "customer"
    inspection.labor_amount = data.get("labor_amount") or 0; inspection.expected_days = data.get("expected_days") or None; inspection.updated_at = now
    if case.status == "awaiting_inspection":
        old = case.status; case.status = "inspected"; case.updated_at = now
        db.add(MaintenanceCaseStatusLog(id=str(uuid.uuid4()), tenant_id=user["tenant_id"], case_id=case.id, from_status=old, to_status="inspected", note="تم حفظ تقرير الفحص", changed_by=user["user_id"], created_at=now))
    for line in data.get("parts") or []:
        product = await db.get(InventoryItem, line.get("product_id"))
        if not product or product.tenant_id != user["tenant_id"] or not product.is_active:
            raise HTTPException(400, "قطعة الغيار غير موجودة في الكتالوج")
        db.add(MaintenanceInspectionPart(id=str(uuid.uuid4()), tenant_id=user["tenant_id"], inspection_id=inspection.id, product_id=product.id, quantity=line.get("quantity") or 1, unit_price=line.get("unit_price") if line.get("unit_price") is not None else product.sale_price or 0, status="requested", created_at=now))
    await db.commit(); return await _out(db, user["tenant_id"], case)


@router.post("/{case_id}/approval")
async def customer_approval(case_id: str, data: dict, user=Depends(require_role(["manager", "cashier"])), db: AsyncSession = Depends(get_db)):
    case = await _case(db, user["tenant_id"], case_id)
    if case.status not in {"inspected", "awaiting_customer_approval"}:
        raise HTTPException(400, "لا يمكن تسجيل موافقة قبل اكتمال تقرير الفحص")
    approved = bool(data.get("approved")); now = datetime.utcnow(); old = case.status; inspection = None
    if approved:
        inspection = await db.scalar(select(MaintenanceInspection).where(MaintenanceInspection.case_id == case.id))
        part_count = await db.scalar(select(func.count(MaintenanceInspectionPart.id)).where(MaintenanceInspectionPart.inspection_id == inspection.id)) if inspection else 0
        target = "awaiting_parts" if part_count else "in_repair"
    else:
        target = "cancelled"
    if old == "inspected" and target not in WORKFLOW[old]:
        raise HTTPException(400, "حالة الموافقة غير متوافقة مع دورة الصيانة")
    case.status = target; case.updated_at = now
    if inspection:
        inspection.customer_approval = "approved" if approved else "rejected"; inspection.customer_approved_at = now if approved else None
    db.add(MaintenanceCaseStatusLog(id=str(uuid.uuid4()), tenant_id=user["tenant_id"], case_id=case.id, from_status=old, to_status=target, note=data.get("note") or ("تمت موافقة العميل" if approved else "رفض العميل الإصلاح"), changed_by=user["user_id"], created_at=now))
    await db.commit(); return await _out(db, user["tenant_id"], case)

@router.post("/{case_id}/parts/{part_id}/reserve")
async def reserve_part(case_id: str, part_id: str, data: dict, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    case = await _case(db, user["tenant_id"], case_id)
    part = await db.scalar(select(MaintenanceInspectionPart).where(MaintenanceInspectionPart.id == part_id, MaintenanceInspectionPart.tenant_id == user["tenant_id"]))
    if not part: raise HTTPException(404, "قطعة الصيانة غير موجودة")
    if part.status != "requested": raise HTTPException(400, "لا يمكن حجز القطعة في حالتها الحالية")
    warehouse = await db.get(Warehouse, data.get("warehouse_id"))
    stock = await db.scalar(select(InventoryStock).where(InventoryStock.tenant_id == user["tenant_id"], InventoryStock.item_id == part.product_id, InventoryStock.warehouse_id == data.get("warehouse_id")))
    if not warehouse or warehouse.tenant_id != user["tenant_id"] or not stock or stock.quantity - stock.reserved_qty < part.quantity:
        raise HTTPException(400, "الكمية المتاحة في المستودع غير كافية للحجز")
    stock.reserved_qty += part.quantity; part.warehouse_id = warehouse.id; part.status = "reserved"
    await db.commit(); return await _out(db, user["tenant_id"], case)

@router.post("/{case_id}/parts/{part_id}/issue")
async def issue_part(case_id: str, part_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    case = await _case(db, user["tenant_id"], case_id)
    part = await db.scalar(select(MaintenanceInspectionPart).where(MaintenanceInspectionPart.id == part_id, MaintenanceInspectionPart.tenant_id == user["tenant_id"]))
    if not part: raise HTTPException(404, "قطعة الصيانة غير موجودة")
    if part.status == "issued": return await _out(db, user["tenant_id"], case)
    if part.status != "reserved" or not part.warehouse_id: raise HTTPException(400, "احجز القطعة من مستودع أولاً")
    stock = await db.scalar(select(InventoryStock).where(InventoryStock.item_id == part.product_id, InventoryStock.warehouse_id == part.warehouse_id, InventoryStock.tenant_id == user["tenant_id"]))
    if not stock or stock.quantity < part.quantity: raise HTTPException(400, "المخزون غير كافٍ للصرف")
    stock.reserved_qty = max(Decimal("0"), stock.reserved_qty - part.quantity)
    await deduct_stock(db, user["tenant_id"], part.product_id, Decimal(str(part.quantity)), part.warehouse_id, "maintenance_case", case.id, user["user_id"], auto_commit=False)
    part.status = "issued"; part.issued_by = user["user_id"]; part.issued_at = datetime.utcnow()
    if case.status == "awaiting_parts": case.status = "in_repair"; case.updated_at = datetime.utcnow()
    await db.commit(); return await _out(db, user["tenant_id"], case)

@router.post("/{case_id}/parts/{part_id}/return")
async def return_part(case_id: str, part_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    case = await _case(db, user["tenant_id"], case_id)
    part = await db.scalar(select(MaintenanceInspectionPart).where(MaintenanceInspectionPart.id == part_id, MaintenanceInspectionPart.tenant_id == user["tenant_id"]))
    if not part: raise HTTPException(404, "قطعة الصيانة غير موجودة")
    if part.status == "returned": return await _out(db, user["tenant_id"], case)
    if part.status != "issued" or not part.warehouse_id: raise HTTPException(400, "لا يمكن إرجاع قطعة غير مصروفة")
    await add_stock(db, user["tenant_id"], part.product_id, Decimal(str(part.quantity)), Decimal(str(part.unit_price or 0)), part.warehouse_id, "maintenance_case_return", case.id, user["user_id"], auto_commit=False, movement_type="return_in")
    part.status = "returned"; part.returned_by = user["user_id"]; part.returned_at = datetime.utcnow()
    await db.commit(); return await _out(db, user["tenant_id"], case)


@router.post("/{case_id}/billing")
async def calculate_billing(case_id: str, data: dict, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    case = await _case(db, user["tenant_id"], case_id)
    inspection = await db.scalar(select(MaintenanceInspection).where(MaintenanceInspection.case_id == case.id))
    if not inspection: raise HTTPException(400, "احفظ تقرير الفحص أولاً")
    parts = (await db.execute(select(MaintenanceInspectionPart).where(MaintenanceInspectionPart.inspection_id == inspection.id))).scalars().all()
    labor = Decimal(str(data.get("labor_amount") if data.get("labor_amount") is not None else inspection.labor_amount or 0)); discount = Decimal(str(data.get("discount_amount") or 0))
    parts_total = sum((Decimal(str(x.quantity)) * Decimal(str(x.unit_price)) for x in parts), Decimal("0"))
    taxable = max(Decimal("0"), labor + parts_total - discount); vat = (taxable * Decimal("0.15") / Decimal("1.15")).quantize(Decimal("0.01")); total = taxable
    billing = await db.scalar(select(MaintenanceBilling).where(MaintenanceBilling.case_id == case.id))
    now = datetime.utcnow()
    if not billing:
        billing = MaintenanceBilling(id=str(uuid.uuid4()), tenant_id=user["tenant_id"], case_id=case.id, created_by=user["user_id"], created_at=now, updated_at=now); db.add(billing)
    billing.labor_amount = labor; billing.parts_amount = parts_total; billing.discount_amount = discount; billing.vat_amount = vat; billing.total_amount = total; billing.updated_at = now
    await db.commit(); return await _out(db, user["tenant_id"], case)

@router.post("/{case_id}/invoice")
async def issue_maintenance_invoice(case_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    case = await _case(db, user["tenant_id"], case_id); billing = await db.scalar(select(MaintenanceBilling).where(MaintenanceBilling.case_id == case.id))
    if not billing: raise HTTPException(400, "احسب قيمة طلب الصيانة أولاً")
    if billing.invoice_id: return await _out(db, user["tenant_id"], case)
    if not case.customer_id: raise HTTPException(400, "اربط الطلب بعميل مسجل قبل إصدار الفاتورة")
    inspection = await db.scalar(select(MaintenanceInspection).where(MaintenanceInspection.case_id == case.id)); parts = (await db.execute(select(MaintenanceInspectionPart).where(MaintenanceInspectionPart.inspection_id == inspection.id))).scalars().all() if inspection else []
    lines = []
    if billing.labor_amount > 0: lines.append(InvoiceLineCreate(description_ar="أجرة صيانة", description_en="Maintenance labor", quantity=Decimal("1"), unit_price=billing.labor_amount, vat_rate=Decimal("15"), prices_include_vat=True, line_order=0))
    for i, part in enumerate(parts): lines.append(InvoiceLineCreate(description_ar="قطعة غيار صيانة", description_en="Maintenance spare part", quantity=part.quantity, unit_price=part.unit_price, vat_rate=Decimal("15"), prices_include_vat=True, line_order=len(lines)))
    if not lines: raise HTTPException(400, "لا توجد أجور أو قطع لإصدار الفاتورة")
    from app.modules.sales.service import create_invoice, confirm_invoice
    now = datetime.utcnow(); invoice = await create_invoice(db, user["tenant_id"], user["user_id"], InvoiceCreate(customer_id=case.customer_id, invoice_type=InvoiceType.SIMPLIFIED, issue_date=now, supply_date=now, invoice_payment_method=InvoicePaymentMethod.CREDIT, notes=f"فاتورة صيانة — {case.case_number}", lines=lines))
    invoice = await confirm_invoice(db, user["tenant_id"], user["user_id"], invoice.id); billing.invoice_id = invoice.id; billing.updated_at = datetime.utcnow(); await db.commit()
    return {**(await _out(db, user["tenant_id"], case)), "invoice_number": invoice.invoice_number}
