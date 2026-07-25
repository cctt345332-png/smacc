"""
راوتر المناديب
- /reps              → إدارة المناديب (للمدير والمحاسب)
- /reps/me/*         → واجهة المندوب الحالي (للمندوب نفسه)
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import get_current_user, require_role
from app.modules.reps import service

router = APIRouter(prefix="/reps", tags=["reps"])


# ══════════════════════════════════════════════════════════════════
# واجهة المندوب نفسه — يجب أن تكون قبل routes /{rep_id}
# ══════════════════════════════════════════════════════════════════

@router.get("/me/profile")
async def my_profile(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """بيانات المندوب الحالي + مستودعه"""
    rep = await service.get_rep_by_user(db, user["user_id"])
    if not rep:
        from fastapi import HTTPException
        raise HTTPException(403, "هذا الحساب ليس مندوباً")
    return await service.get_rep(db, user["tenant_id"], rep.id)


@router.get("/me/stock")
async def my_stock(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """مخزون المندوب الحالي"""
    return await service.get_my_stock(db, user["tenant_id"], user["user_id"])


@router.get("/me/invoices")
async def my_invoices(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """فواتير المندوب الحالي"""
    return await service.get_my_invoices(db, user["tenant_id"], user["user_id"])


@router.post("/me/invoices/{invoice_id}/submit")
async def my_submit_invoice(
    invoice_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """المندوب يقدّم فاتورته للمحاسب"""
    from app.modules.sales.service import submit_invoice
    return await submit_invoice(db, user["tenant_id"], user["user_id"], invoice_id)


@router.get("/me/payments")
async def my_payments(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """سندات القبض للمندوب الحالي"""
    return await service.get_my_payments(db, user["tenant_id"], user["user_id"])


@router.get("/me/summary")
async def my_summary(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ملخص أداء المندوب الحالي"""
    rep = await service.get_rep_by_user(db, user["user_id"])
    if not rep:
        from fastapi import HTTPException
        raise HTTPException(403, "هذا الحساب ليس مندوباً")
    return await service.get_rep_summary(db, user["tenant_id"], rep.id)


@router.get("/me/transfers")
async def my_transfers(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """مناقلات المندوب الحالي"""
    rep = await service.get_rep_by_user(db, user["user_id"])
    if not rep:
        from fastapi import HTTPException
        raise HTTPException(403, "هذا الحساب ليس مندوباً")
    from app.modules.reps.router import rep_transfers
    class FakeUser:
        def __getitem__(self, k):
            return {"user_id": user["user_id"], "tenant_id": user["tenant_id"], "role": "sales_rep"}[k]
    return await rep_transfers(rep.id, FakeUser(), db)


# ══════════════════════════════════════════════════════════════════
# إدارة المناديب — للمدير فقط
# ══════════════════════════════════════════════════════════════════

@router.get("")
async def list_reps(
    user=Depends(require_role(["manager", "accountant", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    """قائمة المناديب"""
    return await service.get_reps(db, user["tenant_id"])


@router.post("", status_code=201)
async def create_rep(
    data: dict,
    user=Depends(require_role(["manager"])),
    db: AsyncSession = Depends(get_db),
):
    """إنشاء مندوب جديد (مستخدم + مستودع + سجل مندوب)"""
    return await service.create_rep(db, user["tenant_id"], data)


@router.get("/{rep_id}")
async def get_rep(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    """تفاصيل مندوب"""
    return await service.get_rep(db, user["tenant_id"], rep_id)


@router.patch("/{rep_id}")
async def update_rep(
    rep_id: str,
    data: dict,
    user=Depends(require_role(["manager"])),
    db: AsyncSession = Depends(get_db),
):
    """تعديل بيانات مندوب"""
    return await service.update_rep(db, user["tenant_id"], rep_id, data)


@router.get("/{rep_id}/stock")
async def rep_stock(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant", "warehouse"])),
    db: AsyncSession = Depends(get_db),
):
    """مخزون مندوب محدد"""
    return await service.get_rep_stock(db, user["tenant_id"], rep_id)


@router.post("/{rep_id}/allocate")
async def allocate_stock(
    rep_id: str,
    data: dict,
    user=Depends(require_role(["manager", "warehouse"])),
    db: AsyncSession = Depends(get_db),
):
    """
    تحميل مخزون للمندوب من المستودع الرئيسي.
    body: { "items": [{"item_id": "...", "quantity": 10}] }
    """
    return await service.allocate_stock_to_rep(
        db, user["tenant_id"], user["user_id"],
        rep_id=rep_id,
        items=data.get("items", []),
    )


@router.get("/{rep_id}/invoices")
async def rep_invoices(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    """فواتير مندوب محدد"""
    return await service.get_rep_invoices(db, user["tenant_id"], rep_id)


@router.get("/{rep_id}/transfers")
async def rep_transfers(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant", "sales", "sales_rep"])),
    db: AsyncSession = Depends(get_db),
):
    """سجل المناقلات لمستودع المندوب"""
    from app.models.reps import SalesRep
    from app.models.inventory import StockMovement, Warehouse, InventoryItem, SerialItem
    from sqlalchemy import select as _sel
    from sqlalchemy.orm import selectinload as sil

    # إذا مندوب — يشوف مناقلاته فقط
    if user["role"] == "sales_rep":
        rep_r = await db.execute(_sel(SalesRep).where(SalesRep.user_id == user["user_id"]))
        rep = rep_r.scalar_one_or_none()
        if not rep or rep.id != rep_id:
            from fastapi import HTTPException
            raise HTTPException(403, "غير مصرح")
    else:
        rep_r = await db.execute(
            _sel(SalesRep).where(SalesRep.tenant_id == user["tenant_id"], SalesRep.id == rep_id)
        )
        rep = rep_r.scalar_one_or_none()
        if not rep:
            from fastapi import HTTPException
            raise HTTPException(404, "المندوب غير موجود")

    # جلب حركات النقل من/إلى مستودع المندوب
    mv_r = await db.execute(
        _sel(StockMovement)
        .where(
            StockMovement.tenant_id == user["tenant_id"],
            StockMovement.movement_type == "transfer",
            (StockMovement.warehouse_id == rep.warehouse_id) |
            (StockMovement.to_warehouse_id == rep.warehouse_id),
        )
        .order_by(StockMovement.created_at.desc())
        .limit(200)
    )
    movements = mv_r.scalars().all()

    # جلب أسماء المستودعات والمنتجات
    wh_ids = set()
    item_ids = set()
    for m in movements:
        if m.warehouse_id: wh_ids.add(m.warehouse_id)
        if m.to_warehouse_id: wh_ids.add(m.to_warehouse_id)
        if m.product_id: item_ids.add(m.product_id)

    wh_map = {}
    if wh_ids:
        wh_r = await db.execute(_sel(Warehouse).where(Warehouse.id.in_(wh_ids)))
        wh_map = {w.id: w.name_ar for w in wh_r.scalars().all()}

    item_map = {}
    if item_ids:
        it_r = await db.execute(_sel(InventoryItem).where(InventoryItem.id.in_(item_ids)))
        item_map = {i.id: i.name_ar for i in it_r.scalars().all()}

    # جلب السيريالات المرتبطة
    serial_ids = [m.serial_item_id for m in movements if m.serial_item_id]
    serial_map = {}
    if serial_ids:
        sr_r = await db.execute(_sel(SerialItem).where(SerialItem.id.in_(serial_ids)))
        serial_map = {s.id: s.serial_number for s in sr_r.scalars().all()}

    # تجميع النتائج — نجمع حركات نفس الوقت والمستودعات معاً
    from collections import defaultdict
    groups: dict = defaultdict(list)
    for m in movements:
        key = (m.created_at.strftime("%Y-%m-%d %H:%M"), m.warehouse_id, m.to_warehouse_id, m.product_id, m.notes or "")
        groups[key].append(m)

    result = []
    for (date_str, from_wh, to_wh, product_id, notes), mvs in groups.items():
        serials = [serial_map[m.serial_item_id] for m in mvs if m.serial_item_id and m.serial_item_id in serial_map]
        direction = "in" if to_wh == rep.warehouse_id else "out"
        result.append({
            "date": date_str,
            "direction": direction,
            "from_warehouse": wh_map.get(from_wh, from_wh),
            "to_warehouse": wh_map.get(to_wh, to_wh),
            "product_name": item_map.get(product_id, ""),
            "quantity": len(mvs) if serials else sum(abs(float(m.quantity)) for m in mvs),
            "serials": serials,
            "notes": notes,
        })

    result.sort(key=lambda x: x["date"], reverse=True)
    return result


@router.get("/{rep_id}/summary")
async def rep_summary(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    """ملخص أداء المندوب"""
    return await service.get_rep_summary(db, user["tenant_id"], rep_id)


# ══════════════════════════════════════════════════════════════════
# نهاية الـ router
# ══════════════════════════════════════════════════════════════════
