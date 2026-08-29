from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.purchases import service

router = APIRouter(prefix="/purchases", tags=["purchases"])

# ─── Vendors ─────────────────────────────────────────────────────────
@router.get("/vendors")
async def list_vendors(search: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_vendors(db, tenant_id, search)

@router.get("/vendors/{vendor_id}")
async def get_vendor(vendor_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_vendor(db, tenant_id, vendor_id)

@router.post("/vendors", status_code=201)
async def create_vendor(data: dict, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.create_vendor(db, tenant_id, data)

@router.patch("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, data: dict, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.update_vendor(db, tenant_id, vendor_id, data)

# ─── Purchase Orders ─────────────────────────────────────────────────
@router.get("/orders")
async def list_orders(status: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_purchase_orders(db, tenant_id, status)

@router.get("/orders/{order_id}")
async def get_order(order_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_purchase_order(db, tenant_id, order_id)

@router.post("/orders", status_code=201)
async def create_order(data: dict, user=Depends(require_role(["manager","purchaser"])), db: AsyncSession = Depends(get_db)):
    return await service.create_purchase_order(db, user["tenant_id"], user["user_id"], data)

@router.post("/orders/{order_id}/confirm")
async def confirm_order(order_id: str, user=Depends(require_role(["manager","purchaser"])), db: AsyncSession = Depends(get_db)):
    return await service.confirm_purchase_order(db, user["tenant_id"], order_id)

@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, user=Depends(require_role(["manager","purchaser"])), db: AsyncSession = Depends(get_db)):
    return await service.cancel_purchase_order(db, user["tenant_id"], order_id)

@router.post("/orders/{order_id}/bill")
async def order_to_bill(order_id: str, user=Depends(require_role(["manager","purchaser","accountant"])), db: AsyncSession = Depends(get_db)):
    """تحويل أمر الشراء لفاتورة واردة"""
    return await service.convert_order_to_bill(db, user["tenant_id"], user["user_id"], order_id)

# ─── Bills ───────────────────────────────────────────────────────────
@router.get("/bills")
async def list_bills(status: Optional[str] = None, vendor_id: Optional[str] = None, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_bills(db, tenant_id, status, vendor_id)

@router.get("/bills/summary")
async def bills_summary(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_purchases_summary(db, tenant_id)

@router.get("/bills/{bill_id}")
async def get_bill(bill_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_bill(db, tenant_id, bill_id)

@router.post("/bills", status_code=201)
async def create_bill(data: dict, user=Depends(require_role(["manager","purchaser","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_bill(db, user["tenant_id"], user["user_id"], data)

@router.patch("/bills/{bill_id}")
async def update_bill(bill_id: str, data: dict, user=Depends(require_role(["manager","purchaser","accountant"])), db: AsyncSession = Depends(get_db)):
    """تعديل فاتورة — كامل للمسودة، حقول مختارة للمؤكدة"""
    return await service.update_bill(db, user["tenant_id"], user["user_id"], bill_id, data)


@router.post("/bills/{bill_id}/confirm")
async def confirm_bill(bill_id: str, user=Depends(require_role(["manager","purchaser","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.confirm_bill(db, user["tenant_id"], user["user_id"], bill_id)

@router.post("/bills/{bill_id}/cancel")
async def cancel_bill(bill_id: str, user=Depends(require_role(["manager","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.cancel_bill(db, user["tenant_id"], bill_id)


@router.post("/bills/{bill_id}/reprocess-inventory")
async def reprocess_bill_inventory(
    bill_id: str,
    user=Depends(require_role(["manager"])),
    db: AsyncSession = Depends(get_db),
):
    """
    إعادة معالجة المخزون لفاتورة مؤكدة.
    يُستخدم لإصلاح الفواتير القديمة التي أُكِّدت قبل إصلاح bug إضافة المخزون.
    - يتجاهل السيريالات الموجودة مسبقاً (يتخطاها بصمت)
    - يُضيف فقط السيريالات غير الموجودة
    """
    return await service.reprocess_bill_inventory(db, user["tenant_id"], user["user_id"], bill_id)

@router.get("/bills/{bill_id}/serials")
async def get_bill_serials(
    bill_id: str,
    product_id: Optional[str] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """جلب السيريالات المرتبطة بفاتورة مشتريات — لاستخدامها في المرتجع"""
    return await service.get_bill_serials(db, tenant_id, bill_id, product_id)

@router.post("/bills/{bill_id}/payments", status_code=201)
async def create_payment(bill_id: str, data: dict, user=Depends(require_role(["manager","purchaser","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_bill_payment(db, user["tenant_id"], user["user_id"], {**data, "bill_id": bill_id})

@router.get("/bills/{bill_id}/payments")
async def get_payments(bill_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select
    from app.models.purchases import BillPayment
    r = await db.execute(select(BillPayment).where(BillPayment.bill_id == bill_id, BillPayment.tenant_id == tenant_id))
    return r.scalars().all()

# ─── Debit Notes ─────────────────────────────────────────────────────
@router.get("/debit-notes")
async def list_debit_notes(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_debit_notes(db, tenant_id)

@router.post("/debit-notes", status_code=201)
async def create_debit_note(data: dict, user=Depends(require_role(["manager","purchaser","accountant"])), db: AsyncSession = Depends(get_db)):
    return await service.create_debit_note(db, user["tenant_id"], user["user_id"], data)


# ─── Vendor Statement ─────────────────────────────────────────────────
@router.get("/vendors/{vendor_id}/statement")
async def vendor_statement(
    vendor_id: str,
    from_date: str,
    to_date: str,
    account_id: str | None = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    fd = datetime.fromisoformat(from_date)
    td = datetime.fromisoformat(to_date)
    return await service.get_vendor_statement(db, tenant_id, vendor_id, fd, td, account_id)
