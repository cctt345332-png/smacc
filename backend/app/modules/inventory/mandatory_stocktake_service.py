import json
import uuid
from datetime import datetime, timedelta, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import (
    InventoryItem,
    InventoryStock,
    SerialItem,
    Warehouse,
    MandatoryStocktakeConfig,
    MandatoryStocktakeRun,
    MandatoryStocktakeLine,
)
from app.models.reps import SalesRep


def _value(value):
    return value.value if hasattr(value, "value") else value


def _tz(config: MandatoryStocktakeConfig) -> ZoneInfo:
    try:
        return ZoneInfo(config.timezone or "Asia/Riyadh")
    except Exception:
        return ZoneInfo("Asia/Riyadh")


def _scheduled_at(now: datetime, config: MandatoryStocktakeConfig) -> datetime:
    tz = _tz(config)
    local_now = now.astimezone(tz) if now.tzinfo else now.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
    days_back = (local_now.isoweekday() - int(config.weekday or 4)) % 7
    candidate_date = local_now.date() - timedelta(days=days_back)
    hour, minute = (config.start_time or "11:00").split(":", 1)
    candidate = datetime.combine(candidate_date, time(int(hour), int(minute)), tzinfo=tz)
    if candidate > local_now:
        candidate -= timedelta(days=7)
    return candidate.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)


async def get_config(db: AsyncSession, tenant_id: str) -> MandatoryStocktakeConfig | None:
    return await db.scalar(select(MandatoryStocktakeConfig).where(MandatoryStocktakeConfig.tenant_id == tenant_id))


async def save_config(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> dict:
    config = await get_config(db, tenant_id)
    if not config:
        config = MandatoryStocktakeConfig(id=str(uuid.uuid4()), tenant_id=tenant_id)
        db.add(config)
    if "is_enabled" in data:
        config.is_enabled = bool(data["is_enabled"])
    if "weekday" in data:
        weekday = int(data["weekday"])
        if weekday < 1 or weekday > 7:
            raise HTTPException(400, "اليوم يجب أن يكون بين 1 و7")
        config.weekday = weekday
    if "start_time" in data:
        raw_time = str(data["start_time"])
        try:
            hour, minute = [int(x) for x in raw_time.split(":", 1)]
            time(hour, minute)
        except Exception:
            raise HTTPException(400, "وقت الجرد غير صحيح، استخدم HH:MM")
        config.start_time = f"{hour:02d}:{minute:02d}"
    if "timezone" in data and data["timezone"]:
        try:
            ZoneInfo(str(data["timezone"]))
        except Exception:
            raise HTTPException(400, "المنطقة الزمنية غير صحيحة")
        config.timezone = str(data["timezone"])
    if "reminder_minutes" in data:
        config.reminder_minutes = max(0, int(data["reminder_minutes"]))
    config.updated_by = user_id
    config.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(config)
    return serialize_config(config)


def serialize_config(config: MandatoryStocktakeConfig) -> dict:
    return {
        "id": config.id,
        "is_enabled": config.is_enabled,
        "weekday": config.weekday,
        "start_time": config.start_time,
        "timezone": config.timezone,
        "reminder_minutes": config.reminder_minutes,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


async def _rep_for_user(db: AsyncSession, tenant_id: str, user_id: str) -> SalesRep:
    rep = await db.scalar(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.user_id == user_id, SalesRep.is_active.is_(True)))
    if not rep or not rep.warehouse_id:
        raise HTTPException(409, "لا يوجد مستودع نشط مرتبط بهذا المندوب")
    return rep


async def ensure_current_run(db: AsyncSession, tenant_id: str, now: datetime | None = None) -> MandatoryStocktakeRun | None:
    config = await get_config(db, tenant_id)
    if not config or not config.is_enabled:
        return None
    now = now or datetime.utcnow()
    scheduled_at = _scheduled_at(now.replace(tzinfo=ZoneInfo("UTC")), config)
    if scheduled_at > now:
        return None
    run = await db.scalar(select(MandatoryStocktakeRun).where(MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.scheduled_at == scheduled_at))
    if run:
        return run
    run = MandatoryStocktakeRun(id=str(uuid.uuid4()), tenant_id=tenant_id, scheduled_at=scheduled_at, status="pending")
    db.add(run)
    reps = (await db.execute(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.is_active.is_(True), SalesRep.warehouse_id.is_not(None)))).scalars().all()
    items = (await db.execute(select(InventoryItem).where(InventoryItem.tenant_id == tenant_id, InventoryItem.is_active.is_(True)))).scalars().all()
    for rep in reps:
        for item in items:
            tracking = _value(item.tracking_type)
            if tracking == "serial":
                serials = (await db.execute(select(SerialItem.serial_number).where(SerialItem.product_id == item.id, SerialItem.warehouse_id == rep.warehouse_id, SerialItem.status == "in_stock").order_by(SerialItem.serial_number))).scalars().all()
                system_qty = Decimal(len(serials))
                if system_qty == 0:
                    continue
                expected_json = json.dumps(list(serials), ensure_ascii=False)
            else:
                stock = await db.scalar(select(InventoryStock).where(InventoryStock.tenant_id == tenant_id, InventoryStock.item_id == item.id, InventoryStock.warehouse_id == rep.warehouse_id))
                system_qty = Decimal(stock.quantity or 0) if stock else Decimal("0")
                if system_qty == 0:
                    continue
                expected_json = None
            db.add(MandatoryStocktakeLine(id=str(uuid.uuid4()), run_id=run.id, tenant_id=tenant_id, rep_id=rep.id, item_id=item.id, warehouse_id=rep.warehouse_id, tracking_type=tracking, system_qty=system_qty, expected_serials_json=expected_json))
    await db.commit()
    await db.refresh(run)
    return run


async def _run_for_rep(db: AsyncSession, tenant_id: str, rep_id: str) -> MandatoryStocktakeRun | None:
    run = await ensure_current_run(db, tenant_id)
    if not run:
        return None
    line = await db.scalar(select(MandatoryStocktakeLine).where(MandatoryStocktakeLine.run_id == run.id, MandatoryStocktakeLine.rep_id == rep_id).limit(1))
    return run if line else None


def _line_json(line: MandatoryStocktakeLine, item_name: str, sku: str | None, warehouse_name: str) -> dict:
    expected = json.loads(line.expected_serials_json) if line.expected_serials_json else []
    counted = json.loads(line.counted_serials_json) if line.counted_serials_json else []
    return {"id": line.id, "item_id": line.item_id, "item_name": item_name, "sku": sku, "warehouse_id": line.warehouse_id, "warehouse_name": warehouse_name, "tracking_type": line.tracking_type, "system_qty": float(line.system_qty), "counted_qty": float(line.counted_qty) if line.counted_qty is not None else None, "diff_qty": float(line.diff_qty) if line.diff_qty is not None else None, "expected_serials": expected, "counted_serials": counted, "missing_serials": sorted(set(expected) - set(counted)), "extra_serials": sorted(set(counted) - set(expected)), "status": line.status, "notes": line.notes}


async def get_rep_current(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    rep = await _rep_for_user(db, tenant_id, user_id)
    run = await _run_for_rep(db, tenant_id, rep.id)
    if not run:
        return {"locked": False, "run": None, "lines": []}
    rows = (await db.execute(select(MandatoryStocktakeLine, InventoryItem, Warehouse).join(InventoryItem, InventoryItem.id == MandatoryStocktakeLine.item_id).join(Warehouse, Warehouse.id == MandatoryStocktakeLine.warehouse_id).where(MandatoryStocktakeLine.run_id == run.id, MandatoryStocktakeLine.rep_id == rep.id).order_by(InventoryItem.name_ar))).all()
    return {"locked": run.status != "submitted", "run": {"id": run.id, "scheduled_at": run.scheduled_at.isoformat(), "status": run.status}, "rep_id": rep.id, "warehouse_id": rep.warehouse_id, "lines": [_line_json(line, item.name_ar, item.sku, warehouse.name_ar) for line, item, warehouse in rows]}


async def submit_rep_count(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> dict:
    rep = await _rep_for_user(db, tenant_id, user_id)
    run = await _run_for_rep(db, tenant_id, rep.id)
    if not run:
        raise HTTPException(409, "لا توجد جلسة جرد حالية")
    if run.status == "submitted":
        raise HTTPException(409, "تم رفع هذا الجرد مسبقًا")
    incoming = {str(row.get("line_id")): row for row in data.get("lines", [])}
    lines = (await db.execute(select(MandatoryStocktakeLine).where(MandatoryStocktakeLine.run_id == run.id, MandatoryStocktakeLine.rep_id == rep.id))).scalars().all()
    if not lines:
        raise HTTPException(409, "لا توجد أصناف للجرد في مستودع المندوب")
    for line in lines:
        row = incoming.get(line.id)
        if not row:
            raise HTTPException(400, "يجب إكمال جميع أصناف الجرد قبل الإرسال")
        if line.tracking_type == "serial":
            serials = [str(x).strip() for x in (row.get("counted_serials") or []) if str(x).strip()]
            if len(serials) != len(set(serials)):
                raise HTTPException(400, "يوجد سيريال مكرر في الجرد")
            expected = set(json.loads(line.expected_serials_json or "[]"))
            actual = set(serials)
            line.counted_serials_json = json.dumps(serials, ensure_ascii=False)
            line.counted_qty = Decimal(len(serials))
            line.diff_qty = line.counted_qty - line.system_qty
            line.status = "matched" if expected == actual else "variance"
        else:
            try:
                counted = Decimal(str(row.get("counted_qty")))
            except Exception:
                raise HTTPException(400, "الكمية الفعلية غير صحيحة")
            if counted < 0:
                raise HTTPException(400, "الكمية لا يمكن أن تكون سالبة")
            line.counted_qty = counted
            line.diff_qty = counted - line.system_qty
            line.status = "matched" if line.diff_qty == 0 else "variance"
        line.notes = row.get("notes")
        line.counted_at = datetime.utcnow()
    run.status = "submitted"
    run.submitted_at = datetime.utcnow()
    run.submitted_by = user_id
    await db.commit()
    return await get_rep_current(db, tenant_id, user_id)


async def list_runs(db: AsyncSession, tenant_id: str, status: str | None = None, limit: int = 50) -> list[dict]:
    await ensure_current_run(db, tenant_id)
    q = select(MandatoryStocktakeRun).where(MandatoryStocktakeRun.tenant_id == tenant_id).order_by(MandatoryStocktakeRun.scheduled_at.desc()).limit(min(max(limit, 1), 200))
    if status:
        q = q.where(MandatoryStocktakeRun.status == status)
    runs = (await db.execute(q)).scalars().all()
    result = []
    for run in runs:
        lines = (await db.execute(select(MandatoryStocktakeLine).where(MandatoryStocktakeLine.run_id == run.id))).scalars().all()
        result.append({"id": run.id, "scheduled_at": run.scheduled_at.isoformat(), "status": run.status, "submitted_at": run.submitted_at.isoformat() if run.submitted_at else None, "total_lines": len(lines), "matched_lines": sum(1 for x in lines if x.status == "matched"), "variance_lines": sum(1 for x in lines if x.status == "variance"), "reps": len({x.rep_id for x in lines})})
    return result


async def get_run(db: AsyncSession, tenant_id: str, run_id: str) -> dict:
    run = await db.scalar(select(MandatoryStocktakeRun).where(MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.id == run_id))
    if not run:
        raise HTTPException(404, "جلسة الجرد غير موجودة")
    rows = (await db.execute(select(MandatoryStocktakeLine, InventoryItem, Warehouse).join(InventoryItem, InventoryItem.id == MandatoryStocktakeLine.item_id).join(Warehouse, Warehouse.id == MandatoryStocktakeLine.warehouse_id).where(MandatoryStocktakeLine.run_id == run.id).order_by(MandatoryStocktakeLine.rep_id, InventoryItem.name_ar))).all()
    return {"id": run.id, "scheduled_at": run.scheduled_at.isoformat(), "status": run.status, "submitted_at": run.submitted_at.isoformat() if run.submitted_at else None, "review_note": run.review_note, "lines": [_line_json(line, item.name_ar, item.sku, warehouse.name_ar) for line, item, warehouse in rows]}


async def review_run(db: AsyncSession, tenant_id: str, user_id: str, run_id: str, data: dict) -> dict:
    run = await db.scalar(select(MandatoryStocktakeRun).where(MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.id == run_id))
    if not run:
        raise HTTPException(404, "جلسة الجرد غير موجودة")
    action = data.get("action")
    if action not in ("approved", "reopened"):
        raise HTTPException(400, "الإجراء يجب أن يكون approved أو reopened")
    run.status = action
    run.reviewed_at = datetime.utcnow()
    run.reviewed_by = user_id
    run.review_note = data.get("note")
    await db.commit()
    return await get_run(db, tenant_id, run_id)


async def assert_rep_unlocked(db: AsyncSession, tenant_id: str, user_id: str) -> None:
    rep = await db.scalar(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.user_id == user_id, SalesRep.is_active.is_(True)))
    if not rep:
        return
    run = await _run_for_rep(db, tenant_id, rep.id)
    if run and run.status not in ("submitted", "approved"):
        raise HTTPException(423, "التطبيق مقفل حتى إكمال الجرد الأسبوعي ورفعه للإدارة")
