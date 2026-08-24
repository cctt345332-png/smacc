"""
خدمة المخزون — العزل الصحيح بين أنواع التتبع
كل دالة تتحقق من tracking_type قبل التنفيذ
"""
import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.inventory import (
    InventoryItem, SerialItem, BatchItem, ProductVariant,
    StockMovement, Warehouse, ProductCategory,
    TrackingType, SerialStatus, MovementType
)
from sqlalchemy import select


# ─── Helpers ─────────────────────────────────────────────────────────

def _get_default_tracking(business_type: str) -> TrackingType:
    """يحدد نوع التتبع الافتراضي حسب نشاط الشركة"""
    mapping = {
        "mobile_phones": "serial",
        "pharmacy":      "batch",
        "clothing":      "variant",
        "grocery":       "quantity",
        "spices":        "weight",
        "spare_parts":   "quantity",
        "construction":  "quantity",
        "general":       "quantity",
    }
    return mapping.get(business_type, "quantity")


async def _next_sku(db: AsyncSession, tenant_id: str) -> str:
    r = await db.execute(
        select(func.count(InventoryItem.id)).where(InventoryItem.tenant_id == tenant_id)
    )
    return f"SKU-{str((r.scalar() or 0) + 1).zfill(6)}"


# ─── Warehouses ──────────────────────────────────────────────────────

async def get_warehouses(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(Warehouse).where(Warehouse.tenant_id == tenant_id, Warehouse.is_active == True)
        .order_by(Warehouse.is_default.desc())
    )
    return r.scalars().all()


async def create_warehouse(db: AsyncSession, tenant_id: str, data: dict) -> Warehouse:
    # إذا كان is_default، نلغي الافتراضي الحالي
    if data.get("is_default"):
        await db.execute(
            select(Warehouse).where(Warehouse.tenant_id == tenant_id, Warehouse.is_default == True)
        )
        existing = (await db.execute(
            select(Warehouse).where(Warehouse.tenant_id == tenant_id, Warehouse.is_default == True)
        )).scalars().all()
        for w in existing:
            w.is_default = False

    wh = Warehouse(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        name_ar=data["name_ar"], name_en=data.get("name_en"),
        branch_name=data.get("branch_name"),
        is_default=data.get("is_default", False),
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return wh


# ─── Categories ──────────────────────────────────────────────────────

async def get_categories(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(ProductCategory).where(
            ProductCategory.tenant_id == tenant_id,
            ProductCategory.is_active == True
        ).order_by(ProductCategory.name_ar)
    )
    return r.scalars().all()


async def create_category(db: AsyncSession, tenant_id: str, data: dict) -> ProductCategory:
    cat = ProductCategory(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        name_ar=data["name_ar"], name_en=data.get("name_en"),
        parent_id=data.get("parent_id"),
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


# ─── Products ────────────────────────────────────────────────────────

async def get_items(
    db: AsyncSession, tenant_id: str,
    search: str | None = None,
    category_id: str | None = None,
    tracking_type: str | None = None,
    low_stock: bool = False,
):
    q = select(InventoryItem).options(
        selectinload(InventoryItem.category)
    ).where(
        InventoryItem.tenant_id == tenant_id,
        InventoryItem.is_active == True,
    )
    if search:
        q = q.where(
            InventoryItem.name_ar.ilike(f"%{search}%") |
            InventoryItem.sku.ilike(f"%{search}%") |
            InventoryItem.barcode.ilike(f"%{search}%")
        )
    if category_id:
        q = q.where(InventoryItem.category_id == category_id)
    if tracking_type:
        try:
            tt = TrackingType(tracking_type.lower())
            q = q.where(InventoryItem.tracking_type == tt)
        except ValueError:
            pass
    if low_stock:
        q = q.where(InventoryItem.quantity_on_hand <= InventoryItem.reorder_point)
    q = q.order_by(InventoryItem.name_ar)
    r = await db.execute(q)
    return r.scalars().all()


async def get_item(db: AsyncSession, tenant_id: str, item_id: str) -> InventoryItem:
    item = await db.get(InventoryItem, item_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "Item not found")
    return item


async def _get_default_warehouse_id(db: AsyncSession, tenant_id: str) -> str | None:
    """جلب المستودع الرئيسي للـ tenant"""
    r = await db.execute(
        select(Warehouse).where(
            Warehouse.tenant_id == tenant_id,
            Warehouse.is_default == True,
            Warehouse.is_active == True,
        )
    )
    wh = r.scalar_one_or_none()
    if wh:
        return wh.id
    # لو ما في مستودع رئيسي محدد، خذ أول مستودع
    r2 = await db.execute(
        select(Warehouse).where(
            Warehouse.tenant_id == tenant_id,
            Warehouse.is_active == True,
        ).order_by(Warehouse.created_at.asc()).limit(1)
    )
    wh2 = r2.scalar_one_or_none()
    return wh2.id if wh2 else None


async def create_item(db: AsyncSession, tenant_id: str, data: dict) -> InventoryItem:
    # إذا ما أُرسل مستودع افتراضي، استخدم المستودع الرئيسي تلقائياً
    if not data.get("default_warehouse_id"):
        data["default_warehouse_id"] = await _get_default_warehouse_id(db, tenant_id)

    item = InventoryItem(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        sku=data.get("sku") or await _next_sku(db, tenant_id),
        name_ar=data["name_ar"],
        name_en=data.get("name_en"),
        barcode=data.get("barcode"),
        description_ar=data.get("description_ar"),
        category_id=data.get("category_id"),
        default_warehouse_id=data.get("default_warehouse_id"),
        tracking_type=data.get("tracking_type", "quantity"),
        unit_type=data.get("unit_type", "piece"),
        cost_price=Decimal(str(data.get("cost_price", 0))),
        sale_price=Decimal(str(data.get("sale_price", 0))),
        vat_rate=Decimal(str(data.get("vat_rate", 15))),
        reorder_point=Decimal(str(data.get("reorder_point", 0))),
        store_enabled=data.get("store_enabled", False),
        store_description_ar=data.get("store_description_ar"),
        store_images_json=data.get("store_images_json"),
        store_price=Decimal(str(data.get("store_price"))) if data.get("store_price") else None,
        pos_enabled=data.get("pos_enabled", True),
        color=data.get("color"),
        storage=data.get("storage"),
        # حقول الصيدلية
        manufacturer=data.get("manufacturer"),
        sfda_number=data.get("sfda_number"),
        dosage_form=data.get("dosage_form"),
        concentration=data.get("concentration"),
        requires_prescription=data.get("requires_prescription", False),
        generic_name=data.get("generic_name"),
        country_of_origin=data.get("country_of_origin"),
        import_license=data.get("import_license"),
        gs1_code=data.get("gs1_code"),
        nphies_code=data.get("nphies_code"),
        extra_attrs_json=data.get("extra_attrs_json"),
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    # إذا كانت هناك كمية أولية للمنتجات العادية
    initial_qty = data.get("initial_qty", 0)
    if initial_qty and float(initial_qty) > 0 and item.tracking_type == "quantity":
        from decimal import Decimal as D
        item.quantity_on_hand = D(str(initial_qty))
        item.cost_price = D(str(data.get("cost_price", 0)))
        db.add(StockMovement(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            product_id=item.id,
            movement_type="purchase",
            quantity=D(str(initial_qty)),
            unit_cost=D(str(data.get("cost_price", 0))),
            reference_type="initial",
            reference_id=item.id,
        ))
        await db.commit()
        await db.refresh(item)

    # التشغيلة الأولية للصيدلية
    initial_batch = data.get("initial_batch")
    if initial_batch and item.tracking_type == "batch":
        batch_qty = Decimal(str(initial_batch.get("quantity", 0)))
        if batch_qty > 0:
            from datetime import date as dt_date
            expiry_raw = initial_batch.get("expiry_date")
            manufacture_raw = initial_batch.get("manufacture_date")

            batch = BatchItem(
                id=str(uuid.uuid4()),
                product_id=item.id,
                warehouse_id=data.get("default_warehouse_id"),
                batch_number=initial_batch["batch_number"],
                expiry_date=datetime.fromisoformat(expiry_raw) if expiry_raw else None,
                manufacture_date=datetime.fromisoformat(manufacture_raw) if manufacture_raw else None,
                quantity=batch_qty,
                cost_price=Decimal(str(initial_batch.get("cost_price", 0))),
                purchase_bill_id=None,
            )
            db.add(batch)

            # تحديث الكمية الإجمالية
            item.quantity_on_hand = batch_qty
            item.cost_price = Decimal(str(initial_batch.get("cost_price", 0)))

            db.add(StockMovement(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                product_id=item.id,
                movement_type="purchase",
                quantity=batch_qty,
                unit_cost=Decimal(str(initial_batch.get("cost_price", 0))),
                batch_item_id=batch.id,
                reference_type="initial",
                reference_id=item.id,
            ))
            await db.commit()
            await db.refresh(item)

    return item


async def update_item(db: AsyncSession, tenant_id: str, item_id: str, data: dict) -> InventoryItem:
    item = await get_item(db, tenant_id, item_id)
    old_store_enabled = item.store_enabled

    allowed = [
        "name_ar", "name_en", "barcode", "description_ar", "category_id",
        "sale_price", "vat_rate", "reorder_point", "store_enabled",
        "store_description_ar", "store_images_json", "store_price",
        "store_featured", "pos_enabled", "is_active", "tracking_type",
        # حقول الصيدلية
        "manufacturer", "sfda_number", "dosage_form", "concentration",
        "requires_prescription", "generic_name", "country_of_origin",
        "import_license", "gs1_code", "nphies_code",
    ]
    for k in allowed:
        if k in data and data[k] is not None:
            setattr(item, k, data[k])
    item.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(item)

    return item


# ─── Serial Items (جوالات / إلكترونيات) ─────────────────────────────

async def get_serials(
    db: AsyncSession, tenant_id: str, product_id: str,
    status: str | None = None
):
    """جلب السيريالات مع التحقق من أن المنتج يدعم السيريال"""
    item = await get_item(db, tenant_id, product_id)
    if item.tracking_type != "serial":
        raise HTTPException(400, "هذا المنتج لا يستخدم تتبع السيريال")

    q = select(SerialItem).where(SerialItem.product_id == product_id)
    if status:
        q = q.where(SerialItem.status == status)
    q = q.order_by(SerialItem.created_at.desc())
    r = await db.execute(q)
    return r.scalars().all()


async def add_serial(
    db: AsyncSession, tenant_id: str, product_id: str,
    serial_number: str, condition: str, cost_price: Decimal,
    sale_price: Decimal | None = None,
    warehouse_id: str | None = None,
    purchase_bill_id: str | None = None,
    notes: str | None = None,
    auto_commit: bool = True,
) -> SerialItem:
    """إضافة سيريال جديد للمخزون"""
    item = await get_item(db, tenant_id, product_id)
    if item.tracking_type != "serial":
        raise HTTPException(400, "هذا المنتج لا يستخدم تتبع السيريال")

    # إذا ما أُرسل مستودع، استخدم المستودع الرئيسي تلقائياً
    if not warehouse_id:
        warehouse_id = await _get_default_warehouse_id(db, tenant_id)

    # التحقق من عدم تكرار السيريال
    existing = await db.execute(
        select(SerialItem).where(
            SerialItem.product_id == product_id,
            SerialItem.serial_number == serial_number,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"السيريال {serial_number} موجود مسبقاً")

    serial = SerialItem(
        id=str(uuid.uuid4()),
        product_id=product_id,
        warehouse_id=warehouse_id,
        serial_number=serial_number,
        condition=condition,
        status="in_stock",
        cost_price=cost_price,
        sale_price=sale_price,
        purchase_bill_id=purchase_bill_id,
        notes=notes,
        purchased_at=datetime.utcnow(),
    )
    db.add(serial)

    # حركة مخزون
    db.add(StockMovement(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        product_id=product_id,
        warehouse_id=warehouse_id,
        movement_type="purchase",
        quantity=Decimal("1"),
        unit_cost=cost_price,
        serial_item_id=serial.id,
        reference_type="bill",
        reference_id=purchase_bill_id,
    ))

    if auto_commit:
        await db.commit()
        await db.refresh(serial)
    return serial


async def sell_serial(
    db: AsyncSession, tenant_id: str, serial_id: str,
    sale_price: Decimal, invoice_id: str | None = None,
) -> dict:
    """بيع سيريال — يُحسب الربح تلقائياً"""
    serial = await db.get(SerialItem, serial_id)
    if not serial:
        raise HTTPException(404, "السيريال غير موجود")

    item = await get_item(db, tenant_id, serial.product_id)

    if serial.status != "in_stock":
        raise HTTPException(400, f"السيريال غير متاح — الحالة: {serial.status}")

    serial.status = "sold"
    serial.sale_price = sale_price
    serial.sale_invoice_id = invoice_id
    serial.sold_at = datetime.utcnow()

    # حركة مخزون
    db.add(StockMovement(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        product_id=serial.product_id,
        movement_type="sale",
        quantity=Decimal("-1"),
        unit_cost=serial.cost_price,
        serial_item_id=serial_id,
        reference_type="invoice",
        reference_id=invoice_id,
    ))

    profit = sale_price - serial.cost_price
    await db.commit()

    return {
        "serial_id": serial_id,
        "serial_number": serial.serial_number,
        "cost_price": float(serial.cost_price),
        "sale_price": float(sale_price),
        "profit": float(profit),
        "profit_margin_pct": float(profit / sale_price * 100) if sale_price > 0 else 0,
    }


# ─── Quantity Movement (للمنتجات العادية) ────────────────────────────

async def add_stock(
    db: AsyncSession, tenant_id: str, product_id: str,
    quantity: Decimal, unit_cost: Decimal,
    warehouse_id: str | None = None,
    reference_type: str | None = None,
    reference_id: str | None = None,
    user_id: str | None = None,
    auto_commit: bool = True,
    movement_type: str = "purchase",
):
    """إضافة كمية للمخزون (للمنتجات العادية)"""
    item = await get_item(db, tenant_id, product_id)
    if item.tracking_type == "serial":
        raise HTTPException(400, "استخدم add_serial للمنتجات ذات السيريال")

    # إذا ما أُرسل مستودع، استخدم المستودع الرئيسي تلقائياً
    if not warehouse_id:
        warehouse_id = await _get_default_warehouse_id(db, tenant_id)

    item.quantity_on_hand += quantity
    # تحديث متوسط التكلفة المتحرك
    if item.quantity_on_hand > 0:
        total_value = (item.quantity_on_hand - quantity) * item.cost_price + quantity * unit_cost
        item.cost_price = (total_value / item.quantity_on_hand).quantize(Decimal("0.0001"))

    # تحديث inventory_stock للمستودع المحدد
    if warehouse_id:
        stock = await _get_or_create_stock(db, tenant_id, product_id, warehouse_id)
        stock.quantity += quantity
        stock.updated_at = datetime.utcnow()

    db.add(StockMovement(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        product_id=product_id,
        warehouse_id=warehouse_id,
        movement_type=movement_type,
        quantity=quantity,
        unit_cost=unit_cost,
        reference_type=reference_type,
        reference_id=reference_id,
        created_by=user_id,
    ))

    if auto_commit:
        await db.commit()
        await db.refresh(item)
    return item
async def deduct_stock(
    db: AsyncSession, tenant_id: str, product_id: str,
    quantity: Decimal,
    warehouse_id: str | None = None,
    reference_type: str | None = None,
    reference_id: str | None = None,
    user_id: str | None = None,
):
    """خصم كمية من المخزون"""
    item = await get_item(db, tenant_id, product_id)
    if item.tracking_type == "serial":
        raise HTTPException(400, "استخدم sell_serial للمنتجات ذات السيريال")

    if item.quantity_on_hand < quantity:
        raise HTTPException(400, f"الكمية المتاحة {item.quantity_on_hand} أقل من المطلوب {quantity}")

    item.quantity_on_hand -= quantity

    # تحديث inventory_stock للمستودع المحدد
    if warehouse_id:
        stock = await _get_or_create_stock(db, tenant_id, product_id, warehouse_id)
        if stock.quantity >= quantity:
            stock.quantity -= quantity
            stock.updated_at = datetime.utcnow()

    db.add(StockMovement(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        product_id=product_id,
        warehouse_id=warehouse_id,
        movement_type="sale",
        quantity=-quantity,
        unit_cost=item.cost_price,
        reference_type=reference_type,
        reference_id=reference_id,
        created_by=user_id,
    ))

    await db.commit()
    await db.refresh(item)
    return item


# ─── Reports ─────────────────────────────────────────────────────────

async def get_serial_profit_report(
    db: AsyncSession, tenant_id: str,
    product_id: str | None = None,
    from_date: datetime | None = None,
    to_date: datetime | None = None,
):
    """تقرير الربح لكل سيريال — الميزة الفريدة للجوالات"""
    q = select(SerialItem).join(
        InventoryItem, SerialItem.product_id == InventoryItem.id
    ).where(
        InventoryItem.tenant_id == tenant_id,
        SerialItem.status == "sold",
        SerialItem.sale_price.isnot(None),
    )
    if product_id:
        q = q.where(SerialItem.product_id == product_id)
    if from_date:
        q = q.where(SerialItem.sold_at >= from_date)
    if to_date:
        q = q.where(SerialItem.sold_at <= to_date)

    r = await db.execute(q.options(selectinload(SerialItem.product)))
    serials = r.scalars().all()

    rows = []
    total_cost = Decimal("0")
    total_revenue = Decimal("0")

    for s in serials:
        profit = (s.sale_price or Decimal("0")) - s.cost_price
        total_cost += s.cost_price
        total_revenue += s.sale_price or Decimal("0")
        rows.append({
            "serial_id": s.id,
            "serial_number": s.serial_number,
            "product_name": s.product.name_ar if s.product else "",
            "condition": s.condition,
            "cost_price": float(s.cost_price),
            "sale_price": float(s.sale_price or 0),
            "profit": float(profit),
            "profit_pct": float(profit / s.sale_price * 100) if s.sale_price else 0,
            "sold_at": s.sold_at.isoformat() if s.sold_at else None,
        })

    total_profit = total_revenue - total_cost
    return {
        "rows": rows,
        "summary": {
            "count": len(rows),
            "total_cost": float(total_cost),
            "total_revenue": float(total_revenue),
            "total_profit": float(total_profit),
            "avg_profit_pct": float(total_profit / total_revenue * 100) if total_revenue else 0,
        }
    }


async def get_stock_value_report(db: AsyncSession, tenant_id: str):
    """تقرير قيمة المخزون — لكل الأنشطة"""
    from sqlalchemy import select as sa_select

    items_r = await db.execute(
        sa_select(InventoryItem).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active == True,
        )
    )
    items = items_r.scalars().all()

    rows = []
    total_cost_value = Decimal("0")
    total_sale_value = Decimal("0")

    for item in items:
        if item.tracking_type == "serial":
            # عدد السيريالات المتاحة وقيمتها
            serials_r = await db.execute(
                select(SerialItem).where(
                    SerialItem.product_id == item.id,
                    SerialItem.status == "in_stock",
                )
            )
            serials = serials_r.scalars().all()
            qty = len(serials)
            cost_val = sum(s.cost_price for s in serials)
            sale_val = sum(s.sale_price or item.sale_price for s in serials)
        elif item.tracking_type == "batch":
            batches_r = await db.execute(
                select(BatchItem).where(BatchItem.product_id == item.id)
            )
            batches = batches_r.scalars().all()
            qty = sum(b.quantity for b in batches)
            cost_val = sum(b.quantity * b.cost_price for b in batches)
            sale_val = qty * item.sale_price
        elif item.tracking_type == "variant":
            variants_r = await db.execute(
                select(ProductVariant).where(
                    ProductVariant.product_id == item.id,
                    ProductVariant.is_active == True,
                )
            )
            variants = variants_r.scalars().all()
            qty = sum(v.quantity for v in variants)
            cost_val = sum(v.quantity * v.cost_price for v in variants)
            sale_val = qty * item.sale_price
        else:
            qty = item.quantity_on_hand
            cost_val = qty * item.cost_price
            sale_val = qty * item.sale_price

        total_cost_value += cost_val
        total_sale_value += sale_val

        rows.append({
            "id": item.id,
            "name_ar": item.name_ar,
            "sku": item.sku,
            "tracking_type": item.tracking_type,
            "unit_type": item.unit_type,
            "quantity": float(qty),
            "cost_price": float(item.cost_price),
            "sale_price": float(item.sale_price),
            "cost_value": float(cost_val),
            "sale_value": float(sale_val),
            "potential_profit": float(sale_val - cost_val),
            "reorder_point": float(item.reorder_point),
            "is_low_stock": item.tracking_type == "quantity" and qty <= item.reorder_point,
        })

    rows.sort(key=lambda x: x["cost_value"], reverse=True)

    return {
        "rows": rows,
        "summary": {
            "total_items": len(rows),
            "total_cost_value": float(total_cost_value),
            "total_sale_value": float(total_sale_value),
            "total_potential_profit": float(total_sale_value - total_cost_value),
            "low_stock_count": sum(1 for r in rows if r["is_low_stock"]),
        }
    }


async def get_stock_summary(db: AsyncSession, tenant_id: str):
    """ملخص المخزون"""
    items_r = await db.execute(
        select(InventoryItem).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active == True,
        )
    )
    items = items_r.scalars().all()

    total_value = sum(
        float(i.quantity_on_hand) * float(i.cost_price)
        for i in items if i.tracking_type == "quantity"
    )
    low_stock = [i for i in items if i.quantity_on_hand <= i.reorder_point and i.tracking_type == "quantity"]

    # عدد السيريالات المتاحة
    serials_r = await db.execute(
        select(func.count(SerialItem.id)).join(
            InventoryItem, SerialItem.product_id == InventoryItem.id
        ).where(
            InventoryItem.tenant_id == tenant_id,
            SerialItem.status == "in_stock",
        )
    )
    serials_count = serials_r.scalar() or 0

    return {
        "total_items": len(items),
        "total_value": round(total_value, 2),
        "low_stock_count": len(low_stock),
        "serials_in_stock": serials_count,
    }



# ─── Delete Item ──────────────────────────────────────────────────────
async def delete_item(db: AsyncSession, tenant_id: str, item_id: str):
    """حذف صنف — soft delete (تعطيل)"""
    item = await get_item(db, tenant_id, item_id)
    # التحقق من عدم وجود سيريالات متاحة
    if item.tracking_type == "serial":
        r = await db.execute(
            select(func.count(SerialItem.id)).where(
                SerialItem.product_id == item_id,
                SerialItem.status == "in_stock",
            )
        )
        if (r.scalar() or 0) > 0:
            raise HTTPException(400, "لا يمكن حذف صنف يحتوي على سيريالات متاحة في المخزون")
    item.is_active = False
    item.updated_at = datetime.utcnow()
    await db.commit()
    return {"message": "تم حذف الصنف"}


# ─── Update Serial ────────────────────────────────────────────────────
async def update_serial(
    db: AsyncSession, tenant_id: str, serial_id: str, data: dict
) -> SerialItem:
    """تعديل بيانات سيريال — السعر والحالة والملاحظات"""
    serial = await db.get(SerialItem, serial_id)
    if not serial:
        raise HTTPException(404, "السيريال غير موجود")
    # التحقق من الـ tenant عبر المنتج
    await get_item(db, tenant_id, serial.product_id)

    allowed = ["condition", "status", "cost_price", "sale_price", "notes"]
    for k in allowed:
        if k in data and data[k] is not None:
            if k in ("cost_price", "sale_price"):
                setattr(serial, k, Decimal(str(data[k])))
            else:
                setattr(serial, k, data[k])
    await db.commit()
    await db.refresh(serial)
    return serial


# ─── Delete Serial ────────────────────────────────────────────────────
async def delete_serial(db: AsyncSession, tenant_id: str, serial_id: str):
    """حذف سيريال — فقط إذا كان في المخزون (لم يُباع)"""
    serial = await db.get(SerialItem, serial_id)
    if not serial:
        raise HTTPException(404, "السيريال غير موجود")
    await get_item(db, tenant_id, serial.product_id)

    if getattr(serial.status, "value", serial.status) != "in_stock":
        raise HTTPException(400, "لا يمكن حذف سيريال له حالة بيع أو حجز أو مرتجع؛ احتفظ به لسجل التتبع")
    movement_count = (await db.execute(select(func.count(StockMovement.id)).where(StockMovement.serial_item_id == serial_id))).scalar() or 0
    if movement_count:
        raise HTTPException(400, "لا يمكن حذف سيريال له حركات مخزون؛ أوقفه أو عدّل حالته بدلاً من ذلك")

    await db.delete(serial)
    await db.commit()
    return {"message": "تم حذف السيريال"}


# ─── Inventory Stock (كمية لكل مستودع) ───────────────────────────────

async def _get_or_create_stock(
    db: AsyncSession, tenant_id: str, item_id: str, warehouse_id: str
):
    """جلب أو إنشاء سجل المخزون لصنف في مستودع"""
    from app.models.inventory import InventoryStock
    r = await db.execute(
        select(InventoryStock).where(
            InventoryStock.item_id == item_id,
            InventoryStock.warehouse_id == warehouse_id,
        )
    )
    stock = r.scalar_one_or_none()
    if not stock:
        stock = InventoryStock(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            item_id=item_id,
            warehouse_id=warehouse_id,
            quantity=Decimal("0"),
            updated_at=datetime.utcnow(),
        )
        db.add(stock)
    return stock


async def get_stock_by_warehouse(db: AsyncSession, tenant_id: str, warehouse_id: str | None = None):
    """جلب المخزون مع تفصيل لكل مستودع — يدمج الكميات العادية + السيريالات"""
    from app.models.inventory import InventoryStock
    from sqlalchemy.orm import selectinload as sil

    results = []

    # ── 1. الأصناف العادية (quantity/batch/variant) من inventory_stock ──
    q = select(InventoryStock).options(
        sil(InventoryStock.item).selectinload(InventoryItem.category),
        sil(InventoryStock.warehouse),
    ).join(InventoryItem, InventoryStock.item_id == InventoryItem.id).where(
        InventoryStock.tenant_id == tenant_id,
        InventoryItem.is_active == True,
        InventoryStock.quantity > 0,
    )
    if warehouse_id:
        q = q.where(InventoryStock.warehouse_id == warehouse_id)
    q = q.order_by(InventoryItem.name_ar)
    r = await db.execute(q)
    stocks = r.scalars().all()
    for s in stocks:
        results.append({
            "stock_id": s.id,
            "item_id": s.item_id,
            "item_name": s.item.name_ar if s.item else "",
            "item_sku": s.item.sku if s.item else "",
            "item_tracking": s.item.tracking_type if s.item else "",
            "category_name": s.item.category.name_ar if s.item and s.item.category else None,
            "warehouse_id": s.warehouse_id,
            "warehouse_name": s.warehouse.name_ar if s.warehouse else "",
            "quantity": float(s.quantity),
            "reserved_qty": float(s.reserved_qty),
            "available_qty": float(s.quantity - s.reserved_qty),
            "reorder_point": float(s.reorder_point),
            "is_low_stock": s.quantity <= s.reorder_point and s.reorder_point > 0,
            "cost_price": float(s.item.cost_price) if s.item else 0,
            "sale_price": float(s.item.sale_price) if s.item else 0,
            "stock_value": float(s.quantity * s.item.cost_price) if s.item else 0,
        })

    # ── 2. أصناف السيريال — تُجمع من serial_items ──────────────────────
    serial_q = (
        select(
            SerialItem.product_id,
            SerialItem.warehouse_id,
            func.count(SerialItem.id).label("qty"),
            func.avg(SerialItem.sale_price).label("avg_sale_price"),
            func.avg(SerialItem.cost_price).label("avg_cost_price"),
        )
        .join(InventoryItem, SerialItem.product_id == InventoryItem.id)
        .where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active == True,
            SerialItem.status == "in_stock",
        )
        .group_by(SerialItem.product_id, SerialItem.warehouse_id)
    )
    if warehouse_id:
        serial_q = serial_q.where(SerialItem.warehouse_id == warehouse_id)

    sr = await db.execute(serial_q)
    serial_rows = sr.all()

    if serial_rows:
        # جلب تفاصيل الأصناف والمستودعات
        product_ids = list({row.product_id for row in serial_rows})
        wh_ids = list({row.warehouse_id for row in serial_rows if row.warehouse_id})

        items_r = await db.execute(
            select(InventoryItem).options(sil(InventoryItem.category))
            .where(InventoryItem.id.in_(product_ids))
        )
        items_map = {i.id: i for i in items_r.scalars().all()}

        wh_r = await db.execute(
            select(Warehouse).where(Warehouse.id.in_(wh_ids))
        )
        wh_map = {w.id: w for w in wh_r.scalars().all()}

        for row in serial_rows:
            item = items_map.get(row.product_id)
            wh = wh_map.get(row.warehouse_id) if row.warehouse_id else None
            # السعر: avg من serial_items (الحقيقي) وإلا item.sale_price كـ fallback
            avg_sale = float(row.avg_sale_price) if row.avg_sale_price else 0
            avg_cost = float(row.avg_cost_price) if row.avg_cost_price else 0
            # إذا avg_sale = 0 استخدم item.sale_price (fallback للأصناف القديمة)
            effective_sale = avg_sale if avg_sale > 0 else (float(item.sale_price) if item else 0)
            effective_cost = avg_cost if avg_cost > 0 else (float(item.cost_price) if item else 0)
            results.append({
                "stock_id": f"serial_{row.product_id}_{row.warehouse_id}",
                "item_id": row.product_id,
                "item_name": item.name_ar if item else "",
                "item_sku": item.sku if item else "",
                "item_tracking": "serial",
                "category_name": item.category.name_ar if item and item.category else None,
                "warehouse_id": row.warehouse_id,
                "warehouse_name": wh.name_ar if wh else "بدون مستودع",
                "quantity": float(row.qty),
                "reserved_qty": 0.0,
                "available_qty": float(row.qty),
                "reorder_point": float(item.reorder_point) if item else 0,
                "is_low_stock": False,
                "cost_price": effective_cost,
                "sale_price": effective_sale,
                "stock_value": float(row.qty) * effective_cost,
            })

    results.sort(key=lambda x: x["item_name"])
    return results


async def get_item_stock_levels(db: AsyncSession, tenant_id: str, item_id: str):
    """كمية صنف واحد في كل المستودعات"""
    from app.models.inventory import InventoryStock
    from sqlalchemy.orm import selectinload as sil

    item = await get_item(db, tenant_id, item_id)

    if item.tracking_type == "serial":
        # للسيريالات: نجمع من serial_items
        warehouses = await get_warehouses(db, tenant_id)
        result = []
        for wh in warehouses:
            r = await db.execute(
                select(func.count(SerialItem.id)).where(
                    SerialItem.product_id == item_id,
                    SerialItem.warehouse_id == wh.id,
                    SerialItem.status == "in_stock",
                )
            )
            qty = r.scalar() or 0
            if qty > 0:
                result.append({
                    "warehouse_id": wh.id,
                    "warehouse_name": wh.name_ar,
                    "quantity": qty,
                    "available_qty": qty,
                    "is_low_stock": False,
                })
        return result
    else:
        r = await db.execute(
            select(InventoryStock).options(sil(InventoryStock.warehouse))
            .where(InventoryStock.item_id == item_id)
        )
        stocks = r.scalars().all()
        return [
            {
                "warehouse_id": s.warehouse_id,
                "warehouse_name": s.warehouse.name_ar if s.warehouse else "",
                "quantity": float(s.quantity),
                "reserved_qty": float(s.reserved_qty),
                "available_qty": float(s.quantity - s.reserved_qty),
                "reorder_point": float(s.reorder_point),
                "is_low_stock": s.quantity <= s.reorder_point and s.reorder_point > 0,
            }
            for s in stocks
        ]


async def transfer_stock(
    db: AsyncSession, tenant_id: str, user_id: str,
    item_id: str, from_warehouse_id: str, to_warehouse_id: str, quantity: Decimal,
    notes: str | None = None,
):
    """تحويل كمية من مستودع لآخر"""
    item = await get_item(db, tenant_id, item_id)
    if item.tracking_type == "serial":
        raise HTTPException(400, "استخدم تحويل السيريال للمنتجات ذات السيريال")

    from_stock = await _get_or_create_stock(db, tenant_id, item_id, from_warehouse_id)
    if from_stock.quantity < quantity:
        raise HTTPException(400, f"الكمية المتاحة في المستودع {from_stock.quantity} أقل من المطلوب {quantity}")

    to_stock = await _get_or_create_stock(db, tenant_id, item_id, to_warehouse_id)

    from_stock.quantity -= quantity
    from_stock.updated_at = datetime.utcnow()
    to_stock.quantity += quantity
    to_stock.updated_at = datetime.utcnow()

    # حركة مخزون
    db.add(StockMovement(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        product_id=item_id,
        warehouse_id=from_warehouse_id,
        to_warehouse_id=to_warehouse_id,
        movement_type="transfer",
        quantity=quantity,
        unit_cost=item.cost_price,
        notes=notes,
        created_by=user_id,
    ))

    await db.commit()
    return {"message": f"تم تحويل {quantity} وحدة بنجاح", "from_qty": float(from_stock.quantity), "to_qty": float(to_stock.quantity)}


async def transfer_stock_bulk(
    db: AsyncSession, tenant_id: str, user_id: str,
    from_warehouse_id: str, to_warehouse_id: str,
    items: list[dict],  # كل عنصر: {item_id, quantity} أو {item_id, serial_ids: [...]}
    notes: str | None = None,
):
    """
    تحويل أكثر من صنف في عملية واحدة بين مستودعين.
    كل صنف يمكن أن يكون:
      - {item_id, quantity}             ← صنف عادي (كمية)
      - {item_id, serial_ids: [...]}    ← صنف سيريال (قائمة سيريالات)
    يُرجع تقريراً شاملاً بكل الأصناف: ناجح / أخطاء.
    """
    if from_warehouse_id == to_warehouse_id:
        raise HTTPException(400, "المستودع المصدر والهدف لا يمكن أن يكونا نفس المستودع")
    if not items:
        raise HTTPException(400, "يرجى تحديد صنف واحد على الأقل")

    # التحقق من المستودعين
    from_wh = await db.get(Warehouse, from_warehouse_id)
    to_wh = await db.get(Warehouse, to_warehouse_id)
    if not from_wh or from_wh.tenant_id != tenant_id:
        raise HTTPException(404, "المستودع المصدر غير موجود")
    if not to_wh or to_wh.tenant_id != tenant_id:
        raise HTTPException(404, "المستودع الهدف غير موجود")

    results = []
    total_transferred = 0
    total_errors = 0

    for line in items:
        item_id = line.get("item_id")
        serial_ids = line.get("serial_ids")  # قائمة أو None
        qty_raw = line.get("quantity")

        if not item_id:
            results.append({"item_id": None, "success": False, "error": "item_id مطلوب"})
            total_errors += 1
            continue

        try:
            item = await get_item(db, tenant_id, item_id)
        except Exception:
            results.append({"item_id": item_id, "success": False, "error": "الصنف غير موجود"})
            total_errors += 1
            continue

        # ─── صنف سيريال ───────────────────────────────────────────────
        if item.tracking_type == "serial":
            if not serial_ids:
                results.append({
                    "item_id": item_id, "item_name": item.name_ar,
                    "success": False, "error": "يجب تحديد serial_ids للمنتجات ذات السيريال",
                })
                total_errors += 1
                continue

            transferred_serials = []
            line_errors = []
            for sid in serial_ids:
                r = await db.execute(
                    select(SerialItem)
                    .join(InventoryItem, SerialItem.product_id == InventoryItem.id)
                    .where(SerialItem.id == sid, InventoryItem.tenant_id == tenant_id)
                )
                serial = r.scalar_one_or_none()
                if not serial:
                    line_errors.append({"serial_id": sid, "error": "غير موجود"})
                    continue
                if serial.status != "in_stock":
                    line_errors.append({"serial_id": sid, "serial_number": serial.serial_number, "error": f"الوضع: {serial.status}"})
                    continue
                if serial.warehouse_id == to_warehouse_id:
                    line_errors.append({"serial_id": sid, "serial_number": serial.serial_number, "error": "موجود في المستودع الهدف مسبقاً"})
                    continue

                serial.warehouse_id = to_warehouse_id
                db.add(StockMovement(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant_id,
                    product_id=item_id,
                    warehouse_id=from_warehouse_id,
                    to_warehouse_id=to_warehouse_id,
                    movement_type="transfer",
                    quantity=Decimal("1"),
                    unit_cost=serial.cost_price,
                    serial_item_id=serial.id,
                    notes=notes,
                    created_by=user_id,
                ))
                transferred_serials.append({"serial_id": serial.id, "serial_number": serial.serial_number})

            results.append({
                "item_id": item_id, "item_name": item.name_ar,
                "tracking_type": "serial",
                "success": len(transferred_serials) > 0,
                "transferred_count": len(transferred_serials),
                "error_count": len(line_errors),
                "transferred": transferred_serials,
                "errors": line_errors,
            })
            total_transferred += len(transferred_serials)
            if line_errors:
                total_errors += len(line_errors)

        # ─── صنف عادي (كمية) ──────────────────────────────────────────
        else:
            if qty_raw is None:
                results.append({
                    "item_id": item_id, "item_name": item.name_ar,
                    "success": False, "error": "الكمية مطلوبة",
                })
                total_errors += 1
                continue

            quantity = Decimal(str(qty_raw))
            if quantity <= 0:
                results.append({
                    "item_id": item_id, "item_name": item.name_ar,
                    "success": False, "error": "الكمية يجب أن تكون أكبر من صفر",
                })
                total_errors += 1
                continue

            from_stock = await _get_or_create_stock(db, tenant_id, item_id, from_warehouse_id)
            if from_stock.quantity < quantity:
                results.append({
                    "item_id": item_id, "item_name": item.name_ar,
                    "tracking_type": item.tracking_type,
                    "success": False,
                    "error": f"الكمية المتاحة {float(from_stock.quantity)} أقل من المطلوب {float(quantity)}",
                })
                total_errors += 1
                continue

            to_stock = await _get_or_create_stock(db, tenant_id, item_id, to_warehouse_id)
            from_stock.quantity -= quantity
            from_stock.updated_at = datetime.utcnow()
            to_stock.quantity += quantity
            to_stock.updated_at = datetime.utcnow()

            db.add(StockMovement(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                product_id=item_id,
                warehouse_id=from_warehouse_id,
                to_warehouse_id=to_warehouse_id,
                movement_type="transfer",
                quantity=quantity,
                unit_cost=item.cost_price,
                notes=notes,
                created_by=user_id,
            ))

            results.append({
                "item_id": item_id, "item_name": item.name_ar,
                "tracking_type": item.tracking_type,
                "success": True,
                "transferred_count": float(quantity),
            })
            total_transferred += float(quantity)

    # commit واحد لكل العمليات الناجحة
    if any(r.get("success") for r in results):
        await db.commit()

    return {
        "from_warehouse": from_wh.name_ar,
        "to_warehouse": to_wh.name_ar,
        "total_lines": len(items),
        "total_transferred": total_transferred,
        "total_errors": total_errors,
        "notes": notes,
        "results": results,
    }


async def transfer_serials(
    db: AsyncSession, tenant_id: str, user_id: str,
    serial_ids: list[str], to_warehouse_id: str,
    notes: str | None = None,
):
    """
    تحويل سيريالات محددة من مستودع لآخر.
    - يتحقق أن كل سيريال موجود في المخزون وينتمي للـ tenant
    - يُرجع تقرير بالتحويل: ناجح + أخطاء
    """
    if not serial_ids:
        raise HTTPException(400, "يرجى تحديد سيريال واحد على الأقل")

    # التحقق من المستودع الهدف
    to_wh = await db.get(Warehouse, to_warehouse_id)
    if not to_wh or to_wh.tenant_id != tenant_id:
        raise HTTPException(404, "المستودع الهدف غير موجود")

    transferred = []
    errors = []

    for serial_id in serial_ids:
        # جلب السيريال
        r = await db.execute(
            select(SerialItem)
            .join(InventoryItem, SerialItem.product_id == InventoryItem.id)
            .where(
                SerialItem.id == serial_id,
                InventoryItem.tenant_id == tenant_id,
            )
        )
        serial = r.scalar_one_or_none()

        if not serial:
            errors.append({"serial_id": serial_id, "error": "غير موجود"})
            continue

        if serial.status != "in_stock":
            errors.append({"serial_id": serial_id, "serial_number": serial.serial_number,
                           "error": f"الوضع: {serial.status} — يجب أن يكون متاحاً"})
            continue

        if serial.warehouse_id == to_warehouse_id:
            errors.append({"serial_id": serial_id, "serial_number": serial.serial_number,
                           "error": "السيريال موجود في نفس المستودع الهدف"})
            continue

        from_warehouse_id = serial.warehouse_id
        serial.warehouse_id = to_warehouse_id

        # حركة مخزون
        db.add(StockMovement(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            product_id=serial.product_id,
            warehouse_id=from_warehouse_id,
            to_warehouse_id=to_warehouse_id,
            movement_type="transfer",
            quantity=Decimal("1"),
            unit_cost=serial.cost_price,
            serial_item_id=serial.id,
            notes=notes,
            created_by=user_id,
        ))

        transferred.append({
            "serial_id": serial.id,
            "serial_number": serial.serial_number,
            "from_warehouse_id": from_warehouse_id,
            "product_id": serial.product_id,
        })

    if transferred:
        await db.commit()

    return {
        "transferred_count": len(transferred),
        "error_count": len(errors),
        "transferred": transferred,
        "errors": errors,
        "to_warehouse": to_wh.name_ar,
        "notes": notes,
    }


async def validate_serials_in_warehouse(
    db: AsyncSession, tenant_id: str,
    serial_numbers: list[str], warehouse_id: str
) -> dict:
    """
    التحقق من وجود سيريالات في مستودع محدد — يُستخدم عند رفع Excel.
    يُرجع: موجود ✅ / غير موجود ❌ / في مستودع آخر ⚠️
    """
    result = {"found": [], "not_found": [], "wrong_warehouse": []}

    for sn in serial_numbers:
        r = await db.execute(
            select(SerialItem)
            .join(InventoryItem, SerialItem.product_id == InventoryItem.id)
            .where(
                InventoryItem.tenant_id == tenant_id,
                SerialItem.serial_number == sn,
                SerialItem.status == "in_stock",
            )
        )
        serial = r.scalar_one_or_none()

        if not serial:
            result["not_found"].append(sn)
        elif serial.warehouse_id != warehouse_id:
            wh = await db.get(Warehouse, serial.warehouse_id) if serial.warehouse_id else None
            result["wrong_warehouse"].append({
                "serial_number": sn,
                "serial_id": serial.id,
                "actual_warehouse": wh.name_ar if wh else "بدون مستودع",
            })
        else:
            result["found"].append({
                "serial_number": sn,
                "serial_id": serial.id,
            })

    return result


# ─── Stock Count (جرد المخزون) ────────────────────────────────────────

async def create_stock_count(
    db: AsyncSession, tenant_id: str, user_id: str,
    item_id: str, warehouse_id: str,
    counted_qty: Decimal, notes: str | None = None,
):
    """جرد المخزون — تصحيح الكمية الفعلية + حفظ الجلسة"""
    from app.models.inventory import StockCountSession
    item = await get_item(db, tenant_id, item_id)
    if item.tracking_type == "serial":
        raise HTTPException(400, "الجرد للمنتجات بسيريال يتم عبر إدارة السيريالات")

    stock = await _get_or_create_stock(db, tenant_id, item_id, warehouse_id)
    current_qty = stock.quantity
    diff = counted_qty - current_qty

    if diff == 0:
        return {"message": "الكمية مطابقة — لا يوجد فرق", "diff": 0}

    diff_value = diff * item.cost_price

    # تحديث الكمية
    stock.quantity = counted_qty
    stock.updated_at = datetime.utcnow()
    item.quantity_on_hand += diff
    if item.quantity_on_hand < 0:
        item.quantity_on_hand = Decimal("0")

    # حركة مخزون
    db.add(StockMovement(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        product_id=item_id,
        warehouse_id=warehouse_id,
        movement_type="adjustment",
        quantity=diff,
        unit_cost=item.cost_price,
        reference_type="stock_count",
        notes=notes or f"جرد مخزون — الكمية الفعلية: {counted_qty}، الفرق: {diff:+}",
        created_by=user_id,
    ))

    # حفظ جلسة الجرد
    db.add(StockCountSession(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        item_id=item_id,
        warehouse_id=warehouse_id,
        previous_qty=current_qty,
        counted_qty=counted_qty,
        diff_qty=diff,
        diff_value=diff_value,
        notes=notes,
        counted_by=user_id,
        counted_at=datetime.utcnow(),
    ))

    await db.commit()
    return {
        "message": "تم تحديث المخزون بنجاح",
        "item_name": item.name_ar,
        "warehouse_id": warehouse_id,
        "previous_qty": float(current_qty),
        "counted_qty": float(counted_qty),
        "diff": float(diff),
        "diff_value": float(diff_value),
    }


async def get_count_sessions(
    db: AsyncSession, tenant_id: str,
    item_id: str | None = None,
    warehouse_id: str | None = None,
    limit: int = 100,
):
    """جلب سجل جلسات الجرد السابقة"""
    from app.models.inventory import StockCountSession
    from sqlalchemy.orm import selectinload as sil

    q = select(StockCountSession).options(
        sil(StockCountSession.item)
    ).where(StockCountSession.tenant_id == tenant_id)
    if item_id:
        q = q.where(StockCountSession.item_id == item_id)
    if warehouse_id:
        q = q.where(StockCountSession.warehouse_id == warehouse_id)
    q = q.order_by(StockCountSession.counted_at.desc()).limit(limit)
    r = await db.execute(q)
    sessions = r.scalars().all()

    # جلب أسماء المستودعات
    wh_ids = list({s.warehouse_id for s in sessions})
    wh_map: dict = {}
    if wh_ids:
        wr = await db.execute(select(Warehouse).where(Warehouse.id.in_(wh_ids)))
        for w in wr.scalars().all():
            wh_map[w.id] = w.name_ar

    return [
        {
            "id": s.id,
            "item_id": s.item_id,
            "item_name": s.item.name_ar if s.item else "",
            "item_sku": s.item.sku if s.item else "",
            "warehouse_id": s.warehouse_id,
            "warehouse_name": wh_map.get(s.warehouse_id, ""),
            "previous_qty": float(s.previous_qty),
            "counted_qty": float(s.counted_qty),
            "diff_qty": float(s.diff_qty),
            "diff_value": float(s.diff_value),
            "notes": s.notes,
            "counted_at": s.counted_at.isoformat(),
        }
        for s in sessions
    ]


async def get_low_stock_alerts(db: AsyncSession, tenant_id: str):
    """تنبيهات نقطة إعادة الطلب"""
    from app.models.inventory import InventoryStock
    from sqlalchemy.orm import selectinload as sil

    # المنتجات العادية
    r = await db.execute(
        select(InventoryStock).options(
            sil(InventoryStock.item).selectinload(InventoryItem.category),
            sil(InventoryStock.warehouse),
        ).join(InventoryItem, InventoryStock.item_id == InventoryItem.id).where(
            InventoryStock.tenant_id == tenant_id,
            InventoryItem.is_active == True,
            InventoryStock.reorder_point > 0,
            InventoryStock.quantity <= InventoryStock.reorder_point,
        )
    )
    stocks = r.scalars().all()

    # السيريالات المنخفضة (أقل من 3)
    serial_r = await db.execute(
        select(
            InventoryItem.id, InventoryItem.name_ar, InventoryItem.sku,
            func.count(SerialItem.id).label("count")
        ).join(SerialItem, InventoryItem.id == SerialItem.product_id).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active == True,
            InventoryItem.tracking_type == "serial",
            SerialItem.status == "in_stock",
        ).group_by(InventoryItem.id, InventoryItem.name_ar, InventoryItem.sku)
        .having(func.count(SerialItem.id) <= 3)
    )
    low_serials = serial_r.all()

    alerts = []
    for s in stocks:
        alerts.append({
            "type": "quantity",
            "item_id": s.item_id,
            "item_name": s.item.name_ar if s.item else "",
            "item_sku": s.item.sku if s.item else "",
            "category": s.item.category.name_ar if s.item and s.item.category else None,
            "warehouse_name": s.warehouse.name_ar if s.warehouse else "",
            "current_qty": float(s.quantity),
            "reorder_point": float(s.reorder_point),
            "shortage": float(s.reorder_point - s.quantity),
        })
    for row in low_serials:
        alerts.append({
            "type": "serial",
            "item_id": row.id,
            "item_name": row.name_ar,
            "item_sku": row.sku,
            "category": None,
            "warehouse_name": "",
            "current_qty": row.count,
            "reorder_point": 3,
            "shortage": max(0, 3 - row.count),
        })

    return sorted(alerts, key=lambda x: x["shortage"], reverse=True)


async def get_stock_movements(
    db: AsyncSession, tenant_id: str,
    item_id: str | None = None,
    warehouse_id: str | None = None,
    movement_type: str | None = None,
    limit: int = 100,
):
    """سجل حركات المخزون — يشمل السيريالات"""
    from sqlalchemy.orm import selectinload as sil

    q = select(StockMovement).options(
        sil(StockMovement.product)
    ).where(
        StockMovement.tenant_id == tenant_id,
    )
    if item_id:
        q = q.where(StockMovement.product_id == item_id)
    if warehouse_id:
        q = q.where(StockMovement.warehouse_id == warehouse_id)
    if movement_type:
        q = q.where(StockMovement.movement_type == movement_type)
    q = q.order_by(StockMovement.created_at.desc()).limit(limit)
    r = await db.execute(q)
    movements = r.scalars().all()

    # جلب بيانات السيريالات المرتبطة
    serial_ids = [m.serial_item_id for m in movements if m.serial_item_id]
    serial_map: dict = {}
    if serial_ids:
        sr = await db.execute(
            select(SerialItem).where(SerialItem.id.in_(serial_ids))
        )
        for s in sr.scalars().all():
            serial_map[s.id] = s.serial_number

    type_ar = {
        "purchase": "شراء", "sale": "بيع", "return_in": "مرتجع وارد",
        "return_out": "مرتجع صادر", "adjustment": "جرد/تسوية",
        "transfer": "تحويل", "damage": "تلف", "initial": "رصيد افتتاحي",
    }

    rows = []
    for m in movements:
        mt = str(m.movement_type.value) if hasattr(m.movement_type, 'value') else str(m.movement_type)
        serial_number = serial_map.get(m.serial_item_id) if m.serial_item_id else None
        rows.append({
            "id": m.id,
            "item_id": m.product_id,
            "item_name": m.product.name_ar if m.product else "",
            "item_sku": m.product.sku if m.product else "",
            "serial_number": serial_number,
            "movement_type": mt,
            "movement_type_ar": type_ar.get(mt, mt),
            "quantity": float(m.quantity),
            "unit_cost": float(m.unit_cost),
            "total_value": float(abs(m.quantity) * m.unit_cost),
            "warehouse_id": m.warehouse_id,
            "to_warehouse_id": m.to_warehouse_id,
            "reference_type": m.reference_type,
            "reference_id": m.reference_id,
            "notes": m.notes,
            "created_at": m.created_at.isoformat(),
        })
    return rows


# ─── Batch Management (صيدلية فقط) ───────────────────────────────────

async def get_batches(
    db: AsyncSession, tenant_id: str, product_id: str,
    include_empty: bool = False,
) -> list:
    """جلب تشغيلات صنف — مرتبة بتاريخ الانتهاء (FEFO)"""
    item = await get_item(db, tenant_id, product_id)
    if item.tracking_type != "batch":
        raise HTTPException(400, "هذا الصنف لا يستخدم تتبع التشغيلات")

    q = select(BatchItem).where(BatchItem.product_id == product_id)
    if not include_empty:
        q = q.where(BatchItem.quantity > 0)
    q = q.order_by(BatchItem.expiry_date.asc().nullslast())
    r = await db.execute(q)
    batches = r.scalars().all()

    now = datetime.utcnow()
    result = []
    for b in batches:
        days_to_expiry = None
        is_expired = False
        is_near_expiry = False
        if b.expiry_date:
            delta = (b.expiry_date - now).days
            days_to_expiry = delta
            is_expired = delta < 0
            is_near_expiry = 0 <= delta <= 90
        result.append({
            "id": b.id,
            "batch_number": b.batch_number,
            "quantity": float(b.quantity),
            "cost_price": float(b.cost_price),
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "manufacture_date": b.manufacture_date.isoformat() if b.manufacture_date else None,
            "days_to_expiry": days_to_expiry,
            "is_expired": is_expired,
            "is_near_expiry": is_near_expiry,
            "warehouse_id": b.warehouse_id,
            "purchase_bill_id": b.purchase_bill_id,
            "created_at": b.created_at.isoformat(),
        })
    return result


async def add_batch(
    db: AsyncSession, tenant_id: str, product_id: str,
    batch_number: str, quantity: Decimal, cost_price: Decimal,
    expiry_date: str | None = None,
    manufacture_date: str | None = None,
    warehouse_id: str | None = None,
    purchase_bill_id: str | None = None,
    auto_commit: bool = True,
) -> BatchItem:
    """إضافة تشغيلة جديدة للمخزون"""
    item = await get_item(db, tenant_id, product_id)
    if item.tracking_type != "batch":
        raise HTTPException(400, "هذا الصنف لا يستخدم تتبع التشغيلات")

    # إذا ما أُرسل مستودع، استخدم المستودع الرئيسي تلقائياً
    if not warehouse_id:
        warehouse_id = await _get_default_warehouse_id(db, tenant_id)

    # التحقق من عدم تكرار رقم التشغيلة لنفس الصنف
    existing = await db.execute(
        select(BatchItem).where(
            BatchItem.product_id == product_id,
            BatchItem.batch_number == batch_number,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, f"رقم التشغيلة {batch_number} موجود مسبقاً لهذا الصنف")

    batch = BatchItem(
        id=str(uuid.uuid4()),
        product_id=product_id,
        warehouse_id=warehouse_id,
        batch_number=batch_number,
        quantity=quantity,
        cost_price=cost_price,
        expiry_date=datetime.fromisoformat(expiry_date) if expiry_date else None,
        manufacture_date=datetime.fromisoformat(manufacture_date) if manufacture_date else None,
        purchase_bill_id=purchase_bill_id,
    )
    db.add(batch)

    # تحديث الكمية الإجمالية للصنف
    item.quantity_on_hand += quantity
    # تحديث متوسط التكلفة المتحرك
    if item.quantity_on_hand > 0:
        total_val = (item.quantity_on_hand - quantity) * item.cost_price + quantity * cost_price
        item.cost_price = (total_val / item.quantity_on_hand).quantize(Decimal("0.0001"))

    db.add(StockMovement(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        product_id=product_id,
        warehouse_id=warehouse_id,
        movement_type="purchase",
        quantity=quantity,
        unit_cost=cost_price,
        batch_item_id=batch.id,
        reference_type="bill" if purchase_bill_id else "manual",
        reference_id=purchase_bill_id,
    ))

    if auto_commit:
        await db.commit()
        await db.refresh(batch)
    return batch


async def deduct_batch_fefo(
    db: AsyncSession, tenant_id: str, product_id: str,
    quantity: Decimal,
    reference_type: str | None = None,
    reference_id: str | None = None,
    user_id: str | None = None,
) -> list:
    """خصم كمية من التشغيلات — FEFO (First Expired First Out)"""
    item = await get_item(db, tenant_id, product_id)
    if item.tracking_type != "batch":
        raise HTTPException(400, "هذا الصنف لا يستخدم تتبع التشغيلات")

    if item.quantity_on_hand < quantity:
        raise HTTPException(400, f"الكمية المتاحة {item.quantity_on_hand} أقل من المطلوب {quantity}")

    # جلب التشغيلات مرتبة بتاريخ الانتهاء (الأقرب أولاً)
    r = await db.execute(
        select(BatchItem).where(
            BatchItem.product_id == product_id,
            BatchItem.quantity > 0,
        ).order_by(BatchItem.expiry_date.asc().nullslast())
    )
    batches = r.scalars().all()

    remaining = quantity
    deducted = []

    for batch in batches:
        if remaining <= 0:
            break
        deduct_from_batch = min(batch.quantity, remaining)
        batch.quantity -= deduct_from_batch
        remaining -= deduct_from_batch
        deducted.append({
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "quantity": float(deduct_from_batch),
            "expiry_date": batch.expiry_date.isoformat() if batch.expiry_date else None,
        })
        db.add(StockMovement(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            product_id=product_id,
            movement_type="sale",
            quantity=-deduct_from_batch,
            unit_cost=batch.cost_price,
            batch_item_id=batch.id,
            reference_type=reference_type,
            reference_id=reference_id,
            created_by=user_id,
        ))

    item.quantity_on_hand -= quantity
    await db.commit()
    return deducted


async def get_expiry_alerts(
    db: AsyncSession, tenant_id: str, days_ahead: int = 90
) -> dict:
    """تنبيهات انتهاء الصلاحية — للصيدلية فقط"""
    from datetime import timedelta
    now = datetime.utcnow()
    threshold = now + timedelta(days=days_ahead)

    r = await db.execute(
        select(BatchItem).options(
            selectinload(BatchItem.product)
        ).join(
            InventoryItem, BatchItem.product_id == InventoryItem.id
        ).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active == True,
            BatchItem.quantity > 0,
            BatchItem.expiry_date.isnot(None),
            BatchItem.expiry_date <= threshold,
        ).order_by(BatchItem.expiry_date.asc())
    )
    batches = r.scalars().all()

    expired = []
    near_expiry = []

    for b in batches:
        days = (b.expiry_date - now).days
        entry = {
            "batch_id": b.id,
            "batch_number": b.batch_number,
            "product_id": b.product_id,
            "product_name": b.product.name_ar if b.product else "",
            "product_sku": b.product.sku if b.product else "",
            "quantity": float(b.quantity),
            "expiry_date": b.expiry_date.isoformat(),
            "days_to_expiry": days,
            "value": float(b.quantity * b.cost_price),
        }
        if days < 0:
            expired.append(entry)
        else:
            near_expiry.append(entry)

    return {
        "expired": expired,
        "near_expiry": near_expiry,
        "expired_count": len(expired),
        "near_expiry_count": len(near_expiry),
        "expired_value": sum(e["value"] for e in expired),
        "near_expiry_value": sum(e["value"] for e in near_expiry),
    }


async def get_batch_expiry_report(
    db: AsyncSession, tenant_id: str,
    product_id: str | None = None,
    days_ahead: int = 90,
) -> list:
    """تقرير انتهاء الصلاحية التفصيلي"""
    from datetime import timedelta
    now = datetime.utcnow()
    threshold = now + timedelta(days=days_ahead)

    q = select(BatchItem).options(
        selectinload(BatchItem.product)
    ).join(
        InventoryItem, BatchItem.product_id == InventoryItem.id
    ).where(
        InventoryItem.tenant_id == tenant_id,
        InventoryItem.is_active == True,
        BatchItem.quantity > 0,
    )
    if product_id:
        q = q.where(BatchItem.product_id == product_id)
    q = q.order_by(BatchItem.expiry_date.asc().nullslast())

    r = await db.execute(q)
    batches = r.scalars().all()

    rows = []
    for b in batches:
        days = (b.expiry_date - now).days if b.expiry_date else None
        status = "expired" if (days is not None and days < 0) else \
                 "critical" if (days is not None and days <= 30) else \
                 "warning" if (days is not None and days <= 90) else "ok"
        rows.append({
            "batch_id": b.id,
            "batch_number": b.batch_number,
            "product_id": b.product_id,
            "product_name": b.product.name_ar if b.product else "",
            "product_sku": b.product.sku if b.product else "",
            "quantity": float(b.quantity),
            "cost_price": float(b.cost_price),
            "value": float(b.quantity * b.cost_price),
            "expiry_date": b.expiry_date.isoformat() if b.expiry_date else None,
            "manufacture_date": b.manufacture_date.isoformat() if b.manufacture_date else None,
            "days_to_expiry": days,
            "status": status,
        })
    return rows
