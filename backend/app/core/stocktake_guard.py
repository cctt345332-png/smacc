from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import get_current_user
from app.modules.inventory.mandatory_stocktake_service import assert_rep_unlocked


async def mandatory_stocktake_guard(
    request: Request,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # القراءة مسموحة لإظهار شاشة الجرد، أما عمليات التعديل فتتوقف للمندوب.
    if request.method in {"OPTIONS", "GET", "HEAD"}:
        return
    if request.url.path.rstrip("/").endswith("/mandatory-stocktake/rep/submit"):
        return
    await assert_rep_unlocked(db, user["tenant_id"], user["user_id"])
