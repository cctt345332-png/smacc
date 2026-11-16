"""ZKTeco ADMS compatibility endpoints.

The device connects to the public API host and posts to /iclock/cdata.
The serial number (SN) is the tenant-safe device identity; no user session is
required because the device is authenticated by its registered serial number.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.hr import BiometricDevice
from app.modules.hr import biometric_service

router = APIRouter(prefix="/iclock", tags=["biometric-adms"])


def _serial(sn: Optional[str], request: Request) -> str:
    return (sn or request.query_params.get("SN") or request.query_params.get("sn") or "").strip()


async def _find_device(db: AsyncSession, sn: str) -> BiometricDevice | None:
    if not sn:
        return None
    return await db.scalar(
        select(BiometricDevice).where(
            BiometricDevice.serial_number == sn,
            BiometricDevice.is_active.is_(True),
        )
    )


@router.get("/cdata", response_class=PlainTextResponse)
async def adms_cdata_get(
    request: Request,
    sn: Optional[str] = Query(None, alias="SN"),
    db: AsyncSession = Depends(get_db),
):
    """Device handshake/configuration request."""
    device = await _find_device(db, _serial(sn, request))
    if device:
        device.last_sync_at = datetime.utcnow()
        device.last_sync_status = "adms:connected"
        await db.commit()
    return "OK"


@router.post("/cdata", response_class=PlainTextResponse)
async def adms_cdata_post(
    request: Request,
    sn: Optional[str] = Query(None, alias="SN"),
    table: Optional[str] = Query(None, alias="table"),
    db: AsyncSession = Depends(get_db),
):
    """Receive ZKTeco tab-separated ATTLOG rows and queue them once."""
    device = await _find_device(db, _serial(sn, request))
    if not device:
        # ZKTeco expects a plain response; do not expose tenant information.
        return PlainTextResponse("ERROR:UNKNOWN_DEVICE", status_code=404)

    body = await request.body()
    table_name = (table or "ATTLOG").upper()
    if table_name not in {"ATTLOG", "OPERLOG"}:
        return "OK"

    rows = []
    text = body.decode("utf-8-sig", errors="replace")
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        fields = line.split("\t")
        user_id = (fields[0] if fields else "").strip()
        occurred = (fields[1] if len(fields) > 1 else "").strip()
        if not user_id or not occurred:
            continue
        event_type = (fields[2] if len(fields) > 2 else "punch").strip() or "punch"
        verify = (fields[3] if len(fields) > 3 else "").strip()
        work_code = (fields[4] if len(fields) > 4 else "").strip()
        rows.append({
            "device_user_id": user_id,
            "occurred_at": occurred,
            "event_type": event_type,
            "verify_mode": verify,
            "work_code": work_code,
            "external_id": f"adms:{device.id}:{user_id}:{occurred}:{event_type}",
        })

    await biometric_service.ingest_adms_logs(db, device, rows)
    # تحويل السجلات إلى حضور يومي تلقائيًا بعد استقبالها.
    await biometric_service.process_logs(db, device.tenant_id)
    return "OK"


@router.get("/getrequest", response_class=PlainTextResponse)
async def adms_getrequest(
    request: Request,
    sn: Optional[str] = Query(None, alias="SN"),
    db: AsyncSession = Depends(get_db),
):
    """Return no pending commands while acknowledging the device poll."""
    device = await _find_device(db, _serial(sn, request))
    if device:
        device.last_sync_at = datetime.utcnow()
        device.last_sync_status = "adms:polling"
        await db.commit()
    return "OK"


@router.get("/devicecmd", response_class=PlainTextResponse)
async def adms_devicecmd(
    request: Request,
    sn: Optional[str] = Query(None, alias="SN"),
    db: AsyncSession = Depends(get_db),
):
    device = await _find_device(db, _serial(sn, request))
    if device:
        device.last_sync_at = datetime.utcnow()
        device.last_sync_status = "adms:ready"
        await db.commit()
    return "OK"
