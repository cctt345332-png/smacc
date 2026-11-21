from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import get_current_user
from app.modules.daily_report.service import build_daily_report

router = APIRouter(prefix="/reports/daily", tags=["daily-report"])


@router.get("")
async def daily_report(
    date_from: str | None = None,
    date_to: str | None = None,
    warehouse_id: str | None = None,
    terminal_id: str | None = None,
    rep_id: str | None = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await build_daily_report(
            db,
            user["tenant_id"],
            date_from,
            date_to,
            warehouse_id,
            terminal_id,
            rep_id,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
