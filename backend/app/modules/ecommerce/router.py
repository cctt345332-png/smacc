from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.modules.ecommerce import service

router = APIRouter(prefix="/store", tags=["ecommerce"])


# ─── Store Settings ──────────────────────────────────────────────────
@router.get("/settings")
async def get_store(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_store(db, tenant_id)


@router.put("/settings")
async def upsert_store(data: dict, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await service.create_or_update_store(db, user["tenant_id"], data)


@router.get("/stats")
async def store_stats(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    store = await service.get_store(db, tenant_id)
    if not store:
        return {"total_orders": 0, "pending_orders": 0, "total_revenue": 0, "total_products": 0}
    return await service.get_store_stats(db, store.id)


# ─── Public Store (بدون auth) ─────────────────────────────────────────
@router.get("/public/{slug}")
async def get_public_store(slug: str, db: AsyncSession = Depends(get_db)):
    """صفحة المتجر العامة — بدون تسجيل دخول"""
    store = await service.get_store_by_slug(db, slug)
    if not store:
        from fastapi import HTTPException
        raise HTTPException(404, "المتجر غير موجود أو غير نشط")
    return store


@router.get("/public/{slug}/products")
async def get_public_products(
    slug: str,
    category_id: Optional[str] = None,
    featured_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    store = await service.get_store_by_slug(db, slug)
    if not store:
        from fastapi import HTTPException
        raise HTTPException(404, "المتجر غير موجود")
    return await service.get_products(db, store.id, category_id, featured_only)


@router.post("/public/{slug}/orders", status_code=201)
async def create_public_order(slug: str, data: dict, db: AsyncSession = Depends(get_db)):
    """إنشاء طلب من المتجر العام — بدون تسجيل دخول"""
    store = await service.get_store_by_slug(db, slug)
    if not store:
        from fastapi import HTTPException
        raise HTTPException(404, "المتجر غير موجود")
    return await service.create_order(db, store.id, data)


# ─── Categories (إدارة) ───────────────────────────────────────────────
@router.get("/categories")
async def list_categories(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    store = await service.get_store(db, tenant_id)
    if not store:
        return []
    return await service.get_categories(db, store.id)


@router.post("/categories", status_code=201)
async def create_category(data: dict, user=Depends(require_role(["manager","sales"])), db: AsyncSession = Depends(get_db)):
    store = await service.get_store(db, user["tenant_id"])
    if not store:
        from fastapi import HTTPException
        raise HTTPException(400, "يجب إنشاء المتجر أولاً")
    return await service.create_category(db, store.id, data)


# ─── Products (إدارة) ────────────────────────────────────────────────
@router.get("/products")
async def list_products(
    category_id: Optional[str] = None,
    featured_only: bool = False,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    store = await service.get_store(db, tenant_id)
    if not store:
        return []
    return await service.get_products(db, store.id, category_id, featured_only)


@router.get("/products/{product_id}")
async def get_product(product_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    store = await service.get_store(db, tenant_id)
    if not store:
        from fastapi import HTTPException
        raise HTTPException(404, "المتجر غير موجود")
    return await service.get_product(db, store.id, product_id)


@router.post("/products", status_code=201)
async def create_product(data: dict, user=Depends(require_role(["manager","sales"])), db: AsyncSession = Depends(get_db)):
    store = await service.get_store(db, user["tenant_id"])
    if not store:
        from fastapi import HTTPException
        raise HTTPException(400, "يجب إنشاء المتجر أولاً")
    return await service.create_product(db, store.id, data)


@router.patch("/products/{product_id}")
async def update_product(product_id: str, data: dict, user=Depends(require_role(["manager","sales"])), db: AsyncSession = Depends(get_db)):
    store = await service.get_store(db, user["tenant_id"])
    if not store:
        from fastapi import HTTPException
        raise HTTPException(404, "المتجر غير موجود")
    return await service.update_product(db, store.id, product_id, data)


# ─── Orders (إدارة) ──────────────────────────────────────────────────
@router.get("/orders")
async def list_orders(
    status: Optional[str] = None,
    limit: int = 50,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    store = await service.get_store(db, tenant_id)
    if not store:
        return []
    return await service.get_orders(db, store.id, status, limit)


@router.get("/orders/{order_id}")
async def get_order(order_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    store = await service.get_store(db, tenant_id)
    if not store:
        from fastapi import HTTPException
        raise HTTPException(404, "المتجر غير موجود")
    return await service.get_order(db, store.id, order_id)


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    data: dict,
    user=Depends(require_role(["manager","sales"])),
    db: AsyncSession = Depends(get_db),
):
    store = await service.get_store(db, user["tenant_id"])
    if not store:
        from fastapi import HTTPException
        raise HTTPException(404, "المتجر غير موجود")
    return await service.update_order_status(db, store.id, order_id, data["status"])
