"""
Ecommerce Service — المتجر الإلكتروني
"""
import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.ecommerce import Store, StoreCategory, StoreProduct, StoreOrder, StoreOrderLine, StoreStatus, OrderStatus


# ─── Store ───────────────────────────────────────────────────────────

async def get_store(db: AsyncSession, tenant_id: str) -> Store | None:
    r = await db.execute(select(Store).where(Store.tenant_id == tenant_id))
    return r.scalar_one_or_none()


async def get_store_by_slug(db: AsyncSession, slug: str) -> Store | None:
    r = await db.execute(select(Store).where(Store.slug == slug, Store.status == "active"))
    return r.scalar_one_or_none()


async def create_or_update_store(db: AsyncSession, tenant_id: str, data: dict) -> Store:
    store = await get_store(db, tenant_id)
    if store:
        for k, v in data.items():
            if hasattr(store, k):
                setattr(store, k, v)
        store.updated_at = datetime.utcnow()
    else:
        slug = data.get("slug") or tenant_id[:20].replace("-", "")
        store = Store(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name_ar=data.get("name_ar", "متجري"),
            name_en=data.get("name_en"),
            slug=slug,
            description_ar=data.get("description_ar"),
            description_en=data.get("description_en"),
            status=data.get("status", "draft"),
            currency=data.get("currency", "SAR"),
            phone=data.get("phone"),
            email=data.get("email"),
            whatsapp=data.get("whatsapp"),
            shipping_enabled=data.get("shipping_enabled", False),
            free_shipping_threshold=Decimal(str(data.get("free_shipping_threshold", 0))) if data.get("free_shipping_threshold") else None,
            default_shipping_cost=Decimal(str(data.get("default_shipping_cost", 0))),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(store)
    await db.commit()
    await db.refresh(store)
    return store


# ─── Categories ──────────────────────────────────────────────────────

async def get_categories(db: AsyncSession, store_id: str) -> list[StoreCategory]:
    r = await db.execute(
        select(StoreCategory)
        .where(StoreCategory.store_id == store_id, StoreCategory.is_active == True)
        .order_by(StoreCategory.sort_order)
    )
    return r.scalars().all()


async def create_category(db: AsyncSession, store_id: str, data: dict) -> StoreCategory:
    cat = StoreCategory(
        id=str(uuid.uuid4()),
        store_id=store_id,
        name_ar=data["name_ar"],
        name_en=data.get("name_en"),
        image_url=data.get("image_url"),
        sort_order=data.get("sort_order", 0),
        created_at=datetime.utcnow(),
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


# ─── Products ────────────────────────────────────────────────────────

async def get_products(
    db: AsyncSession, store_id: str,
    category_id: Optional[str] = None,
    featured_only: bool = False,
    active_only: bool = True,
) -> list[StoreProduct]:
    q = select(StoreProduct).where(StoreProduct.store_id == store_id)
    if active_only:
        q = q.where(StoreProduct.is_active == True)
    if category_id:
        q = q.where(StoreProduct.category_id == category_id)
    if featured_only:
        q = q.where(StoreProduct.is_featured == True)
    r = await db.execute(q.order_by(StoreProduct.is_featured.desc(), StoreProduct.created_at.desc()))
    return r.scalars().all()


async def get_product(db: AsyncSession, store_id: str, product_id: str) -> StoreProduct:
    r = await db.execute(
        select(StoreProduct).where(StoreProduct.id == product_id, StoreProduct.store_id == store_id)
    )
    p = r.scalar_one_or_none()
    if not p:
        raise HTTPException(404, "المنتج غير موجود")
    return p


async def create_product(db: AsyncSession, store_id: str, data: dict) -> StoreProduct:
    p = StoreProduct(
        id=str(uuid.uuid4()),
        store_id=store_id,
        category_id=data.get("category_id"),
        inventory_item_id=data.get("inventory_item_id"),
        name_ar=data["name_ar"],
        name_en=data.get("name_en"),
        description_ar=data.get("description_ar"),
        description_en=data.get("description_en"),
        brand=data.get("brand"),
        sku=data.get("sku"),
        price=Decimal(str(data["price"])),
        compare_price=Decimal(str(data["compare_price"])) if data.get("compare_price") else None,
        image_url=data.get("image_url"),
        images_json=data.get("images_json"),
        stock_quantity=data.get("stock_quantity", 0),
        allow_backorder=data.get("allow_backorder", False),
        track_inventory=data.get("track_inventory", True),
        is_active=data.get("is_active", True),
        is_featured=data.get("is_featured", False),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def update_product(db: AsyncSession, store_id: str, product_id: str, data: dict) -> StoreProduct:
    p = await get_product(db, store_id, product_id)
    for k, v in data.items():
        if hasattr(p, k) and k not in ("id", "store_id", "created_at"):
            setattr(p, k, v)
    p.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(p)
    return p


# ─── Orders ──────────────────────────────────────────────────────────

async def get_orders(
    db: AsyncSession, store_id: str,
    status: Optional[str] = None,
    limit: int = 50,
) -> list[StoreOrder]:
    q = select(StoreOrder).where(StoreOrder.store_id == store_id)
    if status:
        q = q.where(StoreOrder.status == status)
    q = q.options(selectinload(StoreOrder.lines)).order_by(StoreOrder.created_at.desc()).limit(limit)
    r = await db.execute(q)
    return r.scalars().all()


async def get_order(db: AsyncSession, store_id: str, order_id: str) -> StoreOrder:
    r = await db.execute(
        select(StoreOrder)
        .options(selectinload(StoreOrder.lines))
        .where(StoreOrder.id == order_id, StoreOrder.store_id == store_id)
    )
    o = r.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "الطلب غير موجود")
    return o


async def create_order(db: AsyncSession, store_id: str, data: dict) -> StoreOrder:
    # توليد رقم الطلب
    count = (await db.execute(
        select(func.count()).where(StoreOrder.store_id == store_id)
    )).scalar() or 0
    order_number = f"ORD-{str(count + 1).zfill(5)}"

    lines_data = data.get("lines", [])
    subtotal = sum(Decimal(str(l["unit_price"])) * l["quantity"] for l in lines_data)
    shipping_cost = Decimal(str(data.get("shipping_cost", 0)))
    total = subtotal + shipping_cost

    order = StoreOrder(
        id=str(uuid.uuid4()),
        store_id=store_id,
        order_number=order_number,
        customer_name=data["customer_name"],
        customer_phone=data["customer_phone"],
        customer_email=data.get("customer_email"),
        shipping_city=data.get("shipping_city"),
        shipping_address=data.get("shipping_address"),
        subtotal=subtotal,
        shipping_cost=shipping_cost,
        total=total,
        status="pending",
        payment_method=data.get("payment_method", "cod"),
        notes=data.get("notes"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(order)
    await db.flush()

    for l in lines_data:
        line = StoreOrderLine(
            id=str(uuid.uuid4()),
            order_id=order.id,
            product_id=l["product_id"],
            product_name=l["product_name"],
            unit_price=Decimal(str(l["unit_price"])),
            quantity=l["quantity"],
            total=Decimal(str(l["unit_price"])) * l["quantity"],
            variant_id=l.get("variant_id"),
            variant_info=l.get("variant_info"),
        )
        db.add(line)

    await db.commit()
    await db.refresh(order)
    return order


async def update_order_status(db: AsyncSession, store_id: str, order_id: str, status: str) -> StoreOrder:
    order = await get_order(db, store_id, order_id)
    order.status = status
    order.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(order)
    return order


# ─── Store Stats ─────────────────────────────────────────────────────

async def get_store_stats(db: AsyncSession, store_id: str) -> dict:
    total_orders = (await db.execute(
        select(func.count()).where(StoreOrder.store_id == store_id)
    )).scalar() or 0

    pending_orders = (await db.execute(
        select(func.count()).where(StoreOrder.store_id == store_id, StoreOrder.status == "pending")
    )).scalar() or 0

    total_revenue = (await db.execute(
        select(func.sum(StoreOrder.total)).where(
            StoreOrder.store_id == store_id,
            StoreOrder.status.in_(["delivered", "confirmed"])
        )
    )).scalar() or Decimal("0")

    total_products = (await db.execute(
        select(func.count()).where(StoreProduct.store_id == store_id, StoreProduct.is_active == True)
    )).scalar() or 0

    return {
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "total_revenue": float(total_revenue),
        "total_products": total_products,
    }
