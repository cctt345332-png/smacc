from fastapi import APIRouter, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import require_role
from app.modules import zatca_service

router = APIRouter(prefix="/zatca", tags=["zatca"])


class ZATCAPrepareRequest(BaseModel):
    vat_number: str = Field(min_length=15, max_length=15)
    branch_name: str = Field(min_length=1, max_length=200)
    address_building: str = Field(min_length=1, max_length=20)
    address_street: str = Field(min_length=1, max_length=300)
    address_district: str = Field(min_length=1, max_length=100)
    address_city: str = Field(min_length=1, max_length=100)
    address_postal: str = Field(min_length=1, max_length=10)
    address_additional: str = Field(min_length=1, max_length=10)
    address_country: str = Field(default="SA", min_length=2, max_length=3)
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
    address = ", ".join([f"Building {data.address_building}", data.address_street, data.address_district, data.address_city, f"Postal {data.address_postal}", f"Additional {data.address_additional}", data.address_country])
    return await zatca_service.prepare(db, user["tenant_id"], data.vat_number, data.branch_name, address, data.activity, data.environment, data.invoice_type_map)


@router.post("/compliance-csid")
async def compliance_csid(data: ZATCAOTPRequest, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.request_compliance_csid(db, user["tenant_id"], data.otp)


@router.post("/production-csid")
async def production_csid(user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.request_production_csid(db, user["tenant_id"])


@router.post("/invoices/{invoice_id}/submit")
async def submit_invoice(invoice_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.submit_invoice(db, user["tenant_id"], user["user_id"], invoice_id)


@router.post("/invoices/{invoice_id}/submit-simulation")
async def submit_invoice_simulation(invoice_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.submit_invoice_simulation(db, user["tenant_id"], user["user_id"], invoice_id)


@router.get("/invoices/{invoice_id}/xml")
async def download_invoice_xml(invoice_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    xml = await zatca_service.invoice_xml(db, user["tenant_id"], invoice_id)
    return Response(content=xml, media_type="application/xml", headers={"Content-Disposition": f'attachment; filename="invoice-{invoice_id}.xml"'})


@router.post("/credit-notes/{note_id}/submit")
async def submit_credit_note(note_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.submit_credit_note(db, user["tenant_id"], user["user_id"], note_id)


@router.post("/credit-notes/{note_id}/submit-simulation")
async def submit_credit_note_simulation(note_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.submit_credit_note(db, user["tenant_id"], user["user_id"], note_id, simulation=True)


@router.get("/submissions")
async def list_submissions(document_id: str | None = None, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.list_submissions(db, user["tenant_id"], document_id)


@router.post("/submissions/{submission_id}/retry")
async def retry_submission(submission_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    return await zatca_service.retry_submission(db, user["tenant_id"], user["user_id"], submission_id)
