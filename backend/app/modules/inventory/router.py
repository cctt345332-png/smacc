from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from decimal import Decimal
from datetime import datetime

from app.core.database import get_db
from app.core.tenant import get_current_user, get_tenant_id, require_role
from app.core.plan_limits import check_plan_limit
from app.core.stocktake_guard import mandatory_stocktake_guard
from app.modules.inventory import service
from app.models.inventory import InventoryItem, InventoryStock, SerialItem

router = APIRouter(prefix="/inventory", tags=["inventory"], dependencies=[Depends(mandatory_stocktake_guard)])


# ─── Mandatory weekly stocktake (الجرد الإلزامي الأسبوعي) ─────────────
@router.get("/mandatory-stocktake/rep/current")
async def mandatory_stocktake_rep_current(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.get_rep_current(db, user["tenant_id"], user["user_id"])


@router.post("/mandatory-stocktake/rep/submit")
async def mandatory_stocktake_rep_submit(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.submit_rep_count(db, user["tenant_id"], user["user_id"], data)


@router.get("/mandatory-stocktake/config")
async def mandatory_stocktake_get_config(user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    config = await ms.get_config(db, user["tenant_id"])
    return ms.serialize_config(config) if config else {"is_enabled": False, "weekday": 4, "start_time": "11:00", "timezone": "Asia/Riyadh", "reminder_minutes": 30}


@router.put("/mandatory-stocktake/config")
async def mandatory_stocktake_save_config(data: dict, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.save_config(db, user["tenant_id"], user["user_id"], data)


@router.post("/mandatory-stocktake/test")
async def mandatory_stocktake_test(user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.create_test_run(db, user["tenant_id"], user["user_id"])


@router.delete("/mandatory-stocktake/test/{run_id}")
async def mandatory_stocktake_cancel_test(run_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.cancel_test_run(db, user["tenant_id"], run_id)


@router.get("/mandatory-stocktake/runs")
async def mandatory_stocktake_runs(status: Optional[str] = None, limit: int = 50, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.list_runs(db, user["tenant_id"], status, limit)


@router.get("/mandatory-stocktake/runs/{run_id}")
async def mandatory_stocktake_run(run_id: str, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.get_run(db, user["tenant_id"], run_id)


@router.post("/mandatory-stocktake/runs/{run_id}/replace-serial")
async def mandatory_stocktake_replace_serial(run_id: str, data: dict, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.replace_stocktake_serial(db, user["tenant_id"], user["user_id"], run_id, data)


@router.post("/mandatory-stocktake/runs/{run_id}/review")
async def mandatory_stocktake_review(run_id: str, data: dict, user=Depends(require_role(["manager", "accountant"])), db: AsyncSession = Depends(get_db)):
    from app.modules.inventory import mandatory_stocktake_service as ms
    return await ms.review_run(db, user["tenant_id"], user["user_id"], run_id, data)


async def _scoped_warehouse_ids(user, db: AsyncSession) -> set[str] | None:
    """نطاق المستودعات المسموح به للمستخدم داخل تطبيق المندوب."""
    role = user.get("role")
    if role == "sales_rep":
        from app.models.reps import SalesRep
        rep = (await db.execute(select(SalesRep).where(SalesRep.user_id == user["user_id"]))).scalar_one_or_none()
        return {rep.warehouse_id} if rep and rep.warehouse_id else set()
    if role == "supervisor":
        from app.models.reps import Supervisor, SupervisorRep, SalesRep
        sup = (await db.execute(select(Supervisor).where(Supervisor.user_id == user["user_id"]))).scalar_one_or_none()
        if not sup:
            return set()
        rows = await db.execute(
            select(SalesRep.warehouse_id)
            .join(SupervisorRep, SupervisorRep.rep_id == SalesRep.id)
            .where(SupervisorRep.supervisor_id == sup.id, SalesRep.warehouse_id.is_not(None))
        )
        return {row[0] for row in rows.all() if row[0]}
    return None


@router.post("/serial-reconciliation")
async def serial_reconciliation(
    apply: bool = Query(False),
    max_invoices: int = Query(5000, ge=1, le=5000),
    invoice_numbers: Optional[str] = Query(None, description="Comma-separated invoice numbers"),
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """معاينة أو إصلاح تطابق فواتير السيريالات المؤكدة مع المخزون."""
    numbers = [value.strip() for value in (invoice_numbers or "").split(",") if value.strip()]
    return await service.reconcile_serial_invoice_stock(
        db,
        user["tenant_id"],
        user["user_id"],
        apply=apply,
        max_invoices=max_invoices,
        invoice_numbers=numbers or None,
    )


# ─── Warehouses ──────────────────────────────────────────────────────
@router.get("/warehouses")
async def list_warehouses(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_warehouses(db, tenant_id)

@router.post("/warehouses", status_code=201)
async def create_warehouse(
    data: dict,
    user=Depends(require_role(["manager","warehouse"])),
    _limit=Depends(check_plan_limit("warehouses")),
    db: AsyncSession = Depends(get_db),
):
    return await service.create_warehouse(db, user["tenant_id"], data)


# ─── Categories ──────────────────────────────────────────────────────
@router.get("/categories")
async def list_categories(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_categories(db, tenant_id)

@router.post("/categories", status_code=201)
async def create_category(data: dict, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.create_category(db, tenant_id, data)


# ─── Items ───────────────────────────────────────────────────────────
@router.get("/items")
async def list_items(
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    tracking_type: Optional[str] = None,
    low_stock: bool = False,
    warehouse_id: Optional[str] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    items = await service.get_items(db, tenant_id, search, category_id, tracking_type, low_stock)
    serial_counts: dict[str, int] = {}
    serial_item_ids = [item.id for item in items if getattr(item.tracking_type, "value", item.tracking_type) == "serial"]
    if serial_item_ids:
        serial_rows = await db.execute(
            select(SerialItem.product_id, func.count(SerialItem.id).label("count"))
            .where(
                SerialItem.product_id.in_(serial_item_ids),
                SerialItem.status == "in_stock",
                *( [SerialItem.warehouse_id == warehouse_id] if warehouse_id else [] ),
            )
            .group_by(SerialItem.product_id)
        )
        serial_counts = {row.product_id: int(row.count) for row in serial_rows}

    quantity_by_item: dict[str, float] = {}
    if warehouse_id:
        stock_rows = await db.execute(
            select(InventoryStock.item_id, InventoryStock.quantity).where(
                InventoryStock.tenant_id == tenant_id,
                InventoryStock.warehouse_id == warehouse_id,
            )
        )
        quantity_by_item = {row.item_id: float(row.quantity or 0) for row in stock_rows}

    return [
        {
            "id": item.id,
            "name_ar": item.name_ar,
            "name_en": item.name_en,
            "sku": item.sku,
            "barcode": item.barcode,
            "tracking_type": getattr(item.tracking_type, "value", item.tracking_type),
            "unit_type": getattr(item.unit_type, "value", item.unit_type),
            "sale_price": float(item.sale_price or 0),
            "cost_price": float(item.cost_price or 0),
            "vat_rate": float(item.vat_rate or 0),
            "quantity_on_hand": float(serial_counts.get(item.id, 0) if getattr(item.tracking_type, "value", item.tracking_type) == "serial" else (quantity_by_item.get(item.id, 0) if warehouse_id else item.quantity_on_hand or 0)),
            "serial_count": serial_counts.get(item.id, 0) if getattr(item.tracking_type, "value", item.tracking_type) == "serial" else None,
            "reorder_point": float(item.reorder_point or 0),
            "default_warehouse_id": item.default_warehouse_id,
            "pos_enabled": item.pos_enabled,
            "store_enabled": item.store_enabled,
            "is_active": item.is_active,
            "color": item.color,
            "storage": item.storage,
            "category": {"id": item.category.id, "name_ar": item.category.name_ar} if item.category else None,
        }
        for item in items
    ]

@router.get("/items/summary")
async def stock_summary(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_stock_summary(db, tenant_id)


@router.get("/items/picker")
async def items_for_picker(
    search: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """أصناف للـ picker — المندوب يرى مستودعه فقط تلقائياً"""
    tenant_id = user["tenant_id"]
    await service.ensure_quantity_stock_records(db, tenant_id)
    effective_wh = warehouse_id

    # المندوب → مستودعه فقط
    if user["role"] == "sales_rep":
        from app.models.reps import SalesRep
        from sqlalchemy import select as _sel
        rep_r = await db.execute(_sel(SalesRep).where(SalesRep.user_id == user["user_id"]))
        rep = rep_r.scalar_one_or_none()
        if rep:
            effective_wh = rep.warehouse_id

    if effective_wh:
        from app.models.inventory import InventoryStock, SerialItem
        from sqlalchemy.orm import selectinload
        from sqlalchemy import select as _select, func as _func

        # جلب الأصناف العادية من inventory_stock
        stock_r = await db.execute(
            _select(InventoryStock).where(
                InventoryStock.tenant_id == tenant_id,
                InventoryStock.warehouse_id == effective_wh,
                InventoryStock.quantity > 0,
            )
        )
        stocks = stock_r.scalars().all()
        item_ids_qty = {s.item_id: s.quantity for s in stocks}

        # جلب الأصناف من serial_items. السعر يأتي من بطاقة الصنف الموحدة،
        # لا من متوسط السيريالات حتى يبقى ثابتاً لكل جهاز من الصنف نفسه.
        serial_count_r = await db.execute(
            _select(
                SerialItem.product_id,
                _func.count(SerialItem.id).label("cnt"),
            )
            .join(InventoryItem, SerialItem.product_id == InventoryItem.id)
            .where(
                InventoryItem.tenant_id == tenant_id,
                SerialItem.warehouse_id == effective_wh,
                SerialItem.status == "in_stock",
            )
            .group_by(SerialItem.product_id)
        )
        item_ids_serial = {}
        for row in serial_count_r.mappings().all():
            item_ids_serial[row["product_id"]] = row["cnt"]

        # دمج الاثنين
        all_item_ids = list(set(list(item_ids_qty.keys()) + list(item_ids_serial.keys())))
        if not all_item_ids:
            return []

        q = _select(InventoryItem).options(selectinload(InventoryItem.category)).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.id.in_(all_item_ids),
            InventoryItem.is_active == True,
        )
        if search:
            q = q.where(
                InventoryItem.name_ar.ilike(f"%{search}%") |
                InventoryItem.sku.ilike(f"%{search}%")
            )
        r = await db.execute(q)
        items = r.scalars().all()
        return [
            {
                "id": item.id,
                "name_ar": item.name_ar,
                "name_en": item.name_en,
                "sku": item.sku,
                "barcode": item.barcode,
                "tracking_type": item.tracking_type,
                "unit_type": item.unit_type,
                # بطاقة الصنف هي مصدر السعر الموحد للسيريالات وغيرها.
                "sale_price": float(item.sale_price),
                "vat_rate": float(item.vat_rate),
                "quantity_on_hand": float(
                    item_ids_serial.get(item.id, 0) if item.tracking_type == "serial"
                    else item_ids_qty.get(item.id, 0)
                ),
                "reorder_point": float(item.reorder_point),
                "color": item.color,
                "storage": item.storage,
                "category": {"id": item.category.id, "name_ar": item.category.name_ar} if item.category else None,
            }
            for item in items
        ]

    items = await service.get_items(db, tenant_id, search=search)
    return [
        {
            "id": item.id,
            "name_ar": item.name_ar,
            "name_en": item.name_en,
            "sku": item.sku,
            "barcode": item.barcode,
            "tracking_type": item.tracking_type,
            "unit_type": item.unit_type,
            "sale_price": float(item.sale_price),
            "vat_rate": float(item.vat_rate),
            "quantity_on_hand": float(item.quantity_on_hand),
            "reorder_point": float(item.reorder_point),
            "color": item.color,
            "storage": item.storage,
            "category": {"id": item.category.id, "name_ar": item.category.name_ar} if item.category else None,
        }
        for item in items
    ]

@router.get("/items/{item_id}")
async def get_item(item_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_item(db, tenant_id, item_id)

@router.post("/items", status_code=201)
async def create_item(data: dict, user=Depends(require_role(["manager","warehouse"])), db: AsyncSession = Depends(get_db)):
    return await service.create_item(db, user["tenant_id"], data)

@router.patch("/items/{item_id}")
async def update_item(item_id: str, data: dict, user=Depends(require_role(["manager","warehouse"])), db: AsyncSession = Depends(get_db)):
    return await service.update_item(db, user["tenant_id"], item_id, data)

@router.delete("/items/{item_id}")
async def delete_item(item_id: str, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    return await service.delete_item(db, user["tenant_id"], item_id)


# ─── Serial Items ─────────────────────────────────────────────────────
@router.get("/items/{product_id}/serials")
async def list_serials(
    product_id: str,
    status: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_serials(db, tenant_id, product_id, status, warehouse_id)

@router.post("/items/{product_id}/serials", status_code=201)
async def add_serial(product_id: str, data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.add_serial(
        db, user["tenant_id"], product_id,
        serial_number=data["serial_number"],
        condition=data.get("condition", "new"),
        cost_price=Decimal(str(data["cost_price"])),
        sale_price=Decimal(str(data["sale_price"])) if data.get("sale_price") else None,
        warehouse_id=data.get("warehouse_id"),
        purchase_bill_id=data.get("purchase_bill_id"),
        notes=data.get("notes"),
        serial_classification=data.get("serial_classification", "sale"),
        classification_reference=data.get("classification_reference"),
        custodian_rep_id=data.get("custodian_rep_id"),
        demo_terminal_id=data.get("demo_terminal_id"),
    )

@router.post("/items/{product_id}/serials/bulk", status_code=201)
async def add_serials_bulk(product_id: str, data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """إضافة سيريالات مجمعة"""
    results = []
    errors = []
    for s in data.get("serials", []):
        try:
            result = await service.add_serial(
                db, user["tenant_id"], product_id,
                serial_number=s["serial_number"],
                condition=s.get("condition", data.get("condition", "new")),
                cost_price=Decimal(str(s.get("cost_price") or data.get("cost_price") or 0)),
                sale_price=Decimal(str(s.get("sale_price") or data.get("sale_price"))) if (s.get("sale_price") or data.get("sale_price")) else None,
                warehouse_id=data.get("warehouse_id"),
                notes=s.get("notes"),
                serial_classification=s.get("serial_classification", data.get("serial_classification", "sale")),
                classification_reference=s.get("classification_reference", data.get("classification_reference")),
                custodian_rep_id=s.get("custodian_rep_id", data.get("custodian_rep_id")),
                demo_terminal_id=s.get("demo_terminal_id", data.get("demo_terminal_id")),
            )
            results.append({"serial_number": s["serial_number"], "status": "added", "id": result.id})
        except Exception as e:
            errors.append({"serial_number": s["serial_number"], "error": str(e)})
    return {"added": len(results), "errors": errors, "results": results}

@router.post("/serials/{serial_id}/sell")
async def sell_serial(serial_id: str, data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.sell_serial(
        db, user["tenant_id"], serial_id,
        sale_price=Decimal(str(data["sale_price"])),
        invoice_id=data.get("invoice_id"),
    )

@router.get("/serials/search")
async def search_serial(
    q: str,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """بحث بالسيريال — يرجع المنتج الرئيسي مع بيانات السيريال"""
    from sqlalchemy import select as sa_select
    from sqlalchemy.orm import selectinload
    from app.models.inventory import SerialItem, InventoryItem
    r = await db.execute(
        sa_select(SerialItem).options(selectinload(SerialItem.product))
        .join(InventoryItem, SerialItem.product_id == InventoryItem.id)
        .where(
            InventoryItem.tenant_id == tenant_id,
            SerialItem.serial_number.ilike(f"%{q}%"),
        ).limit(20)
    )
    serials = r.scalars().all()
    return [
        {
            "serial_id": s.id,
            "serial_number": s.serial_number,
            "condition": s.condition,
            "status": s.status,
            "serial_classification": s.serial_classification,
            "classification_reference": s.classification_reference,
            "custodian_rep_id": s.custodian_rep_id,
            "demo_terminal_id": s.demo_terminal_id,
            "cost_price": float(s.cost_price),
            "sale_price": float(s.product.sale_price) if s.product and s.product.sale_price else (float(s.sale_price) if s.sale_price else None),
            "product_id": s.product_id,
            "product_name": s.product.name_ar if s.product else "",
            "product_sku": s.product.sku if s.product else "",
            "product_color": s.product.color if s.product else None,
            "product_storage": s.product.storage if s.product else None,
        }
        for s in serials
    ]

@router.patch("/serials/{serial_id}")
async def update_serial(serial_id: str, data: dict, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    """تعديل سيريال — للمدير فقط مع التحقق من المستأجر."""
    return await service.update_serial(db, user["tenant_id"], serial_id, data)

@router.delete("/serials/{serial_id}", status_code=204)
async def delete_serial(serial_id: str, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    """حذف سيريال غير مستخدم — للمدير فقط."""
    return await service.delete_serial(db, user["tenant_id"], serial_id)

@router.post("/serials/bulk-update")
async def bulk_update_serials(data: dict, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    """تعديل مجموعة سيريالات — للمدير فقط."""
    return await service.update_serials_bulk(
        db, user["tenant_id"], data.get("serial_ids", []), data.get("changes", data)
    )

@router.post("/serials/bulk-delete")
async def bulk_delete_serials(data: dict, user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db)):
    """حذف مجموعة سيريالات متاحة وغير مرتبطة بحركات — للمدير فقط."""
    return await service.delete_serials_bulk(
        db, user["tenant_id"], data.get("serial_ids", [])
    )

@router.get("/items/{product_id}/available-serials")
async def available_serials_for_invoice(
    product_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """جلب السيريالات المتاحة — المندوب يرى مستودعه فقط، المدير يرى المستودع الرئيسي فقط"""
    from sqlalchemy import select as sa_select
    from app.models.inventory import SerialItem

    tenant_id = user["tenant_id"]
    item = await service.get_item(db, tenant_id, product_id)
    warehouse_filter = None

    if user["role"] == "sales_rep":
        # المندوب → مستودعه فقط
        from app.models.reps import SalesRep
        rep_r = await db.execute(sa_select(SalesRep).where(SalesRep.user_id == user["user_id"]))
        rep = rep_r.scalar_one_or_none()
        if rep:
            warehouse_filter = rep.warehouse_id
    else:
        # المدير/المحاسب → يستثني مستودعات المناديب (يجلب من المستودع الرئيسي فقط)
        from app.models.reps import SalesRep
        from app.models.inventory import Warehouse
        rep_wh_r = await db.execute(
            sa_select(SalesRep.warehouse_id).where(SalesRep.tenant_id == tenant_id)
        )
        rep_wh_ids = [row[0] for row in rep_wh_r.all()]

        # جلب المستودع الرئيسي
        main_wh_r = await db.execute(
            sa_select(Warehouse).where(
                Warehouse.tenant_id == tenant_id,
                Warehouse.is_default == True,
            )
        )
        main_wh = main_wh_r.scalar_one_or_none()
        if main_wh:
            warehouse_filter = main_wh.id

    q = sa_select(SerialItem).where(
        SerialItem.product_id == product_id,
        SerialItem.status == "in_stock",
        SerialItem.serial_classification == "sale",
    )
    if warehouse_filter:
        q = q.where(SerialItem.warehouse_id == warehouse_filter)

    q = q.order_by(SerialItem.created_at.desc())
    r = await db.execute(q)
    serials = r.scalars().all()
    return [
        {
            "id": s.id,
            "serial_number": s.serial_number,
            "condition": s.condition,
            "cost_price": float(s.cost_price),
            "serial_classification": s.serial_classification,
            "classification_reference": s.classification_reference,
            "custodian_rep_id": s.custodian_rep_id,
            "demo_terminal_id": s.demo_terminal_id,
            "sale_price": float(item.sale_price) if item.sale_price else (float(s.sale_price) if s.sale_price else None),
            "warehouse_id": s.warehouse_id,
        }
        for s in serials
    ]


# ─── Stock Movements ─────────────────────────────────────────────────
@router.post("/items/{product_id}/add-stock", status_code=201)
async def add_stock(product_id: str, data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.add_stock(
        db, user["tenant_id"], product_id,
        quantity=Decimal(str(data["quantity"])),
        unit_cost=Decimal(str(data.get("unit_cost", 0))),
        warehouse_id=data.get("warehouse_id"),
        reference_type=data.get("reference_type"),
        reference_id=data.get("reference_id"),
        user_id=user["user_id"],
    )

@router.post("/items/{product_id}/deduct-stock", status_code=201)
async def deduct_stock(product_id: str, data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.deduct_stock(
        db, user["tenant_id"], product_id,
        quantity=Decimal(str(data["quantity"])),
        warehouse_id=data.get("warehouse_id"),
        reference_type=data.get("reference_type"),
        reference_id=data.get("reference_id"),
        user_id=user["user_id"],
    )


@router.post("/stock-documents", status_code=201)
async def create_stock_document(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """سند إدخال أو إخراج مخزني متعدد الأصناف مستقل عن الفواتير."""
    return await service.create_stock_document(db, user["tenant_id"], user["user_id"], data)


@router.get("/stock-documents")
async def list_stock_documents(
    direction: Optional[str] = None,
    limit: int = 100,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_stock_documents(db, user["tenant_id"], direction, limit)


@router.get("/stock-documents/{document_id}")
async def get_stock_document(document_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.get_stock_document(db, user["tenant_id"], document_id)


# ─── Reports ─────────────────────────────────────────────────────────
@router.get("/reports/stock-value")
async def stock_value_report(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_stock_value_report(db, tenant_id)

# ─── Stock by Warehouse ───────────────────────────────────────────────
@router.get("/stock")
async def stock_by_warehouse(
    warehouse_id: Optional[str] = None,
    rep_id: Optional[str] = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = await _scoped_warehouse_ids(user, db)
    if rep_id:
        from app.models.reps import SalesRep, SupervisorRep, Supervisor
        rep_query = select(SalesRep).where(
            SalesRep.id == rep_id,
            SalesRep.tenant_id == user["tenant_id"],
        )
        if user.get("role") == "supervisor":
            rep_query = rep_query.join(SupervisorRep, SupervisorRep.rep_id == SalesRep.id).join(
                Supervisor, Supervisor.id == SupervisorRep.supervisor_id
            ).where(Supervisor.user_id == user["user_id"])
        rep = (await db.execute(rep_query)).scalar_one_or_none()
        if not rep:
            raise HTTPException(403, "لا تملك صلاحية عرض مخزون هذا المندوب")
        if warehouse_id and warehouse_id != rep.warehouse_id:
            raise HTTPException(400, "المستودع لا يطابق مستودع المندوب")
        warehouse_id = rep.warehouse_id
    if allowed is None:
        return await service.get_stock_by_warehouse(db, user["tenant_id"], warehouse_id)
    if warehouse_id and warehouse_id not in allowed:
        raise HTTPException(403, "لا تملك صلاحية الوصول إلى هذا المستودع")
    rows = []
    for scoped_id in ([warehouse_id] if warehouse_id else sorted(allowed)):
        rows.extend(await service.get_stock_by_warehouse(db, user["tenant_id"], scoped_id))
    return rows

@router.get("/items/{item_id}/stock-levels")
async def item_stock_levels(item_id: str, tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_item_stock_levels(db, tenant_id, item_id)

@router.post("/stock/transfer")
async def transfer_stock(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from decimal import Decimal
    return await service.transfer_stock(
        db, user["tenant_id"], user["user_id"],
        item_id=data["item_id"],
        from_warehouse_id=data["from_warehouse_id"],
        to_warehouse_id=data["to_warehouse_id"],
        quantity=Decimal(str(data["quantity"])),
        notes=data.get("notes"),
    )


@router.post("/stock/transfer-serials")
async def transfer_serials(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """تحويل سيريالات محددة بين مستودعين"""
    return await service.transfer_serials(
        db, user["tenant_id"], user["user_id"],
        serial_ids=data["serial_ids"],
        to_warehouse_id=data["to_warehouse_id"],
        notes=data.get("notes"),
    )


@router.post("/stock/transfer-bulk")
async def transfer_stock_bulk(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """تحويل أكثر من صنف في عملية واحدة بين مستودعين"""
    return await service.transfer_stock_bulk(
        db, user["tenant_id"], user["user_id"],
        from_warehouse_id=data["from_warehouse_id"],
        to_warehouse_id=data["to_warehouse_id"],
        items=data["items"],  # list of {item_id, quantity} or {item_id, serial_ids}
        notes=data.get("notes"),
    )


@router.get("/serials/by-warehouse")
async def serials_by_warehouse(
    warehouse_id: str,
    product_id: Optional[str] = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """جلب السيريالات المتاحة في مستودع محدد"""
    allowed = await _scoped_warehouse_ids(user, db)
    if allowed is not None and warehouse_id not in allowed:
        raise HTTPException(403, "لا تملك صلاحية عرض سيريالات هذا المستودع")
    from sqlalchemy import select as _select
    from sqlalchemy.orm import selectinload as sil
    from app.models.inventory import SerialItem as SI, InventoryItem as II
    q = _select(SI).options(sil(SI.product)).join(
        II, SI.product_id == II.id
    ).where(
        II.tenant_id == user["tenant_id"],
        SI.warehouse_id == warehouse_id,
        SI.status == "in_stock",
    )
    if product_id:
        q = q.where(SI.product_id == product_id)
    q = q.order_by(SI.product_id, SI.serial_number)
    r = await db.execute(q)
    serials = r.scalars().all()
    return [
        {
            "id": s.id,
            "serial_number": s.serial_number,
            "product_id": s.product_id,
            "product_name": s.product.name_ar if s.product else "",
            "condition": s.condition,
            "serial_classification": s.serial_classification,
            "classification_reference": s.classification_reference,
            "cost_price": float(s.cost_price),
            "sale_price": float(s.product.sale_price) if s.product and s.product.sale_price else (float(s.sale_price) if s.sale_price else None),
        }
        for s in serials
    ]


@router.post("/stock/validate-serials")
async def validate_serials(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """التحقق من وجود سيريالات في مستودع — للتحقق قبل التحويل"""
    return await service.validate_serials_in_warehouse(
        db, user["tenant_id"],
        serial_numbers=data["serial_numbers"],
        warehouse_id=data["warehouse_id"],
    )

@router.get("/movements")
async def list_movements(
    item_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    limit: int = 100,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_stock_movements(db, tenant_id, item_id, warehouse_id, movement_type, limit)

@router.post("/stock-count", status_code=201)
async def stock_count(data: dict, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from decimal import Decimal
    allowed = await _scoped_warehouse_ids(user, db)
    if allowed is not None and data["warehouse_id"] not in allowed:
        raise HTTPException(403, "لا تملك صلاحية جرد هذا المستودع")
    return await service.create_stock_count(
        db, user["tenant_id"], user["user_id"],
        item_id=data["item_id"],
        warehouse_id=data["warehouse_id"],
        counted_qty=Decimal(str(data["counted_qty"])),
        notes=data.get("notes"),
    )

@router.get("/stock-count/history")
async def count_history(
    item_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    limit: int = 100,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    allowed = await _scoped_warehouse_ids(user, db)
    if allowed is None:
        return await service.get_count_sessions(db, user["tenant_id"], item_id, warehouse_id, limit)
    if warehouse_id and warehouse_id not in allowed:
        raise HTTPException(403, "لا تملك صلاحية عرض جرد هذا المستودع")
    rows = []
    for scoped_id in ([warehouse_id] if warehouse_id else sorted(allowed)):
        rows.extend(await service.get_count_sessions(db, user["tenant_id"], item_id, scoped_id, limit))
    return sorted(rows, key=lambda x: x.get("counted_at", ""), reverse=True)[:limit]

@router.get("/alerts/low-stock")
async def low_stock_alerts(tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db)):
    return await service.get_low_stock_alerts(db, tenant_id)

@router.get("/reports/serial-movements")
async def serial_movements_report(
    warehouse_id: Optional[str] = None,
    bill_id: Optional[str] = None,
    product_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    serial_status: Optional[str] = None,
    serial_number: Optional[str] = None,
    invoice_number: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 2000,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_serial_movements_report(
        db, tenant_id, warehouse_id, bill_id, product_id, movement_type,
        serial_status, serial_number, invoice_number, from_date, to_date, limit,
    )

@router.get("/reports/serial-profit")
async def serial_profit_report(
    product_id: Optional[str] = None,
    invoice_id: Optional[str] = None,
    rep_id: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    return await service.get_serial_profit_report(
        db, tenant_id, product_id, invoice_id, rep_id, from_date, to_date
    )

# ─── Batch Management (صيدلية فقط) ───────────────────────────────────

@router.get("/items/{product_id}/batches")
async def list_batches(
    product_id: str,
    include_empty: bool = False,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """جلب تشغيلات صنف — للصيدلية فقط"""
    return await service.get_batches(db, tenant_id, product_id, include_empty)


@router.post("/items/{product_id}/batches", status_code=201)
async def add_batch(
    product_id: str,
    data: dict,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """إضافة تشغيلة جديدة — عند استلام شحنة"""
    return await service.add_batch(
        db, user["tenant_id"], product_id,
        batch_number=data["batch_number"],
        quantity=Decimal(str(data["quantity"])),
        cost_price=Decimal(str(data["cost_price"])),
        expiry_date=data.get("expiry_date"),
        manufacture_date=data.get("manufacture_date"),
        warehouse_id=data.get("warehouse_id"),
        purchase_bill_id=data.get("purchase_bill_id"),
    )


@router.get("/alerts/expiry")
async def expiry_alerts(
    days_ahead: int = 90,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """تنبيهات انتهاء الصلاحية — للصيدلية فقط"""
    return await service.get_expiry_alerts(db, tenant_id, days_ahead)


@router.get("/reports/batch-expiry")
async def batch_expiry_report(
    product_id: Optional[str] = None,
    days_ahead: int = 90,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """تقرير انتهاء الصلاحية"""
    return await service.get_batch_expiry_report(db, tenant_id, product_id, days_ahead)


# ─── Variants (ملابس) ────────────────────────────────────────────────

@router.get("/items/{product_id}/variants")
async def list_variants(
    product_id: str,
    tenant_id=Depends(get_tenant_id),
    db: AsyncSession = Depends(get_db),
):
    """جلب متغيرات صنف"""
    from app.modules.inventory.options_service import get_variants
    return await get_variants(db, tenant_id, product_id)


@router.post("/items/{product_id}/variants", status_code=201)
async def create_variant(
    product_id: str, data: dict,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """إنشاء متغير جديد"""
    from app.modules.inventory.options_service import create_variant as _create
    return await _create(db, tenant_id, product_id, data)


@router.put("/variants/{variant_id}")
async def update_variant(
    variant_id: str, data: dict,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """تعديل متغير"""
    from app.modules.inventory.options_service import update_variant as _update
    return await _update(db, tenant_id, variant_id, data)


@router.delete("/variants/{variant_id}")
async def delete_variant(
    variant_id: str,
    user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db),
):
    """حذف متغير — للمدير فقط."""
    from app.modules.inventory.options_service import delete_variant as _delete
    await _delete(db, user["tenant_id"], variant_id)
    return {"message": "تم الحذف"}


# ─── Option Groups (محاور التخصيص) ───────────────────────────────────

@router.get("/items/{product_id}/options")
async def list_option_groups(
    product_id: str,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """جلب محاور التخصيص مع قيمها"""
    from app.modules.inventory.options_service import get_option_groups
    return await get_option_groups(db, tenant_id, product_id)


@router.post("/items/{product_id}/options", status_code=201)
async def create_option_group(
    product_id: str, data: dict,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """إنشاء محور تخصيص جديد (مع قيمه اختياريًا)"""
    from app.modules.inventory.options_service import create_option_group as _create
    return await _create(db, tenant_id, product_id, data)


@router.put("/options/groups/{group_id}")
async def update_option_group(
    group_id: str, data: dict,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """تعديل محور تخصيص"""
    from app.modules.inventory.options_service import update_option_group as _update
    return await _update(db, tenant_id, group_id, data)


@router.delete("/options/groups/{group_id}")
async def delete_option_group(
    group_id: str,
    user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db),
):
    """حذف محور تخصيص وكل قيمه — للمدير فقط."""
    from app.modules.inventory.options_service import delete_option_group as _delete
    await _delete(db, user["tenant_id"], group_id)
    return {"message": "تم الحذف"}


@router.post("/options/groups/{group_id}/values", status_code=201)
async def add_option_value(
    group_id: str, data: dict,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """إضافة قيمة لمحور تخصيص"""
    from app.modules.inventory.options_service import add_option
    return await add_option(db, tenant_id, group_id, data)


@router.put("/options/values/{option_id}")
async def update_option_value(
    option_id: str, data: dict,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """تعديل قيمة تخصيص"""
    from app.modules.inventory.options_service import update_option
    return await update_option(db, tenant_id, option_id, data)


@router.delete("/options/values/{option_id}")
async def delete_option_value(
    option_id: str,
    user=Depends(require_role(["manager"])), db: AsyncSession = Depends(get_db),
):
    """حذف قيمة تخصيص — للمدير فقط."""
    from app.modules.inventory.options_service import delete_option
    await delete_option(db, user["tenant_id"], option_id)
    return {"message": "تم الحذف"}


@router.post("/items/{product_id}/options/bulk-variants", status_code=201)
async def bulk_create_variants(
    product_id: str, data: dict,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """
    إنشاء كل التركيبات الممكنة تلقائياً من المحاور.
    data: {"groups": [{"name_ar": "اللون", "options": [...]}, ...]}
    """
    from app.modules.inventory.options_service import bulk_create_variants as _bulk
    return await _bulk(db, tenant_id, product_id, data.get("groups", []))


@router.get("/items/{product_id}/options/stock-report")
async def get_variant_stock_report(
    product_id: str,
    tenant_id=Depends(get_tenant_id), db: AsyncSession = Depends(get_db),
):
    """تقرير المخزون مع تفصيل كل متغير — للمدير والعميل"""
    from app.modules.inventory.options_service import get_variant_stock_report as _report
    return await _report(db, tenant_id, product_id)


# ─── Fix Serial Item Sale Prices ────────────────────────────────────────────
@router.post("/fix-serial-sale-prices", status_code=200)
async def fix_serial_sale_prices(
    user=Depends(require_role(["manager"])),
    db: AsyncSession = Depends(get_db),
):
    """
    يُحدّث سعر السيريالات المتاحة من سعر البيع الموحد في بطاقة المادة.
    لا يلمس أسعار السيريالات المباعة أو أسعار الفواتير التاريخية.
    """
    from app.models.inventory import InventoryItem, SerialItem
    from sqlalchemy import select

    tenant_id = user["tenant_id"]

    # بطاقة المادة هي المصدر الصحيح؛ لا نأخذ سعرًا قديمًا من سيريال.
    items_r = await db.execute(
        select(InventoryItem).where(
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.tracking_type == "serial",
            InventoryItem.sale_price > 0,
        )
    )
    items = items_r.scalars().all()

    updated = []
    for item in items:
        serial_r = await db.execute(
            select(SerialItem).where(
                SerialItem.product_id == item.id,
                SerialItem.status == "in_stock",
            )
        )
        serials = serial_r.scalars().all()
        changed = 0
        for serial in serials:
            if serial.sale_price != item.sale_price:
                serial.sale_price = item.sale_price
                changed += 1
        if changed:
            updated.append({"item_id": item.id, "name": item.name_ar, "sale_price": float(item.sale_price), "serials_updated": changed})

    await db.commit()
    return {"updated": len(updated), "items": updated}
