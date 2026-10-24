from datetime import date, datetime, timedelta
import uuid
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.reps import SalesRep
from app.models.user import User
from app.models.vehicle_maintenance import RepVehicle, VehicleMaintenanceRecord
from .schemas import MaintenanceCreate, OdometerUpdate, VehicleCreate, VehicleUpdate


def _date(value):
    return value.isoformat() if value else None


def _vehicle_out(vehicle: RepVehicle, rep_name: str | None = None, rep: SalesRep | None = None) -> dict:
    return {
        "id": vehicle.id, "rep_id": vehicle.rep_id, "rep_name": rep_name,
        "plate_number": rep.vehicle_plate if rep and rep.vehicle_plate is not None else vehicle.plate_number, "vehicle_type": rep.vehicle_type if rep and rep.vehicle_type is not None else vehicle.vehicle_type,
        "model": vehicle.model, "color": rep.vehicle_color if rep and rep.vehicle_color is not None else vehicle.color,
        "current_odometer": vehicle.current_odometer or 0,
        "odometer_updated_at": vehicle.odometer_updated_at.isoformat() if vehicle.odometer_updated_at else None,
        "oil_interval_km": vehicle.oil_interval_km, "oil_interval_days": vehicle.oil_interval_days,
        "next_oil_due_km": vehicle.next_oil_due_km, "next_oil_due_date": vehicle.next_oil_due_date,
        "tire_interval_km": vehicle.tire_interval_km, "battery_interval_days": vehicle.battery_interval_days,
        "brake_interval_km": vehicle.brake_interval_km, "next_tire_due_km": vehicle.next_tire_due_km,
        "next_battery_due_date": _date(vehicle.next_battery_due_date), "next_brake_due_km": vehicle.next_brake_due_km,
        "is_active": vehicle.is_active, "notes": vehicle.notes,
        "created_at": vehicle.created_at.isoformat() if vehicle.created_at else None,
    }


def _record_out(record: VehicleMaintenanceRecord) -> dict:
    return {
        "id": record.id, "vehicle_id": record.vehicle_id, "rep_id": record.rep_id,
        "service_type": record.service_type, "service_date": record.service_date,
        "odometer": record.odometer, "amount": record.amount or 0,
        "oil_type": record.oil_type, "vendor_name": record.vendor_name, "notes": record.notes,
        "next_due_km": record.next_due_km, "next_due_date": record.next_due_date,
        "created_by": record.created_by, "created_at": record.created_at.isoformat() if record.created_at else None,
        "approval_status": record.approval_status, "rejection_reason": record.rejection_reason,
        "approved_by": record.approved_by, "approved_at": record.approved_at.isoformat() if record.approved_at else None,
        "journal_entry_id": record.journal_entry_id,
    }


async def _get_rep(db: AsyncSession, tenant_id: str, user_id: str) -> SalesRep:
    rep = await db.scalar(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.user_id == user_id, SalesRep.is_active.is_(True)))
    if not rep:
        raise HTTPException(403, "هذا الحساب ليس مندوباً نشطاً")
    return rep


async def _get_vehicle(db: AsyncSession, tenant_id: str, vehicle_id: str) -> RepVehicle:
    vehicle = await db.scalar(select(RepVehicle).where(RepVehicle.tenant_id == tenant_id, RepVehicle.id == vehicle_id))
    if not vehicle:
        raise HTTPException(404, "المركبة غير موجودة")
    return vehicle


async def ensure_rep_vehicle(db: AsyncSession, tenant_id: str, rep: SalesRep) -> RepVehicle:
    vehicle = await db.scalar(select(RepVehicle).where(RepVehicle.tenant_id == tenant_id, RepVehicle.rep_id == rep.id))
    if vehicle:
        return vehicle
    vehicle = RepVehicle(
        id=str(uuid.uuid4()), tenant_id=tenant_id, rep_id=rep.id,
        plate_number=rep.vehicle_plate, vehicle_type=rep.vehicle_type,
        color=rep.vehicle_color, current_odometer=0,
    )
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    return vehicle


async def list_vehicles(db: AsyncSession, tenant_id: str) -> list[dict]:
    rows = (await db.execute(select(RepVehicle, SalesRep, User).join(SalesRep, SalesRep.id == RepVehicle.rep_id).join(User, User.id == SalesRep.user_id).where(RepVehicle.tenant_id == tenant_id).order_by(User.full_name))).all()
    return [_vehicle_out(vehicle, user.full_name, rep) for vehicle, rep, user in rows]


async def create_vehicle(db: AsyncSession, tenant_id: str, data: VehicleCreate) -> dict:
    rep = await db.scalar(select(SalesRep).where(SalesRep.tenant_id == tenant_id, SalesRep.id == data.rep_id))
    if not rep:
        raise HTTPException(404, "المندوب غير موجود")
    existing = await db.scalar(select(RepVehicle).where(RepVehicle.tenant_id == tenant_id, RepVehicle.rep_id == data.rep_id))
    if existing:
        raise HTTPException(409, "يوجد مركبة مرتبطة بهذا المندوب")
    vehicle = RepVehicle(id=str(uuid.uuid4()), tenant_id=tenant_id, **data.model_dump())
    vehicle.odometer_updated_at = datetime.utcnow() if data.current_odometer else None
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    user = await db.get(User, rep.user_id)
    return _vehicle_out(vehicle, user.full_name if user else None)


async def update_vehicle(db: AsyncSession, tenant_id: str, vehicle_id: str, data: VehicleUpdate) -> dict:
    vehicle = await _get_vehicle(db, tenant_id, vehicle_id)
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(vehicle, key, value)
    vehicle.updated_at = datetime.utcnow()
    db.add(vehicle)
    await db.commit()
    await db.refresh(vehicle)
    rep = await db.get(SalesRep, vehicle.rep_id)
    user = await db.get(User, rep.user_id) if rep else None
    return _vehicle_out(vehicle, user.full_name if user else None)


async def get_my_vehicle(db: AsyncSession, tenant_id: str, user_id: str) -> dict:
    rep = await _get_rep(db, tenant_id, user_id)
    vehicle = await ensure_rep_vehicle(db, tenant_id, rep)
    records = (await db.execute(select(VehicleMaintenanceRecord).where(VehicleMaintenanceRecord.tenant_id == tenant_id, VehicleMaintenanceRecord.vehicle_id == vehicle.id).order_by(VehicleMaintenanceRecord.service_date.desc(), VehicleMaintenanceRecord.created_at.desc()))).scalars().all()
    return {"vehicle": _vehicle_out(vehicle, None, rep), "maintenance": [_record_out(r) for r in records]}


async def update_my_odometer(db: AsyncSession, tenant_id: str, user_id: str, data: OdometerUpdate) -> dict:
    rep = await _get_rep(db, tenant_id, user_id)
    vehicle = await ensure_rep_vehicle(db, tenant_id, rep)
    if data.odometer < (vehicle.current_odometer or 0):
        raise HTTPException(400, "قراءة العداد الجديدة لا يمكن أن تكون أقل من القراءة السابقة")
    vehicle.current_odometer = data.odometer
    vehicle.odometer_updated_at = datetime.utcnow()
    vehicle.updated_at = datetime.utcnow()
    await db.commit()
    return _vehicle_out(vehicle)


async def add_my_maintenance(db: AsyncSession, tenant_id: str, user_id: str, data: MaintenanceCreate) -> dict:
    rep = await _get_rep(db, tenant_id, user_id)
    vehicle = await ensure_rep_vehicle(db, tenant_id, rep)
    if data.odometer < (vehicle.current_odometer or 0):
        raise HTTPException(400, "قراءة الصيانة أقل من قراءة العداد الحالية")
    vehicle.current_odometer = data.odometer
    vehicle.odometer_updated_at = datetime.utcnow()
    next_km = data.odometer + vehicle.oil_interval_km if data.service_type == "oil_change" else None
    next_date = data.service_date + timedelta(days=vehicle.oil_interval_days) if data.service_type == "oil_change" else None
    if data.service_type == "oil_change":
        vehicle.next_oil_due_km, vehicle.next_oil_due_date = next_km, next_date
    elif data.service_type == "tires":
        vehicle.next_tire_due_km = data.odometer + vehicle.tire_interval_km
    elif data.service_type == "brakes":
        vehicle.next_brake_due_km = data.odometer + vehicle.brake_interval_km
    elif data.service_type == "battery":
        vehicle.next_battery_due_date = data.service_date + timedelta(days=vehicle.battery_interval_days)
    record = VehicleMaintenanceRecord(
        id=str(uuid.uuid4()), tenant_id=tenant_id, vehicle_id=vehicle.id, rep_id=rep.id,
        service_type=data.service_type, service_date=data.service_date, odometer=data.odometer,
        amount=data.amount, oil_type=data.oil_type, vendor_name=data.vendor_name, notes=data.notes,
        next_due_km=next_km, next_due_date=next_date, created_by=user_id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    from app.modules.notifications.service import notify_management_event
    actor = await db.get(User, user_id)
    await notify_management_event(
        db, tenant_id, user_id, "طلب صيانة مركبة جديد", "New vehicle maintenance request",
        f"قدم {actor.full_name if actor else 'المندوب'} طلب صيانة ({data.service_type}) بمبلغ {data.amount} ر.س بانتظار الاعتماد.",
        f"A vehicle maintenance request ({data.service_type}) for {data.amount} SAR is awaiting approval.",
        record.id, "vehicle_maintenance",
    )
    return _record_out(record)


async def list_vehicle_maintenance(db: AsyncSession, tenant_id: str, vehicle_id: str) -> list[dict]:
    await _get_vehicle(db, tenant_id, vehicle_id)
    rows = (await db.execute(select(VehicleMaintenanceRecord).where(VehicleMaintenanceRecord.tenant_id == tenant_id, VehicleMaintenanceRecord.vehicle_id == vehicle_id).order_by(VehicleMaintenanceRecord.service_date.desc()))).scalars().all()
    return [_record_out(row) for row in rows]


async def list_all_maintenance(db: AsyncSession, tenant_id: str) -> list[dict]:
    rows = (await db.execute(
        select(VehicleMaintenanceRecord, User.full_name)
        .outerjoin(User, User.id == VehicleMaintenanceRecord.created_by)
        .where(VehicleMaintenanceRecord.tenant_id == tenant_id)
        .order_by(VehicleMaintenanceRecord.service_date.desc(), VehicleMaintenanceRecord.created_at.desc())
        .limit(300)
    )).all()
    return [{**_record_out(row), "requester_name": name} for row, name in rows]


async def decide_maintenance(db: AsyncSession, tenant_id: str, user_id: str, record_id: str, approve: bool, reason: str | None = None) -> dict:
    from app.models.accounting import FiscalYear, FiscalYearStatus, JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import get_operational_account, _next_entry_number
    record = await db.scalar(select(VehicleMaintenanceRecord).where(VehicleMaintenanceRecord.tenant_id == tenant_id, VehicleMaintenanceRecord.id == record_id).with_for_update())
    if not record:
        raise HTTPException(404, "طلب الصيانة غير موجود")
    if record.approval_status != "pending":
        raise HTTPException(409, "تمت معالجة طلب الصيانة مسبقًا")
    if not approve:
        record.approval_status, record.rejection_reason = "rejected", reason or "لم يتم ذكر السبب"
        record.approved_by, record.approved_at = user_id, datetime.utcnow()
        await db.commit()
        from app.modules.notifications.service import notify_users_event
        rep = await db.scalar(select(SalesRep).where(SalesRep.id == record.rep_id))
        await notify_users_event(db, tenant_id, user_id, [rep.user_id] if rep and rep.user_id else [], "تم رفض طلب الصيانة", "Maintenance request rejected", f"تم رفض طلب الصيانة. السبب: {record.rejection_reason}", f"Maintenance request rejected: {record.rejection_reason}", record.id, "vehicle_maintenance")
        return _record_out(record)
    expense_account = await get_operational_account(db, tenant_id, "operating_expenses")
    credit_account = await get_operational_account(db, tenant_id, "employee_advances")
    fy = (await db.execute(select(FiscalYear).where(FiscalYear.tenant_id == tenant_id, FiscalYear.status == FiscalYearStatus.OPEN, FiscalYear.start_date <= record.service_date, FiscalYear.end_date >= record.service_date).order_by(FiscalYear.is_default.desc(), FiscalYear.start_date.desc()))).scalars().first()
    if not fy:
        raise HTTPException(409, "لا توجد سنة مالية مفتوحة لتاريخ الصيانة")
    amount = Decimal(str(record.amount or 0))
    entry = JournalEntry(id=str(uuid.uuid4()), tenant_id=tenant_id, entry_number=await _next_entry_number(db, tenant_id), entry_date=datetime.combine(record.service_date, datetime.min.time()), fiscal_year_id=fy.id, description_ar=f"صيانة مركبة مندوب — {record.service_type}", description_en=f"Rep vehicle maintenance — {record.service_type}", status=JournalEntryStatus.POSTED, source="vehicle_maintenance", reference=record.id, total_debit=amount, total_credit=amount, created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow())
    db.add(entry)
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=expense_account.id, description=record.notes or record.service_type, debit=amount, credit=0, line_order=0))
    db.add(JournalEntryLine(id=str(uuid.uuid4()), entry_id=entry.id, account_id=credit_account.id, description=record.notes or record.service_type, debit=0, credit=amount, line_order=1))
    record.approval_status, record.journal_entry_id = "approved", entry.id
    record.approved_by, record.approved_at, record.rejection_reason = user_id, datetime.utcnow(), None
    await db.commit()
    from app.modules.notifications.service import notify_users_event
    rep = await db.scalar(select(SalesRep).where(SalesRep.id == record.rep_id))
    await notify_users_event(db, tenant_id, user_id, [rep.user_id] if rep and rep.user_id else [], "تم اعتماد طلب الصيانة", "Maintenance request approved", "تم اعتماد طلب الصيانة وترحيل تكلفتها محاسبيًا.", "Maintenance request approved and posted to accounting.", record.id, "vehicle_maintenance")
    return _record_out(record)
