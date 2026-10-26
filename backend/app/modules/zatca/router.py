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


@router.post("/production-csid")
async def production_csid(user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.request_production_csid(db, user["tenant_id"])


@router.post("/invoices/{invoice_id}/submit")
async def submit_invoice(invoice_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.submit_invoice(db, user["tenant_id"], user["user_id"], invoice_id)


@router.post("/credit-notes/{note_id}/submit")
async def submit_credit_note(note_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.submit_credit_note(db, user["tenant_id"], user["user_id"], note_id)


@router.get("/submissions")
async def list_submissions(document_id: str | None = None, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.list_submissions(db, user["tenant_id"], document_id)


@router.post("/submissions/{submission_id}/retry")
async def retry_submission(submission_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.retry_submission(db, user["tenant_id"], user["user_id"], submission_id)
