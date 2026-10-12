from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import require_role
from app.modules import zatca_service

router = APIRouter(prefix="/zatca", tags=["zatca"])


class ZATCAPrepareRequest(BaseModel):
    vat_number: str = Field(min_length=15, max_length=15)
    branch_name: str = Field(min_length=1, max_length=200)
    activity: str = Field(min_length=1, max_length=300)
    environment: str = "sandbox"
    invoice_type_map: str = "both"


class ZATCAOTPRequest(BaseModel):
    otp: str = Field(min_length=4, max_length=6)


@router.get("/status")
async def get_status(user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.status(db, user["tenant_id"])


@router.post("/prepare")
async def prepare(data: ZATCAPrepareRequest, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.prepare(db, user["tenant_id"], data.vat_number, data.branch_name, data.activity, data.environment, data.invoice_type_map)


@router.post("/compliance-csid")
async def compliance_csid(data: ZATCAOTPRequest, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.request_compliance_csid(db, user["tenant_id"], data.otp)
