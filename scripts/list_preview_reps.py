import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://erp:PreviewReps2026x@127.0.0.1:5432/erp_reps_preview")

from sqlalchemy import select
from app.core.database import async_session
from app.models.reps import SalesRep


async def main() -> None:
    async with async_session() as session:
        rows = (await session.execute(select(SalesRep.id, SalesRep.rep_code, SalesRep.tenant_id).limit(10))).all()
        for rep_id, rep_code, tenant_id in rows:
            print(f"{rep_id}\t{rep_code}\t{tenant_id}")


asyncio.run(main())
