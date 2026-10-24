from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.tenant import get_current_user, require_role
from . import service
from .schemas import MaintenanceCreate, MaintenanceDecision, OdometerUpdate, VehicleCreate, VehicleUpdate

router = APIRouter(prefix="/vehicle-maintenance", tags=["vehicle-maintenance"])


@router.get("/me")
async def my_vehicle(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.get_my_vehicle(db, user["tenant_id"], user["user_id"])


@router.patch("/me/odometer")
async def update_my_odometer(data: OdometerUpdate, user=Depends(require_role(["sales_rep"])), db: AsyncSession = Depends(get_db)):
    return await service.update_my_odometer(db, user["tenant_id"], user["user_id"], data)


@router.post("/me/maintenance", status_code=201)
async def add_my_maintenance(data: MaintenanceCreate, user=Depends(require_role(["sales_rep"])), db: AsyncSession = Depends(get_db)):
    return await service.add_my_maintenance(db, user["tenant_id"], user["user_id"], data)


@router.get("/me/maintenance")
async def my_maintenance(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    payload = await service.get_my_vehicle(db, user["tenant_id"], user["user_id"])
    return payload["maintenance"]


@router.get("/vehicles")
async def list_vehicles(user=Depends(require_role(["manager", "accountant", "sales"])), db: AsyncSession = Depends(get_db)):
    return await service.list_vehicles(db, user["tenant_id"])


@router.post("/vehicles", status_code=201)
async def create_vehicle(data: VehicleCreate, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_vehicle(db, user["tenant_id"], data)


@router.patch("/vehicles/{vehicle_id}")
async def update_vehicle(vehicle_id: str, data: VehicleUpdate, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.update_vehicle(db, user["tenant_id"], vehicle_id, data)


@router.get("/vehicles/{vehicle_id}/maintenance")
async def vehicle_maintenance(vehicle_id: str, user=Depends(require_role(["manager", "accountant", "sales"])), db: AsyncSession = Depends(get_db)):
    return await service.list_vehicle_maintenance(db, user["tenant_id"], vehicle_id)


@router.get("/maintenance/requests")
async def maintenance_requests(user=Depends(require_role(["manager", "accountant", "sales"])), db: AsyncSession = Depends(get_db)):
    return await service.list_all_maintenance(db, user["tenant_id"])


@router.post("/maintenance/{record_id}/approve")
async def approve_maintenance(record_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.decide_maintenance(db, user["tenant_id"], user["user_id"], record_id, True)


@router.post("/maintenance/{record_id}/reject")
async def reject_maintenance(record_id: str, data: MaintenanceDecision, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.decide_maintenance(db, user["tenant_id"], user["user_id"], record_id, False, data.rejection_reason)
