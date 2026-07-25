from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.assets import service
from app.modules.assets.schemas import (
    AssetCategoryCreate, AssetCategoryOut,
    AssetCreate, AssetUpdate, AssetOut,
    DepreciationLineOut, AssetDisposalRequest, DepreciationRunRequest,
)

router = APIRouter(prefix="/assets", tags=["assets"])


# ─── Categories ──────────────────────────────────────────────────────
@router.get("/categories", response_model=list[AssetCategoryOut])
async def list_categories(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_categories(db, tenant_id)


@router.post("/categories", response_model=AssetCategoryOut, status_code=201)
async def create_category(data: AssetCategoryCreate, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_category(db, user["tenant_id"], data)


# ─── Assets ──────────────────────────────────────────────────────────
@router.get("", response_model=list[AssetOut])
async def list_assets(status: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_assets(db, tenant_id, status)


@router.get("/summary")
async def assets_summary(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_assets_summary(db, tenant_id)


@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset(asset_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_asset(db, tenant_id, asset_id)


@router.post("", response_model=AssetOut, status_code=201)
async def create_asset(data: AssetCreate, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_asset(db, user["tenant_id"], data)


@router.patch("/{asset_id}", response_model=AssetOut)
async def update_asset(asset_id: str, data: AssetUpdate, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.update_asset(db, user["tenant_id"], asset_id, data)


# ─── Depreciation ────────────────────────────────────────────────────
@router.get("/{asset_id}/depreciation-schedule", response_model=list[DepreciationLineOut])
async def depreciation_schedule(asset_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_depreciation_schedule(db, tenant_id, asset_id)


@router.post("/depreciation/run")
async def run_depreciation(data: DepreciationRunRequest, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    lines = await service.run_depreciation(db, user["tenant_id"], user["user_id"], data)
    return {"processed": len(lines), "message": f"تم احتساب استهلاك {len(lines)} أصل"}


# ─── Disposal ────────────────────────────────────────────────────────
@router.post("/{asset_id}/dispose", response_model=AssetOut)
async def dispose_asset(asset_id: str, data: AssetDisposalRequest, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.dispose_asset(db, user["tenant_id"], user["user_id"], asset_id, data)
