from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.notifications import service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(unread_only: bool = False, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.get_notifications(db, user["tenant_id"], unread_only, user)


@router.get("/count")
async def unread_count(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    count = await service.get_unread_count(db, user["tenant_id"], user)
    return {"count": count}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await service.mark_read(db, user["tenant_id"], notification_id, user)
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await service.mark_all_read(db, user["tenant_id"], user)
    return {"ok": True}


@router.get("/admin/recipients")
async def notification_recipients(
    tenant_id=Depends(get_tenant_id),
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_recipients(db, tenant_id)


@router.get("/admin/history")
async def notification_history(
    tenant_id=Depends(get_tenant_id),
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_manual_history(db, tenant_id)


@router.post("/admin/send")
async def send_manual_notification(
    data: dict,
    tenant_id=Depends(get_tenant_id),
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.create_manual_notifications(db, tenant_id, user, data)
    except ValueError as exc:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(exc))


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
