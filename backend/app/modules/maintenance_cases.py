"""واجهة التشغيل الجديدة للصيانة، مستقلة عن نظام POS القديم."""
import json
import uuid
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, HTTPException, Depends
from app.core.database import get_db
from app.core.tenant import get_current_user, require_role
from app.models.maintenance_case import MaintenanceCase, MaintenanceCaseStatusLog, MaintenanceInspection, MaintenanceInspectionPart
from app.models.inventory import InventoryItem

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
    return {"id": inspection.id, "diagnosis": inspection.diagnosis, "failure_cause": inspection.failure_cause, "repair_required": inspection.repair_required, "warranty_status": inspection.warranty_status, "cost_responsibility": inspection.cost_responsibility, "labor_amount": float(inspection.labor_amount or 0), "expected_days": inspection.expected_days, "customer_approval": inspection.customer_approval, "customer_approved_at": inspection.customer_approved_at.isoformat() if inspection.customer_approved_at else None, "parts": [{"id": part.id, "product_id": part.product_id, "product_name": item.name_ar, "sku": item.sku, "quantity": float(part.quantity), "unit_price": float(part.unit_price), "status": part.status} for part, item in rows]}


async def _out(db, tenant_id, case):
    inspection = await _inspection_out(db, tenant_id, case.id)
    logs = (await db.execute(select(MaintenanceCaseStatusLog).where(MaintenanceCaseStatusLog.case_id == case.id).order_by(MaintenanceCaseStatusLog.created_at))).scalars().all()
    return {"id": case.id, "case_number": case.case_number, "status": case.status, "status_label": LABELS.get(case.status, case.status), "source": case.source, "terminal_id": case.terminal_id, "customer_id": case.customer_id, "rep_id": case.rep_id, "device_name": case.device_name, "device_model": case.device_model, "device_serial": case.device_serial, "customer_name": case.customer_name, "customer_phone": case.customer_phone, "purchase_date": case.purchase_date.isoformat() if case.purchase_date else None, "reported_problem": case.reported_problem, "device_condition": case.device_condition, "received_accessories": case.received_accessories, "attachment_urls": json.loads(case.attachment_urls_json or "[]"), "created_by": case.created_by, "received_by": case.received_by, "created_at": case.created_at.isoformat(), "updated_at": case.updated_at.isoformat(), "inspection": inspection, "status_history": [{"from_status": x.from_status, "to_status": x.to_status, "status_label": LABELS.get(x.to_status, x.to_status), "note": x.note, "changed_by": x.changed_by, "created_at": x.created_at.isoformat()} for x in logs]}

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
