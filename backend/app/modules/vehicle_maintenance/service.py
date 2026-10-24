from datetime import date, datetime, timedelta
import uuid
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.reps import SalesRep
from app.models.user import User
from app.models.vehicle_maintenance import RepVehicle, VehicleMaintenanceRecord
from .schemas import MaintenanceCreate, OdometerUpdate, VehicleCreate, VehicleUpdate


def _date(value):
    return value.isoformat() if value else None


def _vehicle_out(vehicle: RepVehicle, rep_name: str | None = None) -> dict:
    return {
        "id": vehicle.id, "rep_id": vehicle.rep_id, "rep_name": rep_name,
        "plate_number": vehicle.plate_number, "vehicle_type": vehicle.vehicle_type,
        "model": vehicle.model, "color": vehicle.color,
        "current_odometer": vehicle.current_odometer or 0,
        "odometer_updated_at": vehicle.odometer_updated_at.isoformat() if vehicle.odometer_updated_at else None,
        "oil_interval_km": vehicle.oil_interval_km, "oil_interval_days": vehicle.oil_interval_days,
        "next_oil_due_km": vehicle.next_oil_due_km, "next_oil_due_date": vehicle.next_oil_due_date,
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
    rows = (await db.execute(select(RepVehicle, User).join(SalesRep, SalesRep.id == RepVehicle.rep_id).join(User, User.id == SalesRep.user_id).where(RepVehicle.tenant_id == tenant_id).order_by(User.full_name))).all()
    return [_vehicle_out(vehicle, user.full_name) for vehicle, user in rows]


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
    return {"vehicle": _vehicle_out(vehicle, None), "maintenance": [_record_out(r) for r in records]}


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
    next_km = data.odometer + vehicle.oil_interval_km
    next_date = data.service_date + timedelta(days=vehicle.oil_interval_days)
    vehicle.next_oil_due_km = next_km
    vehicle.next_oil_due_date = next_date
    record = VehicleMaintenanceRecord(
        id=str(uuid.uuid4()), tenant_id=tenant_id, vehicle_id=vehicle.id, rep_id=rep.id,
        service_type="oil_change", service_date=data.service_date, odometer=data.odometer,
        amount=data.amount, oil_type=data.oil_type, vendor_name=data.vendor_name, notes=data.notes,
        next_due_km=next_km, next_due_date=next_date, created_by=user_id,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return _record_out(record)


async def list_vehicle_maintenance(db: AsyncSession, tenant_id: str, vehicle_id: str) -> list[dict]:
    await _get_vehicle(db, tenant_id, vehicle_id)
    rows = (await db.execute(select(VehicleMaintenanceRecord).where(VehicleMaintenanceRecord.tenant_id == tenant_id, VehicleMaintenanceRecord.vehicle_id == vehicle_id).order_by(VehicleMaintenanceRecord.service_date.desc()))).scalars().all()
    return [_record_out(row) for row in rows]
