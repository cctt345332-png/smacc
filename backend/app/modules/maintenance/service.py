import base64
import hashlib
import json
import uuid
from datetime import datetime

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.inventory import InventoryItem, SerialItem
from app.models.maintenance import (
    LockType,
    MaintenanceRequest,
    MaintenanceResolution,
    MaintenanceStatus,
    MaintenanceStatusLog,
)
from app.models.reps import SalesRep
from app.models.sales import Customer
from app.modules.maintenance.schemas import (
    MaintenanceRequestCreate,
    MaintenanceRequestUpdate,
    MaintenanceReplacement,
    MaintenanceStatusChange,
)


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest())
    return Fernet(key)


def _encrypt_secret(value: str | None) -> str | None:
    if not value:
        return None
    return _fernet().encrypt(value.encode()).decode()


def _decrypt_secret(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        raise HTTPException(500, "تعذر فك تشفير كلمة مرور الجهاز")


def _status_value(value):
    return value.value if hasattr(value, "value") else value


async def _get_request(db: AsyncSession, tenant_id: str, request_id: str) -> MaintenanceRequest:
    request = await db.get(MaintenanceRequest, request_id)
    if not request or request.tenant_id != tenant_id:
        raise HTTPException(404, "طلب الصيانة غير موجود")
    return request


async def _resolve_rep(db: AsyncSession, user: dict) -> SalesRep | None:
    if user.get("role") != "sales_rep":
        return None
    result = await db.execute(select(SalesRep).where(SalesRep.user_id == user["user_id"], SalesRep.tenant_id == user["tenant_id"]))
    rep = result.scalar_one_or_none()
    if not rep:
        raise HTTPException(403, "حساب المندوب غير مرتبط بملف مندوب")
    return rep


async def _check_customer_access(db: AsyncSession, tenant_id: str, customer_id: str, user: dict) -> Customer:
    customer = await db.get(Customer, customer_id)
    if not customer or customer.tenant_id != tenant_id:
        raise HTTPException(404, "العميل غير موجود")
    rep = await _resolve_rep(db, user)
    if rep and customer.rep_id != rep.id:
        raise HTTPException(403, "لا يمكنك إنشاء طلب صيانة لهذا العميل")
    return customer


def serialize_request(request: MaintenanceRequest) -> dict:
    data = {c.name: getattr(request, c.name) for c in MaintenanceRequest.__table__.columns}
    data.pop("lock_secret_encrypted", None)
    data["lock_secret_provided"] = bool(request.lock_secret_provided)
    return data


async def list_requests(db: AsyncSession, tenant_id: str, user: dict, status: str | None = None, rep_id: str | None = None):
    q = select(MaintenanceRequest).where(MaintenanceRequest.tenant_id == tenant_id)
    rep = await _resolve_rep(db, user)
    if rep:
        q = q.where(MaintenanceRequest.rep_id == rep.id)
    elif rep_id:
        q = q.where(MaintenanceRequest.rep_id == rep_id)
    if status:
        q = q.where(MaintenanceRequest.status == status)
    result = await db.execute(q.order_by(MaintenanceRequest.created_at.desc()))
    return [serialize_request(row) for row in result.scalars().all()]


async def get_request(db: AsyncSession, tenant_id: str, request_id: str, user: dict):
    request = await _get_request(db, tenant_id, request_id)
    rep = await _resolve_rep(db, user)
    if rep and request.rep_id != rep.id:
        raise HTTPException(403, "لا يمكنك عرض طلب صيانة لمندوب آخر")
    return serialize_request(request)


async def create_request(db: AsyncSession, tenant_id: str, user: dict, data: MaintenanceRequestCreate):
    customer = await _check_customer_access(db, tenant_id, data.customer_id, user)
    rep = await _resolve_rep(db, user)

    product = None
    if data.product_id:
        product = await db.get(InventoryItem, data.product_id)
        if not product or product.tenant_id != tenant_id:
            raise HTTPException(404, "المنتج غير موجود")

    serial = None
    if data.serial_item_id:
        serial = await db.get(SerialItem, data.serial_item_id)
        if not serial or (product and serial.product_id != product.id):
            raise HTTPException(400, "السيريال لا يطابق المنتج المحدد")
        if data.serial_number and data.serial_number != serial.serial_number:
            raise HTTPException(400, "رقم السيريال لا يطابق السجل")

    now = datetime.utcnow()
    request = MaintenanceRequest(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        request_number=f"MNT-{now:%Y%m%d}-{uuid.uuid4().hex[:6].upper()}",
        customer_id=customer.id,
        rep_id=rep.id if rep else None,
        invoice_id=data.invoice_id,
        product_id=product.id if product else data.product_id,
        serial_item_id=serial.id if serial else data.serial_item_id,
        device_name=data.device_name or (product.name_ar if product else None),
        serial_number=serial.serial_number if serial else data.serial_number,
        imei_1=data.imei_1,
        imei_2=data.imei_2,
        reported_problem=data.reported_problem,
        device_condition=data.device_condition,
        accessories_received=data.accessories_received,
        attachment_urls_json=data.attachment_urls_json,
        lock_type=data.lock_type,
        lock_secret_encrypted=_encrypt_secret(data.lock_secret),
        lock_secret_provided=bool(data.lock_secret),
        warranty_case=data.warranty_case,
        estimated_cost=data.estimated_cost,
        created_by=user["user_id"],
    )
    db.add(request)
    db.add(MaintenanceStatusLog(
        id=str(uuid.uuid4()), tenant_id=tenant_id, request_id=request.id,
        from_status=None, to_status=MaintenanceStatus.NEW.value,
        changed_by=user["user_id"], note="إنشاء طلب الصيانة",
    ))
    await db.commit()
    await db.refresh(request)
    return serialize_request(request)


async def update_request(db: AsyncSession, tenant_id: str, user: dict, request_id: str, data: MaintenanceRequestUpdate):
    request = await _get_request(db, tenant_id, request_id)
    rep = await _resolve_rep(db, user)
    if rep and request.rep_id != rep.id:
        raise HTTPException(403, "لا يمكنك تعديل طلب صيانة لمندوب آخر")
    values = data.model_dump(exclude_unset=True)
    new_status = values.pop("status", None)
    lock_secret = values.pop("lock_secret", None)
    if lock_secret is not None:
        request.lock_secret_encrypted = _encrypt_secret(lock_secret)
        request.lock_secret_provided = bool(lock_secret)
    for key, value in values.items():
        setattr(request, key, value)
    if new_status and _status_value(request.status) != _status_value(new_status):
        old = _status_value(request.status)
        request.status = new_status
        now = datetime.utcnow()
        if _status_value(new_status) == MaintenanceStatus.RECEIVED.value:
            request.received_at = now
        if _status_value(new_status) in {MaintenanceStatus.READY.value, MaintenanceStatus.CLOSED.value}:
            request.completed_at = now
        if _status_value(new_status) == MaintenanceStatus.DELIVERED.value:
            request.delivered_at = now
        db.add(MaintenanceStatusLog(
            id=str(uuid.uuid4()), tenant_id=tenant_id, request_id=request.id,
            from_status=old, to_status=_status_value(new_status), changed_by=user["user_id"],
        ))
    request.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(request)
    return serialize_request(request)


async def set_replacement(db: AsyncSession, tenant_id: str, user: dict, request_id: str, data: MaintenanceReplacement):
    request = await _get_request(db, tenant_id, request_id)
    if user.get("role") == "sales_rep":
        raise HTTPException(403, "اعتماد استبدال الجهاز من صلاحية الإدارة أو الصيانة")
    product = await db.get(InventoryItem, data.replacement_product_id)
    if not product or product.tenant_id != tenant_id:
        raise HTTPException(404, "المنتج البديل غير موجود")
    if data.replacement_serial_item_id:
        serial = await db.get(SerialItem, data.replacement_serial_item_id)
        if not serial or serial.product_id != product.id:
            raise HTTPException(400, "السيريال البديل لا يطابق المنتج البديل")
        request.replacement_serial_number = serial.serial_number
    request.replacement_product_id = product.id
    request.replacement_serial_item_id = data.replacement_serial_item_id
    request.replacement_serial_number = data.replacement_serial_number or request.replacement_serial_number
    request.replacement_reason = data.replacement_reason
    request.replacement_approved = data.replacement_approved
    request.resolution = MaintenanceResolution.REPLACED
    request.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(request)
    return serialize_request(request)


async def reveal_secret(db: AsyncSession, tenant_id: str, user: dict, request_id: str):
    if user.get("role") not in {"admin", "manager", "accountant"}:
        raise HTTPException(403, "لا تملك صلاحية عرض كلمة مرور الجهاز")
    request = await _get_request(db, tenant_id, request_id)
    return {"request_id": request.id, "lock_type": request.lock_type, "lock_secret": _decrypt_secret(request.lock_secret_encrypted)}
