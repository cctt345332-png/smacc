from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.maintenance import service
from app.modules.maintenance.schemas import (
    MaintenanceRequestCreate,
    MaintenanceRequestOut,
    MaintenanceRequestUpdate,
    MaintenanceReplacement,
    MaintenanceSecretOut,
    MaintenanceStatusChange,
)

router = APIRouter(prefix="/maintenance", tags=["maintenance"])


@router.get("", response_model=list[MaintenanceRequestOut])
async def list_maintenance_requests(
    status: Optional[str] = None,
    rep_id: Optional[str] = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_requests(db, user["tenant_id"], user, status, rep_id)


@router.get("/{request_id}", response_model=MaintenanceRequestOut)
async def get_maintenance_request(
    request_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_request(db, user["tenant_id"], request_id, user)


@router.post("", response_model=MaintenanceRequestOut, status_code=201)
async def create_maintenance_request(
    data: MaintenanceRequestCreate,
    user=Depends(require_role(["sales_rep", "sales", "manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_request(db, user["tenant_id"], user, data)


@router.patch("/{request_id}", response_model=MaintenanceRequestOut)
async def update_maintenance_request(
    request_id: str,
    data: MaintenanceRequestUpdate,
    user=Depends(require_role(["sales_rep", "sales", "manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.update_request(db, user["tenant_id"], user, request_id, data)


@router.post("/{request_id}/status", response_model=MaintenanceRequestOut)
async def change_maintenance_status(
    request_id: str,
    data: MaintenanceStatusChange,
    user=Depends(require_role(["manager", "accountant", "sales_rep", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    update = MaintenanceRequestUpdate(status=data.status)
    return await service.update_request(db, user["tenant_id"], user, request_id, update)


@router.post("/{request_id}/replacement", response_model=MaintenanceRequestOut)
async def set_maintenance_replacement(
    request_id: str,
    data: MaintenanceReplacement,
    user=Depends(require_role(["admin", "manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.set_replacement(db, user["tenant_id"], user, request_id, data)


@router.get("/{request_id}/secret", response_model=MaintenanceSecretOut)
async def reveal_maintenance_secret(
    request_id: str,
    user=Depends(require_role(["admin", "manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.reveal_secret(db, user["tenant_id"], user, request_id)
