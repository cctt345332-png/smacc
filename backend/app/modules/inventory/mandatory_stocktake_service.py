import json
import uuid
from datetime import datetime, timedelta, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import (
    InventoryItem,
    InventoryStock,
    SerialItem,
    StockMovement,
    Warehouse,
    MandatoryStocktakeConfig,
    MandatoryStocktakeRun,
    MandatoryStocktakeLine,
    MandatoryStocktakeOdometer,
)
from app.models.reps import SalesRep
from app.models.user import User


def _value(value):
    return value.value if hasattr(value, "value") else value


def _tz(config: MandatoryStocktakeConfig) -> ZoneInfo:
    try:
        return ZoneInfo(config.timezone or "Asia/Riyadh")
    except Exception:
        return ZoneInfo("Asia/Riyadh")


def _utc_iso(value: datetime | None) -> str | None:
    """التواريخ المخزنة للجلسات UTC؛ أضف Z حتى يفسرها المتصفح بشكل صحيح."""
    if value is None:
        return None
    return value.replace(tzinfo=ZoneInfo("UTC")).isoformat().replace("+00:00", "Z")


def _scheduled_at(now: datetime, config: MandatoryStocktakeConfig) -> datetime:
    tz = _tz(config)
    local_now = now.astimezone(tz) if now.tzinfo else now.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)
    days_back = (local_now.isoweekday() - int(config.weekday or 4)) % 7
    candidate_date = local_now.date() - timedelta(days=days_back)
    hour, minute = (config.start_time or "11:00").split(":", 1)
    candidate = datetime.combine(candidate_date, time(int(hour), int(minute)), tzinfo=tz)
    # نقبل الموعد السابق فقط خلال نافذة تشغيل قصيرة، حتى لو تأخرت دورة
    # العامل دقائق. أما إذا تغيّر الإعداد بعد الموعد بساعات/أيام، ننتقل
    # للأسبوع القادم ولا ننشئ جردًا قديمًا يظهر للمندوب على أنه الحالي.
    if local_now - candidate > timedelta(hours=2):
        candidate += timedelta(days=7)
    return candidate.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)


async def get_config(db: AsyncSession, tenant_id: str) -> MandatoryStocktakeConfig | None:
    return await db.scalar(select(MandatoryStocktakeConfig).where(MandatoryStocktakeConfig.tenant_id == tenant_id))


async def _snapshot_run_lines(db: AsyncSession, tenant_id: str, run: MandatoryStocktakeRun) -> None:
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
    # لا نُبقي جلسات قديمة غير مرفوعة بعد تغيير اليوم أو الساعة.
    # الجلسات المرفوعة/المعتمدة تبقى كسجل تاريخي، والاختبار الفوري لا يتأثر.
    await db.execute(
        delete(MandatoryStocktakeRun).where(
            MandatoryStocktakeRun.tenant_id == tenant_id,
            MandatoryStocktakeRun.is_test.is_(False),
            MandatoryStocktakeRun.status.in_(["pending", "reopened"]),
        )
    )
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
        # إذا تأخر العامل أو لم يفتح أحد النظام خلال نافذة الساعتين، لا
        # نخفي جلسة ما زالت بانتظار المندوب. الويب يعرضها كسجل، وكان التطبيق
        # سابقًا ينتقل مباشرة إلى موعد الأسبوع التالي فلا يراها المندوب.
        return await db.scalar(
            select(MandatoryStocktakeRun)
            .where(
                MandatoryStocktakeRun.tenant_id == tenant_id,
                MandatoryStocktakeRun.scheduled_at <= now,
                MandatoryStocktakeRun.status.in_(["pending", "submitted", "reopened"]),
                MandatoryStocktakeRun.is_test.is_(False),
            )
            .order_by(MandatoryStocktakeRun.scheduled_at.desc())
        )
    run = await db.scalar(select(MandatoryStocktakeRun).where(MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.scheduled_at == scheduled_at))
    if run:
        return run
    run = MandatoryStocktakeRun(
        id=str(uuid.uuid4()), tenant_id=tenant_id, scheduled_at=scheduled_at,
        status="pending",
    )
    db.add(run)
    await _snapshot_run_lines(db, tenant_id, run)
    await db.commit()
    await db.refresh(run)
    return run


async def process_scheduled_notifications(db: AsyncSession, tenant_id: str, now: datetime | None = None) -> None:
    """يرسل إشعار بدء الجرد تلقائيًا بعد إنشاء الجلسة."""
    now = now or datetime.utcnow()
    config = await get_config(db, tenant_id)
    if not config or not config.is_enabled:
        return
    run = await ensure_current_run(db, tenant_id, now)
    if not run:
        return
    rep_user_ids = (await db.execute(
        select(SalesRep.user_id).join(MandatoryStocktakeLine, MandatoryStocktakeLine.rep_id == SalesRep.id).where(
            MandatoryStocktakeLine.run_id == run.id, SalesRep.user_id.is_not(None), SalesRep.is_active.is_(True)
        )
    )).scalars().all()
    from app.modules.notifications.service import notify_users_event
    if run.status == "pending" and not run.started_notified_at:
        run.started_notified_at = now
        await db.commit()
        await notify_users_event(
            db, tenant_id, "", list(rep_user_ids),
            "بدأ الجرد الإلزامي", "Mandatory stocktake started",
            "تم فتح شاشة الجرد الإلزامي. أكمل الجرد وارفعه للإدارة.",
            "Mandatory stocktake is open. Complete and submit it to management.",
            reference_id=run.id, reference_type="mandatory_stocktake",
        )


async def create_test_run(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    """جلسة فورية للتجربة؛ اعتمادها لا يغيّر المخزون الحقيقي."""
    run = MandatoryStocktakeRun(
        id=str(uuid.uuid4()), tenant_id=tenant_id, scheduled_at=datetime.utcnow(),
        status="pending", is_test=True, review_note="جلسة اختبار فورية",
    )
    db.add(run)
    await _snapshot_run_lines(db, tenant_id, run)
    await db.commit()
    await db.refresh(run)
    await process_scheduled_notifications(db, tenant_id)
    return await get_run(db, tenant_id, run.id)


async def cancel_test_run(db: AsyncSession, tenant_id: str, run_id: str) -> dict:
    run = await db.scalar(select(MandatoryStocktakeRun).where(MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.id == run_id))
    if not run or not run.is_test:
        raise HTTPException(404, "جلسة الاختبار غير موجودة")
    # جلسة الاختبار لا تغيّر المخزون؛ يمكن إيقافها وحذفها في أي حالة
    # ما دامت جلسة اختبار، حتى بعد رفعها من التطبيق.
    lines = (await db.execute(select(MandatoryStocktakeLine).where(MandatoryStocktakeLine.run_id == run.id))).scalars().all()
    for line in lines:
        await db.delete(line)
    await db.delete(run)
    await db.commit()
    return {"ok": True, "id": run_id}


async def _run_for_rep(db: AsyncSession, tenant_id: str, rep_id: str) -> MandatoryStocktakeRun | None:
    test_run = await db.scalar(select(MandatoryStocktakeRun).join(MandatoryStocktakeLine, MandatoryStocktakeLine.run_id == MandatoryStocktakeRun.id).where(MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.is_test.is_(True), MandatoryStocktakeRun.status.in_(["pending", "submitted", "reopened"]), MandatoryStocktakeLine.rep_id == rep_id).order_by(MandatoryStocktakeRun.created_at.desc()))
    if test_run:
        return test_run
    run = await ensure_current_run(db, tenant_id)
    if not run:
        return None
    line = await db.scalar(select(MandatoryStocktakeLine).where(MandatoryStocktakeLine.run_id == run.id, MandatoryStocktakeLine.rep_id == rep_id).limit(1))
    return run if line else None


def _reopened_rep_ids(run: MandatoryStocktakeRun) -> set[str]:
    try:
        return {str(value) for value in (json.loads(run.reopened_rep_ids_json or "[]") or [])}
    except (TypeError, ValueError):
        return set()


def _set_reopened_rep_ids(run: MandatoryStocktakeRun, rep_ids: set[str]) -> None:
    run.reopened_rep_ids_json = json.dumps(sorted(rep_ids), ensure_ascii=False)


def _norm_serial(value: str) -> str:
    return "".join(str(value).split()).replace("-", "").lower()


def _line_json(line: MandatoryStocktakeLine, item_name: str, sku: str | None, warehouse_name: str, rep_name: str | None = None) -> dict:
    expected = json.loads(line.expected_serials_json) if line.expected_serials_json else []
    counted = json.loads(line.counted_serials_json) if line.counted_serials_json else []
    expected_keys = {_norm_serial(x) for x in expected}
    counted_keys = {_norm_serial(x) for x in counted}
    matched_serials = sorted(x for x in counted if _norm_serial(x) in expected_keys)
    unmatched_serials = sorted(x for x in counted if _norm_serial(x) not in expected_keys)
    missing_serials = sorted(x for x in expected if _norm_serial(x) not in counted_keys)
    return {"id": line.id, "rep_id": line.rep_id, "rep_name": rep_name or "—", "item_id": line.item_id, "item_name": item_name, "sku": sku, "warehouse_id": line.warehouse_id, "warehouse_name": warehouse_name, "tracking_type": line.tracking_type, "system_qty": float(line.system_qty), "counted_qty": float(line.counted_qty) if line.counted_qty is not None else None, "diff_qty": float(line.diff_qty) if line.diff_qty is not None else None, "expected_serials": expected, "counted_serials": counted, "matched_serials": matched_serials, "unmatched_serials": unmatched_serials, "missing_serials": missing_serials, "extra_serials": unmatched_serials, "status": line.status, "notes": line.notes, "odometer": line.odometer, "odometer_recorded_at": _utc_iso(line.odometer_recorded_at)}


async def get_rep_current(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    rep = await _rep_for_user(db, tenant_id, user_id)
    run = await _run_for_rep(db, tenant_id, rep.id)
    if not run:
        return {"locked": False, "run": None, "lines": []}
    rows = (await db.execute(select(MandatoryStocktakeLine, InventoryItem, Warehouse).join(InventoryItem, InventoryItem.id == MandatoryStocktakeLine.item_id).join(Warehouse, Warehouse.id == MandatoryStocktakeLine.warehouse_id).where(MandatoryStocktakeLine.run_id == run.id, MandatoryStocktakeLine.rep_id == rep.id).order_by(InventoryItem.name_ar))).all()
    odometer_record = await db.scalar(select(MandatoryStocktakeOdometer).where(MandatoryStocktakeOdometer.run_id == run.id, MandatoryStocktakeOdometer.rep_id == rep.id))
    rep_submitted = bool(rows) and all(line.counted_at is not None for line, _, _ in rows)
    rep_reopened = rep.id in _reopened_rep_ids(run)
    visible_status = "reopened" if rep_reopened else ("submitted" if rep_submitted else run.status)
    locked = visible_status in ("pending", "reopened")
    return {"locked": locked, "run": {"id": run.id, "scheduled_at": run.scheduled_at.isoformat(), "status": visible_status, "odometer": odometer_record.odometer if odometer_record else None, "odometer_photo_uploaded": bool(odometer_record and odometer_record.photo_data)}, "rep_id": rep.id, "warehouse_id": rep.warehouse_id, "lines": [_line_json(line, item.name_ar, item.sku, warehouse.name_ar) for line, item, warehouse in rows]}


async def submit_rep_count(db: AsyncSession, tenant_id: str, user_id: str, data: dict) -> dict:
    rep = await _rep_for_user(db, tenant_id, user_id)
    run = await _run_for_rep(db, tenant_id, rep.id)
    if not run:
        raise HTTPException(409, "لا توجد جلسة جرد حالية")
    try:
        odometer = int(data.get("odometer"))
    except (TypeError, ValueError):
        raise HTTPException(400, "يجب تسجيل قراءة عداد المركبة قبل رفع الجرد")
    if odometer < 0:
        raise HTTPException(400, "قراءة العداد لا يمكن أن تكون سالبة")
    photo_data = str(data.get("odometer_photo_data") or "").strip()
    if not photo_data.startswith("data:image/"):
        raise HTTPException(400, "يجب تصوير عداد المركبة قبل رفع الجرد")
    if len(photo_data) > 8 * 1024 * 1024:
        raise HTTPException(400, "صورة العداد كبيرة جدًا، أعد تصويرها بجودة أقل")
    from app.models.vehicle_maintenance import RepVehicle
    vehicle = await db.scalar(select(RepVehicle).where(RepVehicle.tenant_id == tenant_id, RepVehicle.rep_id == rep.id))
    if vehicle and odometer < (vehicle.current_odometer or 0):
        raise HTTPException(400, f"قراءة العداد يجب ألا تقل عن القراءة السابقة ({vehicle.current_odometer} كم)")
    incoming = {str(row.get("line_id")): row for row in data.get("lines", [])}
    lines = (await db.execute(select(MandatoryStocktakeLine).where(MandatoryStocktakeLine.run_id == run.id, MandatoryStocktakeLine.rep_id == rep.id))).scalars().all()
    if not lines:
        raise HTTPException(409, "لا توجد أصناف للجرد في مستودع المندوب")
    rep_submitted = all(line.counted_at is not None for line in lines)
    if rep_submitted and rep.id not in _reopened_rep_ids(run):
        raise HTTPException(409, "تم رفع جرد هذا المندوب مسبقًا")
    for line in lines:
        row = incoming.get(line.id)
        if not row:
            raise HTTPException(400, "يجب إكمال جميع أصناف الجرد قبل الإرسال")
        if line.tracking_type == "serial":
            serials = [str(x).strip() for x in (row.get("counted_serials") or []) if str(x).strip()]
            if len({_norm_serial(x) for x in serials}) != len(serials):
                raise HTTPException(400, "يوجد سيريال مكرر في الجرد")
            expected = set(json.loads(line.expected_serials_json or "[]"))
            expected_keys = {_norm_serial(x) for x in expected}
            actual_keys = {_norm_serial(x) for x in serials}
            line.counted_serials_json = json.dumps(serials, ensure_ascii=False)
            line.counted_qty = Decimal(len(serials))
            line.diff_qty = line.counted_qty - line.system_qty
            line.status = "matched" if expected_keys == actual_keys else "variance"
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
        line.odometer = odometer
        line.odometer_recorded_at = datetime.utcnow()
    if vehicle:
        vehicle.current_odometer = odometer
        vehicle.odometer_updated_at = datetime.utcnow()
        vehicle.updated_at = datetime.utcnow()
    odometer_record = await db.scalar(select(MandatoryStocktakeOdometer).where(MandatoryStocktakeOdometer.run_id == run.id, MandatoryStocktakeOdometer.rep_id == rep.id))
    if odometer_record:
        odometer_record.odometer = odometer
        odometer_record.photo_data = photo_data
        odometer_record.photo_name = str(data.get("odometer_photo_name") or "odometer.jpg")
        odometer_record.recorded_at = datetime.utcnow()
    else:
        db.add(MandatoryStocktakeOdometer(id=str(uuid.uuid4()), tenant_id=tenant_id, run_id=run.id, rep_id=rep.id, odometer=odometer, photo_data=photo_data, photo_name=str(data.get("odometer_photo_name") or "odometer.jpg"), recorded_at=datetime.utcnow()))
    run.status = "submitted"
    run.submitted_at = datetime.utcnow()
    run.submitted_by = user_id
    reopened_rep_ids = _reopened_rep_ids(run)
    if rep.id in reopened_rep_ids:
        reopened_rep_ids.remove(rep.id)
        _set_reopened_rep_ids(run, reopened_rep_ids)
    await db.commit()
    from app.modules.notifications.service import notify_management_event
    await notify_management_event(
        db, tenant_id, user_id,
        "تم رفع جرد مخزون جديد",
        "New stocktake submitted",
        "رفع المندوب جرد مستودعه، وهو بانتظار مراجعة الإدارة.",
        "A representative submitted a warehouse stocktake awaiting management review.",
        reference_id=run.id, reference_type="mandatory_stocktake",
    )
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
        result.append({"id": run.id, "scheduled_at": _utc_iso(run.scheduled_at), "status": run.status, "is_test": bool(run.is_test), "submitted_at": _utc_iso(run.submitted_at), "total_lines": len(lines), "matched_lines": sum(1 for x in lines if x.status == "matched"), "variance_lines": sum(1 for x in lines if x.status == "variance"), "reps": len({x.rep_id for x in lines})})
    return result


async def get_run(db: AsyncSession, tenant_id: str, run_id: str) -> dict:
    run = await db.scalar(select(MandatoryStocktakeRun).where(MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.id == run_id))
    if not run:
        raise HTTPException(404, "جلسة الجرد غير موجودة")
    rows = (await db.execute(select(MandatoryStocktakeLine, InventoryItem, Warehouse, User).join(InventoryItem, InventoryItem.id == MandatoryStocktakeLine.item_id).join(Warehouse, Warehouse.id == MandatoryStocktakeLine.warehouse_id).join(SalesRep, SalesRep.id == MandatoryStocktakeLine.rep_id).join(User, User.id == SalesRep.user_id).where(MandatoryStocktakeLine.run_id == run.id).order_by(MandatoryStocktakeLine.rep_id, InventoryItem.name_ar))).all()
    odometers = (await db.execute(select(MandatoryStocktakeOdometer).where(MandatoryStocktakeOdometer.run_id == run.id))).scalars().all()
    return {"id": run.id, "scheduled_at": _utc_iso(run.scheduled_at), "status": run.status, "is_test": bool(run.is_test), "submitted_at": _utc_iso(run.submitted_at), "review_note": run.review_note, "adjustments_applied_at": _utc_iso(run.adjustments_applied_at), "odometers": [{"rep_id": x.rep_id, "odometer": x.odometer, "photo_data": x.photo_data, "photo_name": x.photo_name, "recorded_at": _utc_iso(x.recorded_at)} for x in odometers], "lines": [_line_json(line, item.name_ar, item.sku, warehouse.name_ar, user.full_name) for line, item, warehouse, user in rows]}


async def replace_stocktake_serial(
    db: AsyncSession, tenant_id: str, user_id: str, run_id: str, data: dict
) -> dict:
    """استبدال هوية سيريال موجود في مخزون المندوب برقم مصور، دون حركة مخزون."""
    if not data.get("line_id") or not data.get("from_serial") or not data.get("to_serial"):
        raise HTTPException(400, "يجب تحديد السطر والسيريال الموجود والسيريال المصور")
    run = await db.scalar(select(MandatoryStocktakeRun).where(
        MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.id == run_id
    ))
    if not run:
        raise HTTPException(404, "جلسة الجرد غير موجودة")
    if run.status == "approved" or run.adjustments_applied_at:
        raise HTTPException(409, "لا يمكن استبدال سيريال بعد اعتماد تسوية الجرد")
    line = await db.scalar(select(MandatoryStocktakeLine).where(
        MandatoryStocktakeLine.id == str(data["line_id"]),
        MandatoryStocktakeLine.run_id == run.id,
        MandatoryStocktakeLine.tracking_type == "serial",
    ))
    if not line:
        raise HTTPException(404, "سطر السيريالات غير موجود")
    from_serial = str(data["from_serial"]).strip()
    to_serial = str(data["to_serial"]).strip()
    expected = list(json.loads(line.expected_serials_json or "[]"))
    counted = list(json.loads(line.counted_serials_json or "[]"))
    expected_keys = {_norm_serial(x) for x in expected}
    counted_keys = {_norm_serial(x) for x in counted}
    if _norm_serial(from_serial) not in expected_keys or _norm_serial(from_serial) in counted_keys:
        raise HTTPException(409, "السيريال الموجود يجب أن يكون من سيريالات المخزون غير المصورة")
    if _norm_serial(to_serial) not in counted_keys or _norm_serial(to_serial) in expected_keys:
        raise HTTPException(409, "السيريال المصور يجب أن يكون غير مطابقًا وغير موجود مسبقًا في المخزون")
    serial_candidates = (await db.execute(select(SerialItem).join(
        InventoryItem, InventoryItem.id == SerialItem.product_id
    ).where(
        InventoryItem.tenant_id == tenant_id,
        SerialItem.product_id == line.item_id,
        SerialItem.warehouse_id == line.warehouse_id,
        SerialItem.status == "in_stock",
    ))).scalars().all()
    serial = next((candidate for candidate in serial_candidates if _norm_serial(candidate.serial_number) == _norm_serial(from_serial)), None)
    if not serial:
        raise HTTPException(409, f"السيريال {from_serial} غير موجود كعنصر متاح في مخزون المندوب لهذا الصنف والمستودع")
    duplicate_candidates = (await db.execute(select(SerialItem, Warehouse).join(
        InventoryItem, InventoryItem.id == SerialItem.product_id
    ).outerjoin(Warehouse, Warehouse.id == SerialItem.warehouse_id).where(
        InventoryItem.tenant_id == tenant_id,
        SerialItem.product_id == line.item_id,
    ))).all()
    duplicate = next(((candidate, warehouse) for candidate, warehouse in duplicate_candidates if _norm_serial(candidate.serial_number) == _norm_serial(to_serial)), None)
    if duplicate:
        duplicate_item, duplicate_warehouse = duplicate
        status = _value(duplicate_item.status)
        location = duplicate_warehouse.name_ar if duplicate_warehouse else "خارج المستودعات"
        if duplicate_item.warehouse_id == line.warehouse_id and status == "in_stock":
            raise HTTPException(409, f"السيريال المصور موجود فعلًا في نفس مخزون المندوب ({location}) لكنه لم يكن ضمن لقطة جلسة الجرد. لا تستبدله؛ أعد فتح الجرد أو حدّث الجلسة لتضمينه.")
        raise HTTPException(409, f"السيريال المصور موجود مسبقًا لهذا الصنف: الحالة {status}، الموقع {location}. لا يمكن استبداله حتى لا يتكرر الرقم.")
    serial.serial_number = to_serial
    line.expected_serials_json = json.dumps([
        to_serial if _norm_serial(value) == _norm_serial(from_serial) else value
        for value in expected
    ], ensure_ascii=False)
    line.notes = (line.notes or "") + f"\nاستبدال سيريال يدويًا: {from_serial} ← {to_serial} بواسطة {user_id}"
    await db.commit()
    return await get_run(db, tenant_id, run_id)


async def review_run(db: AsyncSession, tenant_id: str, user_id: str, run_id: str, data: dict) -> dict:
    run = await db.scalar(select(MandatoryStocktakeRun).where(MandatoryStocktakeRun.tenant_id == tenant_id, MandatoryStocktakeRun.id == run_id))
    if not run:
        raise HTTPException(404, "جلسة الجرد غير موجودة")
    action = data.get("action")
    if action == "reopen_rep":
        rep_id = str(data.get("rep_id") or "")
        if not rep_id:
            raise HTTPException(400, "يجب تحديد المندوب المراد إعادة فتح جرده")
        if run.status == "approved":
            raise HTTPException(409, "لا يمكن إعادة فتح مندوب بعد اعتماد تسوية الجرد")
        has_rep = await db.scalar(select(MandatoryStocktakeLine.id).where(MandatoryStocktakeLine.run_id == run.id, MandatoryStocktakeLine.rep_id == rep_id).limit(1))
        if not has_rep:
            raise HTTPException(404, "المندوب غير موجود في جلسة الجرد")
        rep_ids = _reopened_rep_ids(run)
        rep_ids.add(rep_id)
        _set_reopened_rep_ids(run, rep_ids)
        run.reviewed_at = datetime.utcnow()
        run.reviewed_by = user_id
        run.review_note = data.get("note")
        await db.commit()
        await _notify_review_result(db, tenant_id, user_id, run, approved=False, rep_id=rep_id)
        return await get_run(db, tenant_id, run_id)
    if action not in ("approved", "reopened"):
        raise HTTPException(400, "الإجراء يجب أن يكون approved أو reopened أو reopen_rep")
    if action == "approved" and run.status != "submitted":
        raise HTTPException(409, "لا يمكن اعتماد الجرد قبل رفعه من المندوب")
    if action == "approved" and run.adjustments_applied_at:
        raise HTTPException(409, "تم تطبيق تسوية هذا الجرد مسبقًا")
    if action == "reopened" and run.status == "approved":
        raise HTTPException(409, "لا يمكن إعادة فتح جرد تم اعتماد تسويته")
    if action == "approved" and not run.is_test:
        await _apply_run_adjustments(db, tenant_id, user_id, run)
    elif action == "approved" and run.is_test:
        run.adjustments_applied_at = datetime.utcnow()
        run.adjustments_applied_by = user_id
    run.status = action
    run.reviewed_at = datetime.utcnow()
    run.reviewed_by = user_id
    run.review_note = data.get("note")
    await db.commit()
    if action == "approved":
        await _notify_review_result(db, tenant_id, user_id, run, approved=True)
    elif action == "reopened":
        await _notify_review_result(db, tenant_id, user_id, run, approved=False)
    return await get_run(db, tenant_id, run_id)


async def _apply_run_adjustments(
    db: AsyncSession, tenant_id: str, user_id: str, run: MandatoryStocktakeRun
) -> None:
    """تطبيق الفروقات مرة واحدة فقط بعد مراجعة الإدارة واعتمادها."""
    from app.modules.inventory.service import _get_or_create_stock

    lines = (await db.execute(
        select(MandatoryStocktakeLine).where(MandatoryStocktakeLine.run_id == run.id)
    )).scalars().all()
    for line in lines:
        if line.counted_qty is None:
            raise HTTPException(409, "لا يمكن اعتماد جرد يحتوي على صنف غير مكتمل")
        diff = Decimal(str(line.diff_qty or 0))
        if diff == 0:
            continue
        item = await db.get(InventoryItem, line.item_id)
        if not item:
            raise HTTPException(409, "صنف الجرد غير موجود")
        if line.tracking_type == "serial":
            expected = set(json.loads(line.expected_serials_json or "[]"))
            counted = set(json.loads(line.counted_serials_json or "[]"))
            counted_keys = {_norm_serial(x) for x in counted}
            missing = {serial for serial in expected if _norm_serial(serial) not in counted_keys}
            serial_rows = (await db.execute(select(SerialItem).where(
                SerialItem.product_id == line.item_id,
                SerialItem.warehouse_id == line.warehouse_id,
                SerialItem.serial_number.in_(missing),
                SerialItem.status == "in_stock",
            ))).scalars().all()
            for serial in serial_rows:
                serial.status = "damaged"
                serial.warehouse_id = None
                db.add(StockMovement(
                    id=str(uuid.uuid4()), tenant_id=tenant_id,
                    product_id=line.item_id, warehouse_id=line.warehouse_id,
                    movement_type="adjustment", quantity=Decimal("-1"),
                    unit_cost=serial.cost_price, serial_item_id=serial.id,
                    reference_type="mandatory_stocktake", reference_id=run.id,
                    created_by=user_id,
                    notes="تسوية جرد إلزامي — سيريال غير موجود في الجرد الفعلي",
                ))
        else:
            stock = await _get_or_create_stock(db, tenant_id, line.item_id, line.warehouse_id)
            stock.quantity = Decimal(str(line.counted_qty))
            stock.updated_at = datetime.utcnow()
            item.quantity_on_hand += diff
            if item.quantity_on_hand < 0:
                item.quantity_on_hand = Decimal("0")
            db.add(StockMovement(
                id=str(uuid.uuid4()), tenant_id=tenant_id,
                product_id=line.item_id, warehouse_id=line.warehouse_id,
                movement_type="adjustment", quantity=diff,
                unit_cost=item.cost_price, reference_type="mandatory_stocktake",
                reference_id=run.id, created_by=user_id,
                notes=f"تسوية جرد إلزامي — الكمية الفعلية: {line.counted_qty}",
            ))
    run.adjustments_applied_at = datetime.utcnow()
    run.adjustments_applied_by = user_id


async def _notify_review_result(
    db: AsyncSession, tenant_id: str, actor_id: str,
    run: MandatoryStocktakeRun, approved: bool, rep_id: str | None = None,
) -> None:
    query = select(SalesRep.user_id).join(
            MandatoryStocktakeLine, MandatoryStocktakeLine.rep_id == SalesRep.id
        ).where(MandatoryStocktakeLine.run_id == run.id, SalesRep.user_id.is_not(None))
    if rep_id:
        query = query.where(MandatoryStocktakeLine.rep_id == rep_id)
    rep_ids = (await db.execute(
        query
    )).scalars().all()
    from app.modules.notifications.service import notify_users_event
    await notify_users_event(
        db, tenant_id, actor_id, list(rep_ids),
        "تم اعتماد جرد المخزون" if approved else "تمت إعادة جرد المخزون للمراجعة",
        "Stocktake approved" if approved else "Stocktake reopened",
        "تم اعتماد جرد مستودعك وتطبيق التسوية المخزنية." if approved else "أعادت الإدارة جرد مستودعك للمراجعة، يرجى إعادة الرفع.",
        "Your warehouse stocktake was approved and adjustments were applied." if approved else "Management reopened your warehouse stocktake for review.",
        reference_id=run.id, reference_type="mandatory_stocktake",
    )


async def assert_rep_unlocked(db: AsyncSession, tenant_id: str, user_id: str) -> None:
    rep = await db.scalar(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.user_id == user_id, SalesRep.is_active.is_(True)))
    if not rep:
        return
    run = await _run_for_rep(db, tenant_id, rep.id)
    # بعد رفع الجرد يفتح التطبيق فورًا؛ الاعتماد الإداري يطبّق التسوية فقط.
    if run and run.status in ("pending", "reopened"):
        raise HTTPException(423, "التطبيق مقفل حتى إكمال الجرد الأسبوعي ورفعه للإدارة")
