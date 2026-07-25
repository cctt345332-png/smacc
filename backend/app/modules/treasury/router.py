from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.treasury import service

router = APIRouter(prefix="/treasury", tags=["treasury"])


@router.get("/vouchers")
async def list_vouchers(
    voucher_type: Optional[str] = None,
    status: Optional[str] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_vouchers(db, tenant_id, voucher_type, status)


@router.get("/vouchers/summary")
async def vouchers_summary(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_summary(db, tenant_id)


@router.get("/vouchers/{voucher_id}")
async def get_voucher(voucher_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_voucher(db, tenant_id, voucher_id)


@router.post("/vouchers", status_code=201)
async def create_voucher(data: dict, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_voucher(db, user["tenant_id"], user["user_id"], data)


@router.post("/vouchers/{voucher_id}/post")
async def post_voucher(voucher_id: str, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.post_voucher(db, user["tenant_id"], user["user_id"], voucher_id)


@router.post("/vouchers/{voucher_id}/cancel")
async def cancel_voucher(voucher_id: str, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.cancel_voucher(db, user["tenant_id"], voucher_id)


@router.post("/vouchers/{voucher_id}/create-asset")
async def create_asset_from_voucher(
    voucher_id: str,
    asset_data: dict,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """إنشاء أصل ثابت جديد من سند الصرف"""
    from app.modules.assets.schemas import AssetCreate
    from app.modules.assets.service import create_asset

    voucher = await service.get_voucher(db, user["tenant_id"], voucher_id)

    # إنشاء الأصل
    asset_create = AssetCreate(
        asset_number=asset_data.get("asset_number", f"FA-{voucher.voucher_number}"),
        name_ar=asset_data["name_ar"],
        name_en=asset_data.get("name_en"),
        category_id=asset_data["category_id"],
        purchase_date=voucher.voucher_date,
        purchase_cost=voucher.amount,
        salvage_value=asset_data.get("salvage_value", 0),
        useful_life_years=asset_data.get("useful_life_years", 5),
        depreciation_method=asset_data.get("depreciation_method", "straight_line"),
        depreciation_rate=asset_data.get("depreciation_rate", 20),
        vendor_name=voucher.party_name,
        invoice_number=voucher.reference,
    )
    asset = await create_asset(db, user["tenant_id"], asset_create)

    # ربط السند بالأصل
    voucher.asset_id = asset.id
    await db.commit()

    return {"asset": asset, "voucher_id": voucher_id}
