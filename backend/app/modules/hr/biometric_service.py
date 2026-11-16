import hashlib
import json
import secrets
import uuid
from datetime import datetime, date, time, timedelta
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.hr import BiometricDevice, BiometricEmployeeLink, BiometricLog, Employee, AttendanceRecord, HRSettings


def _device_dict(device: BiometricDevice, include_key: str | None = None):
    row = {
        "id": device.id, "name": device.name, "device_type": device.device_type,
        "connection_mode": device.connection_mode, "host": device.host, "port": device.port,
        "serial_number": device.serial_number,
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
        serial_number=str(data.get("serial_number") or "").strip() or None,
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
    for field in ("name", "device_type", "connection_mode", "serial_number", "host", "branch_id", "last_sync_status"):
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


async def delete_device(db: AsyncSession, tenant_id: str, device_id: str):
    device = await db.scalar(select(BiometricDevice).where(
        BiometricDevice.id == device_id, BiometricDevice.tenant_id == tenant_id
    ))
    if not device:
        raise HTTPException(404, "جهاز البصمة غير موجود")
    # حذف الجهاز وروابطه فقط؛ لا نحذف سجلات الحضور اليومية الموجودة.
    await db.delete(device)
    await db.commit()
    return {"deleted": True, "id": device_id}


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


async def delete_link(db: AsyncSession, tenant_id: str, link_id: str):
    link = await db.scalar(select(BiometricEmployeeLink).where(
        BiometricEmployeeLink.id == link_id, BiometricEmployeeLink.tenant_id == tenant_id
    ))
    if not link:
        raise HTTPException(404, "ربط الموظف غير موجود")
    await db.delete(link)
    await db.commit()
    return {"deleted": True, "id": link_id}


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


async def ingest_logs_by_device_key(db: AsyncSession, device_id: str, payload: list[dict], device_key: str | None = None):
    device = await db.scalar(select(BiometricDevice).where(BiometricDevice.id == device_id, BiometricDevice.is_active.is_(True)))
    if not device:
        raise HTTPException(404, "جهاز البصمة غير موجود أو غير فعال")
    if not device_key or not device.api_key_hash or not secrets.compare_digest(hashlib.sha256(device_key.encode()).hexdigest(), device.api_key_hash):
        raise HTTPException(401, "مفتاح جهاز البصمة غير صحيح")
    return await ingest_logs(db, device.tenant_id, device_id, payload, device_key)


async def ingest_adms_logs(db: AsyncSession, device: BiometricDevice, payload: list[dict]):
    """Store rows received through the device's authenticated ADMS identity."""
    accepted = 0
    skipped = 0
    for item in payload:
        user_id = str(item.get("device_user_id") or "").strip()
        occurred = item.get("occurred_at")
        if not user_id or not occurred:
            continue
        try:
            occurred_at = datetime.fromisoformat(str(occurred).replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            continue
        external_id = str(item.get("external_id") or f"adms:{device.id}:{user_id}:{occurred_at.isoformat()}")
        exists = await db.scalar(select(BiometricLog.id).where(BiometricLog.external_id == external_id))
        if exists:
            skipped += 1
            continue
        db.add(BiometricLog(
            id=str(uuid.uuid4()), tenant_id=device.tenant_id, device_id=device.id,
            device_user_id=user_id, occurred_at=occurred_at,
            event_type=item.get("event_type") or "punch",
            external_id=external_id, raw_payload=json.dumps(item, ensure_ascii=False), processed=False,
        ))
        accepted += 1
    device.last_sync_at = datetime.utcnow()
    device.last_sync_status = f"adms:{accepted}"
    await db.commit()
    return {"accepted": accepted, "skipped": skipped}


async def list_logs(db: AsyncSession, tenant_id: str, device_id: str | None = None, unprocessed_only: bool = False):
    q = select(BiometricLog).where(BiometricLog.tenant_id == tenant_id).order_by(BiometricLog.occurred_at.desc()).limit(500)
    if device_id: q = q.where(BiometricLog.device_id == device_id)
    if unprocessed_only: q = q.where(BiometricLog.processed.is_(False))
    rows = (await db.execute(q)).scalars().all()
    return [{"id": x.id, "device_id": x.device_id, "device_user_id": x.device_user_id, "occurred_at": x.occurred_at, "event_type": x.event_type, "processed": x.processed} for x in rows]


async def process_logs(db: AsyncSession, tenant_id: str):
    """تحويل السجلات الخام إلى سجل يومي: أول بصمة دخول وآخر بصمة انصراف."""
    logs = (await db.execute(select(BiometricLog).where(BiometricLog.tenant_id == tenant_id, BiometricLog.processed.is_(False)).order_by(BiometricLog.occurred_at))).scalars().all()
    if not logs:
        return {"processed_logs": 0, "attendance_days": 0, "unmatched": 0}
    links = (await db.execute(select(BiometricEmployeeLink).where(BiometricEmployeeLink.tenant_id == tenant_id))).scalars().all()
    link_map = {(x.device_id, x.device_user_id): x.employee_id for x in links}
    grouped: dict[tuple[str, date], list[BiometricLog]] = {}
    unmatched = 0
    for log in logs:
        employee_id = link_map.get((log.device_id, log.device_user_id))
        if not employee_id:
            unmatched += 1
            continue
        grouped.setdefault((employee_id, log.occurred_at.date()), []).append(log)
    settings = await db.scalar(select(HRSettings).where(HRSettings.tenant_id == tenant_id))
    start_text = settings.work_start_time if settings else "09:00"
    grace = settings.grace_minutes if settings else 15
    try: expected_start = datetime.strptime(start_text, "%H:%M").time()
    except ValueError: expected_start = time(9, 0)
    for (employee_id, work_date), day_logs in grouped.items():
        day_logs.sort(key=lambda x: x.occurred_at)
        check_in = day_logs[0].occurred_at
        check_out = day_logs[-1].occurred_at if len(day_logs) > 1 and day_logs[-1].occurred_at != check_in else None
        expected = datetime.combine(work_date, expected_start)
        status = "late" if check_in > expected + timedelta(minutes=grace) else "present"
        record = await db.scalar(select(AttendanceRecord).where(AttendanceRecord.tenant_id == tenant_id, AttendanceRecord.employee_id == employee_id, AttendanceRecord.date == work_date))
        if record:
            record.check_in = min(record.check_in, check_in) if record.check_in else check_in
            record.check_out = max(record.check_out, check_out) if record.check_out and check_out else (record.check_out or check_out)
            if record.status in (None, "absent") or status == "late": record.status = status
            record.notes = "تمت المزامنة من جهاز البصمة"
        else:
            db.add(AttendanceRecord(id=str(uuid.uuid4()), tenant_id=tenant_id, employee_id=employee_id, date=work_date, check_in=check_in, check_out=check_out, status=status, notes="تمت المزامنة من جهاز البصمة"))
        for log in day_logs: log.processed = True
    await db.commit()
    return {"processed_logs": len(logs) - unmatched, "attendance_days": len(grouped), "unmatched": unmatched}
