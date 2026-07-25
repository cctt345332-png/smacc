from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role, get_rep_id_for_user
from app.core.plan_limits import check_plan_limit
from app.modules.sales import service
from app.modules.sales import orders_service
from app.modules.sales.schemas import (
    CustomerCreate, CustomerUpdate, CustomerOut,
    InvoiceCreate, InvoiceOut, InvoiceReject,
    PaymentCreate, PaymentOut,
    QuotationCreate, QuotationOut,
    CreditNoteCreate,
)

router = APIRouter(prefix="/sales", tags=["sales"])


# ─── Customers ───────────────────────────────────────────────────────
@router.get("/customers", response_model=list[CustomerOut])
async def list_customers(
    search: Optional[str] = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # المندوب يشوف عملاءه فقط
    rep_id = None
    if user["role"] == "sales_rep":
        rep_id = await get_rep_id_for_user(db, user["user_id"])
    return await service.get_customers(db, user["tenant_id"], search, rep_id)


@router.get("/customers/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.get_customer(db, user["tenant_id"], customer_id)


@router.post("/customers", response_model=CustomerOut, status_code=201)
async def create_customer(
    data: CustomerCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # إذا مندوب — العميل يُنسب له تلقائياً
    rep_id = None
    if user["role"] == "sales_rep":
        rep_id = await get_rep_id_for_user(db, user["user_id"])
    return await service.create_customer(db, user["tenant_id"], data, rep_id)


@router.patch("/customers/{customer_id}", response_model=CustomerOut)
async def update_customer(customer_id: str, data: CustomerUpdate, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.update_customer(db, user["tenant_id"], customer_id, data)


# ─── Invoices ────────────────────────────────────────────────────────
@router.get("/invoices", response_model=list[InvoiceOut])
async def list_invoices(
    status: Optional[str] = None,
    customer_id: Optional[str] = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # المندوب يشوف فواتيره فقط
    rep_id = None
    if user["role"] == "sales_rep":
        rep_id = await get_rep_id_for_user(db, user["user_id"])
    return await service.get_invoices(db, user["tenant_id"], status, customer_id, rep_id)


@router.get("/invoices/summary")
async def sales_summary(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rep_id = None
    if user["role"] == "sales_rep":
        rep_id = await get_rep_id_for_user(db, user["user_id"])
    return await service.get_sales_summary(db, user["tenant_id"], rep_id)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.get_invoice(db, user["tenant_id"], invoice_id)


@router.post("/invoices", response_model=InvoiceOut, status_code=201)
async def create_invoice(
    data: InvoiceCreate,
    user=Depends(require_role(["manager","accountant","sales","sales_rep"])),
    _limit=Depends(check_plan_limit("invoices_per_month")),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_invoice(db, user["tenant_id"], user["user_id"], data)


@router.post("/invoices/{invoice_id}/confirm", response_model=InvoiceOut)
async def confirm_invoice(invoice_id: str, user=Depends(require_role(["manager","accountant","sales","sales_rep"])), db: AsyncSession = Depends(get_db)):
    return await service.confirm_invoice(db, user["tenant_id"], user["user_id"], invoice_id)


@router.post("/invoices/{invoice_id}/submit", response_model=InvoiceOut)
async def submit_invoice(invoice_id: str, user=Depends(require_role(["sales_rep","manager","accountant","sales"])), db: AsyncSession = Depends(get_db)):
    """المندوب يقدّم الفاتورة للمحاسب"""
    return await service.submit_invoice(db, user["tenant_id"], user["user_id"], invoice_id)


@router.post("/invoices/{invoice_id}/approve", response_model=InvoiceOut)
async def approve_invoice(invoice_id: str, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    """المحاسب/المدير يوافق على الفاتورة"""
    return await service.approve_invoice(db, user["tenant_id"], user["user_id"], invoice_id)


@router.post("/invoices/{invoice_id}/reject", response_model=InvoiceOut)
async def reject_invoice(invoice_id: str, data: InvoiceReject, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    """المحاسب/المدير يرفض الفاتورة مع سبب"""
    return await service.reject_invoice(db, user["tenant_id"], user["user_id"], invoice_id, data.rejection_note)


@router.patch("/invoices/{invoice_id}", response_model=InvoiceOut)
async def update_invoice(invoice_id: str, data: dict, user=Depends(require_role(["sales_rep","manager","accountant","sales"])), db: AsyncSession = Depends(get_db)):
    """تعديل فاتورة مسودة أو مرفوضة"""
    return await service.update_invoice(db, user["tenant_id"], user["user_id"], invoice_id, data)


@router.get("/invoices-pending", response_model=list[InvoiceOut])
async def pending_invoices(rep_id: Optional[str] = None, user=Depends(require_role(["manager","accountant","sales"])), db: AsyncSession = Depends(get_db)):
    """الفواتير المقدّمة بانتظار المراجعة"""
    return await service.get_submitted_invoices(db, user["tenant_id"], rep_id)


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceOut)
async def cancel_invoice(invoice_id: str, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.cancel_invoice(db, user["tenant_id"], invoice_id)


# ─── Payments ────────────────────────────────────────────────────────
@router.get("/payments", response_model=list[PaymentOut])
async def list_payments(
    invoice_id: Optional[str] = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # المندوب يشوف سنداته فقط
    rep_id = None
    if user["role"] == "sales_rep":
        rep_id = await get_rep_id_for_user(db, user["user_id"])
    return await service.get_payments(db, user["tenant_id"], invoice_id, rep_id)


@router.post("/payments", response_model=PaymentOut, status_code=201)
async def create_payment(data: PaymentCreate, user=Depends(require_role(["manager","accountant","sales","sales_rep"])), db: AsyncSession = Depends(get_db)):
    return await service.create_payment(db, user["tenant_id"], user["user_id"], data)


# ─── Quotations ──────────────────────────────────────────────────────
@router.get("/quotations", response_model=list[QuotationOut])
async def list_quotations(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_quotations(db, tenant_id)


@router.get("/quotations/{quotation_id}")
async def get_quotation(quotation_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select
    from app.models.sales import Quotation, QuotationLine
    r = await db.execute(
        select(Quotation).options(selectinload(Quotation.lines))
        .where(Quotation.id == quotation_id, Quotation.tenant_id == tenant_id)
    )
    q = r.scalar_one_or_none()
    if not q:
        from fastapi import HTTPException
        raise HTTPException(404, "Quotation not found")
    return q


@router.post("/quotations", response_model=QuotationOut, status_code=201)
async def create_quotation(data: QuotationCreate, user=Depends(require_role(["manager","accountant","sales"])), db: AsyncSession = Depends(get_db)):
    return await service.create_quotation(db, user["tenant_id"], user["user_id"], data)


@router.post("/quotations/{quotation_id}/convert-to-invoice", response_model=InvoiceOut)
async def convert_to_invoice(quotation_id: str, user=Depends(require_role(["manager","accountant","sales"])), db: AsyncSession = Depends(get_db)):
    return await service.convert_quotation_to_invoice(db, user["tenant_id"], user["user_id"], quotation_id)


# ─── Credit Notes ────────────────────────────────────────────────────
@router.post("/credit-notes", status_code=201)
async def create_credit_note(data: CreditNoteCreate, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_credit_note(db, user["tenant_id"], user["user_id"], data)


@router.get("/credit-notes")
async def list_credit_notes(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.sales import CreditNote, CreditNoteLine
    r = await db.execute(
        select(CreditNote).options(selectinload(CreditNote.lines))
        .where(CreditNote.tenant_id == tenant_id)
        .order_by(CreditNote.issue_date.desc())
    )
    return r.scalars().all()


@router.get("/credit-notes/{cn_id}")
async def get_credit_note(cn_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.sales import CreditNote
    r = await db.execute(
        select(CreditNote).options(selectinload(CreditNote.lines))
        .where(CreditNote.id == cn_id, CreditNote.tenant_id == tenant_id)
    )
    cn = r.scalar_one_or_none()
    if not cn:
        from fastapi import HTTPException
        raise HTTPException(404, "Credit note not found")
    return cn


# ─── Sales Orders ────────────────────────────────────────────────────
@router.get("/orders")
async def list_orders(status: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await orders_service.get_orders(db, tenant_id, status)


@router.get("/orders/{order_id}")
async def get_order(order_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.sales_orders import SalesOrder, SalesOrderLine
    r = await db.execute(
        select(SalesOrder).options(selectinload(SalesOrder.lines))
        .where(SalesOrder.id == order_id, SalesOrder.tenant_id == tenant_id)
    )
    order = r.scalar_one_or_none()
    if not order:
        from fastapi import HTTPException
        raise HTTPException(404, "Order not found")
    return order


@router.post("/orders", status_code=201)
async def create_order(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await orders_service.create_order(db, user["tenant_id"], user["user_id"], data)


@router.post("/orders/{order_id}/confirm")
async def confirm_order(order_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await orders_service.confirm_order(db, tenant_id, order_id)


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await orders_service.cancel_order(db, tenant_id, order_id)


@router.post("/orders/{order_id}/invoice")
async def order_to_invoice(order_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await orders_service.convert_order_to_invoice(db, user["tenant_id"], user["user_id"], order_id)


# ─── Customer Statement ──────────────────────────────────────────────
@router.get("/customers/{customer_id}/statement")
async def customer_statement(
    customer_id: str,
    from_date: datetime = Query(...),
    to_date: datetime = Query(...),
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await orders_service.get_customer_statement(db, tenant_id, customer_id, from_date, to_date)


# ─── Customer Documents ──────────────────────────────────────────────
@router.post("/customers/{customer_id}/documents/{doc_type}")
async def upload_customer_document(
    customer_id: str,
    doc_type: str,
    file: UploadFile = File(...),
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    import base64
    from sqlalchemy import select as sa_select
    from app.models.sales import Customer

    allowed = {"cr_document", "vat_document", "national_id_document", "license_document"}
    if doc_type not in allowed:
        from fastapi import HTTPException
        raise HTTPException(400, f"Invalid document type. Allowed: {allowed}")

    if file.content_type not in ("image/png", "image/jpeg", "application/pdf"):
        from fastapi import HTTPException
        raise HTTPException(400, "Only PNG, JPG, PDF allowed")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        from fastapi import HTTPException
        raise HTTPException(400, "File must be less than 5MB")

    doc_b64 = f"data:{file.content_type};base64,{base64.b64encode(content).decode()}"

    r = await db.execute(sa_select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id))
    customer = r.scalar_one_or_none()
    if not customer:
        from fastapi import HTTPException
        raise HTTPException(404, "Customer not found")

    setattr(customer, doc_type, doc_b64)
    await db.commit()
    return {"message": "Document uploaded", "doc_type": doc_type}
