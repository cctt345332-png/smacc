import hashlib
import json
import secrets
import uuid
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hr import BiometricDevice, BiometricEmployeeLink, BiometricLog, Employee, AttendanceRecord


def _device_dict(device: BiometricDevice, include_key: str | None = None):
    row = {
        "id": device.id, "name": device.name, "device_type": device.device_type,
        "connection_mode": device.connection_mode, "host": device.host, "port": device.port,
        "branch_id": device.branch_id, "is_active": device.is_active,
        "last_sync_at": device.last_sync_at, "last_sync_status": device.last_sync_status,
    }
    if include_key:
        row["device_key"] = include_key
    return row


async def list_devices(db: AsyncSession, tenant_id: str):
    devices = (await db.execute(select(BiometricDevice).where(BiometricDevice.tenant_id == tenant_id).order_by(BiometricDevice.name))).scalars().all()
    return [_device_dict(x) for x in devices]


async def create_device(db: AsyncSession, tenant_id: str, data: dict):
    key = str(data.get("device_key") or secrets.token_urlsafe(32))
    device = BiometricDevice(
        id=str(uuid.uuid4()), tenant_id=tenant_id, name=str(data.get("name") or "جهاز بصمة"),
        device_type=str(data.get("device_type") or "generic"), connection_mode=str(data.get("connection_mode") or "agent"),
        host=data.get("host"), port=int(data["port"]) if data.get("port") else None, branch_id=data.get("branch_id"),
        api_key_hash=hashlib.sha256(key.encode()).hexdigest(), is_active=bool(data.get("is_active", True)),
    )
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return _device_dict(device, key)


async def update_device(db: AsyncSession, tenant_id: str, device_id: str, data: dict):
    device = await db.scalar(select(BiometricDevice).where(BiometricDevice.id == device_id, BiometricDevice.tenant_id == tenant_id))
    if not device:
        raise HTTPException(404, "جهاز البصمة غير موجود")
    for field in ("name", "device_type", "connection_mode", "host", "branch_id", "last_sync_status"):
        if field in data: setattr(device, field, data[field])
    if "port" in data: device.port = int(data["port"]) if data["port"] else None
    if "is_active" in data: device.is_active = bool(data["is_active"])
    key = None
    if data.get("regenerate_key"):
        key = secrets.token_urlsafe(32)
        device.api_key_hash = hashlib.sha256(key.encode()).hexdigest()
    await db.commit()
    await db.refresh(device)
    return _device_dict(device, key)


async def list_links(db: AsyncSession, tenant_id: str, device_id: str | None = None):
    q = select(BiometricEmployeeLink, Employee).join(Employee, Employee.id == BiometricEmployeeLink.employee_id).where(BiometricEmployeeLink.tenant_id == tenant_id)
    if device_id: q = q.where(BiometricEmployeeLink.device_id == device_id)
    rows = (await db.execute(q.order_by(Employee.full_name_ar))).all()
    return [{"id": link.id, "device_id": link.device_id, "employee_id": link.employee_id, "device_user_id": link.device_user_id,
             "employee_name": employee.full_name_ar, "employee_number": employee.employee_number} for link, employee in rows]


async def save_link(db: AsyncSession, tenant_id: str, data: dict):
    device_id, employee_id, device_user_id = str(data.get("device_id") or ""), str(data.get("employee_id") or ""), str(data.get("device_user_id") or "").strip()
    if not all((device_id, employee_id, device_user_id)): raise HTTPException(400, "الجهاز والموظف ورقم المستخدم في الجهاز مطلوبة")
    device = await db.scalar(select(BiometricDevice).where(BiometricDevice.id == device_id, BiometricDevice.tenant_id == tenant_id))
    employee = await db.scalar(select(Employee).where(Employee.id == employee_id, Employee.tenant_id == tenant_id))
    if not device or not employee: raise HTTPException(404, "الجهاز أو الموظف غير موجود")
    existing = await db.scalar(select(BiometricEmployeeLink).where(BiometricEmployeeLink.device_id == device_id, BiometricEmployeeLink.device_user_id == device_user_id))
    if existing and existing.employee_id != employee_id: raise HTTPException(409, "رقم المستخدم مربوط بموظف آخر على هذا الجهاز")
    if existing: return {"id": existing.id, "message": "تم تحديث الربط"}
    link = BiometricEmployeeLink(id=str(uuid.uuid4()), tenant_id=tenant_id, device_id=device_id, employee_id=employee_id, device_user_id=device_user_id)
    db.add(link); await db.commit()
    return {"id": link.id, "message": "تم ربط الموظف بجهاز البصمة"}


async def ingest_logs(db: AsyncSession, tenant_id: str, device_id: str, payload: list[dict], device_key: str | None = None):
    device = await db.scalar(select(BiometricDevice).where(BiometricDevice.id == device_id, BiometricDevice.tenant_id == tenant_id, BiometricDevice.is_active.is_(True)))
    if not device: raise HTTPException(404, "جهاز البصمة غير موجود أو غير فعال")
    if not device_key or not device.api_key_hash or not secrets.compare_digest(hashlib.sha256(device_key.encode()).hexdigest(), device.api_key_hash):
        raise HTTPException(401, "مفتاح جهاز البصمة غير صحيح")
    accepted = 0; skipped = 0; processed = 0
    for item in payload:
        user_id = str(item.get("device_user_id") or item.get("user_id") or "").strip()
        occurred = item.get("occurred_at") or item.get("timestamp")
        if not user_id or not occurred: continue
        try: occurred_at = datetime.fromisoformat(str(occurred).replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError: continue
        external_id = str(item.get("external_id") or f"{device_id}:{user_id}:{occurred_at.isoformat()}:{item.get('event_type','')}")
        exists = await db.scalar(select(BiometricLog.id).where(BiometricLog.external_id == external_id))
        if exists: skipped += 1; continue
        db.add(BiometricLog(id=str(uuid.uuid4()), tenant_id=tenant_id, device_id=device_id, device_user_id=user_id, occurred_at=occurred_at, event_type=item.get("event_type"), external_id=external_id, raw_payload=json.dumps(item, ensure_ascii=False), processed=False))
        accepted += 1
    device.last_sync_at = datetime.utcnow(); device.last_sync_status = f"received:{accepted}"
    await db.commit()
    return {"accepted": accepted, "skipped": skipped, "processed": processed, "message": "تم استقبال سجلات البصمة بدون تكرار"}
