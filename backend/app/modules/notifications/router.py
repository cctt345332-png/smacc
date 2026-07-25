from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id
from app.modules.notifications import service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(unread_only: bool = False, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_notifications(db, tenant_id, unread_only)


@router.get("/count")
async def unread_count(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    count = await service.get_unread_count(db, tenant_id)
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    await service.mark_read(db, tenant_id, notification_id)
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    await service.mark_all_read(db, tenant_id)
    return {"ok": True}


@router.get("/alert-settings")
async def get_alert_settings(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_alert_settings(db, tenant_id)


@router.put("/alert-settings")
async def update_alert_settings(data: dict, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.update_alert_settings(db, tenant_id, data)


@router.post("/run-asset-alerts")
async def run_asset_alerts(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.run_asset_alerts(db, tenant_id)


@router.post("/run-all-alerts")
async def run_all_alerts(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    """فحص كل الأقسام وإنشاء التنبيهات"""
    return await service.run_all_alerts(db, tenant_id)
