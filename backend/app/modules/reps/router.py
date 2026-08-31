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
from app.modules.sales.schemas import CreditNoteCreate

router = APIRouter(prefix="/reps", tags=["reps"])


# ══════════════════════════════════════════════════════════════════
# تقرير PDF — يجب أن يكون قبل /{rep_id}
# ══════════════════════════════════════════════════════════════════

@router.get("/report/pdf")
async def reps_pdf_report(
    rep_id: str = "",
    zone: str = "",
    month: str = "",
    user=Depends(require_role(["manager", "accountant", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    """
    توليد تقرير PDF للمناديب
    - rep_id: فلتر مندوب واحد (اختياري)
    - zone: فلتر منطقة (اختياري)
    - month: فلتر شهر YYYY-MM (اختياري)
    """
    from fastapi.responses import Response
    from app.modules.reps.pdf_report import generate_reps_summary_pdf
    from app.models.sales import Invoice
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    tenant_id = user["tenant_id"]

    # جلب المناديب مع ملخصاتهم
    reps_list = await service.get_reps(db, tenant_id)
    reps_with_summary = []
    for rep in reps_list:
        if zone and rep.get("zone", "") != zone:
            continue
        try:
            summary = await service.get_rep_summary(db, tenant_id, rep["id"])
            reps_with_summary.append({**rep, **summary})
        except Exception:
            reps_with_summary.append(rep)

    # جلب الفواتير
    q = select(Invoice).where(
        Invoice.tenant_id == tenant_id,
        Invoice.rep_id.isnot(None),
    ).order_by(Invoice.issue_date.desc())

    if rep_id:
        q = q.where(Invoice.rep_id == rep_id)
    if month:
        q = q.where(Invoice.issue_date.between(
            f"{month}-01", f"{month}-31"
        ))

    inv_r = await db.execute(q)
    invoices_raw = inv_r.scalars().all()

    # تحويل للـ dict
    invoices = []
    for inv in invoices_raw:
        invoices.append({
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "rep_id": inv.rep_id,
            "buyer_name_ar": inv.buyer_name_ar,
            "status": inv.status.value if hasattr(inv.status, "value") else str(inv.status),
            "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
            "total": float(inv.total or 0),
            "paid_amount": float(inv.paid_amount or 0),
            "invoice_payment_method": inv.invoice_payment_method.value if inv.invoice_payment_method and hasattr(inv.invoice_payment_method, "value") else str(inv.invoice_payment_method or ""),
            "credit_days": inv.credit_days,
            "submitted_at": inv.submitted_at.isoformat() if inv.submitted_at else None,
            "rejection_note": inv.rejection_note,
        })

    # جلب اسم الشركة
    company_name = ""
    try:
        from app.models.tenant import Tenant
        t = await db.get(Tenant, tenant_id)
        if t:
            company_name = t.name or ""
    except Exception:
        pass

    # توليد الـ PDF
    pdf_bytes = generate_reps_summary_pdf(
        reps_data=reps_with_summary,
        invoices=invoices,
        company_name=company_name,
        filter_rep_id=rep_id,
        filter_zone=zone,
        filter_month=month,
    )

    filename = f"reps-report-{month or 'all'}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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


@router.post("/me/credit-notes", status_code=201)
async def my_create_credit_note(
    data: CreditNoteCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """ينشئ المندوب مرتجعًا (إشعارًا دائنًا) لفاتورة تخصه فقط بعد تأكيدها."""
    from app.modules.sales import service as sales_service
    from app.models.sales import InvoiceStatus
    original = await sales_service.get_invoice(db, user["tenant_id"], data.original_invoice_id)
    rep = await service.get_rep_by_user(db, user["user_id"])
    if not rep or original.rep_id != rep.id:
        from fastapi import HTTPException
        raise HTTPException(403, "لا يمكنك إنشاء مرتجع لفاتورة مندوب آخر")
    if original.status not in (InvoiceStatus.CONFIRMED, InvoiceStatus.PAID, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE):
        from fastapi import HTTPException
        raise HTTPException(400, "لا يمكن إنشاء مرتجع إلا لفاتورة مؤكدة أو مرتبطة بسند قبض")
    return await sales_service.create_credit_note(db, user["tenant_id"], user["user_id"], data)


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
    """ملخص أداء المندوب الحالي — فقط confirmed/paid/partial"""
    return await service.get_my_summary(db, user["tenant_id"], user["user_id"])


@router.get("/me/attendance/today")
async def my_attendance_today(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """حالة حضور اليوم للمندوب الحالي فقط."""
    return await service.get_my_attendance_status(db, user["tenant_id"], user["user_id"])


@router.post("/me/attendance/check-in", status_code=201)
async def my_attendance_check_in(
    data: dict | None = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """يسجل حضور المندوب بالموقع الحالي أو بآخر نقطة تتبع حديثة."""
    return await service.check_in_my_attendance(db, user["tenant_id"], user["user_id"], data)


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

@router.get("/attendance")
async def list_rep_attendance(
    date: str | None = None,
    rep_id: str | None = None,
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """سجل حضور المناديب اليومي للمدير والمحاسب."""
    return await service.get_rep_attendance(db, user["tenant_id"], date, rep_id)


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


@router.post("/{rep_id}/impersonate-token")
async def impersonate_rep(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """يُولّد توكن مؤقت (2 ساعة) للمدير/المحاسب للدخول كمندوب"""
    from app.models.reps import SalesRep
    from app.models.user import User
    from sqlalchemy import select
    from datetime import datetime, timedelta
    from jose import jwt
    from app.core.config import settings

    r = await db.execute(
        select(SalesRep, User)
        .join(User, SalesRep.user_id == User.id)
        .where(SalesRep.id == rep_id, SalesRep.tenant_id == user["tenant_id"])
    )
    row = r.one_or_none()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(404, "المندوب غير موجود")
    rep, rep_user = row

    payload = {
        "sub": rep_user.id,
        "tenant_id": rep_user.tenant_id,
        "role": "sales_rep",
        "exp": datetime.utcnow() + timedelta(hours=2),
        "impersonated_by": user["user_id"],
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return {
        "access_token": token,
        "rep_id": rep.id,
        "rep_code": rep.rep_code,
        "full_name": rep_user.full_name,
    }


@router.post("/{rep_id}/customers/import-from-tree")
async def import_rep_customers_from_tree(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """استيراد العملاء من الحساب المحاسبي المرتبط بهذا المندوب فقط."""
    return await service.import_rep_customers_from_tree(
        db, user["tenant_id"], rep_id, user["user_id"]
    )


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


@router.get("/{rep_id}/geo-zone")
async def get_rep_geo_zone(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """حدود منطقة عمل المندوب للإدارة."""
    return await service.get_rep_geo_zone(db, user["tenant_id"], rep_id)


@router.put("/{rep_id}/geo-zone")
async def save_rep_geo_zone(
    rep_id: str,
    data: dict,
    user=Depends(require_role(["manager"])),
    db: AsyncSession = Depends(get_db),
):
    """حفظ حدود منطقة عمل المندوب؛ لا يغير بيانات التتبع التاريخية."""
    return await service.save_rep_geo_zone(db, user["tenant_id"], rep_id, data)


@router.get("/{rep_id}/geo-events")
async def get_rep_geo_events(
    rep_id: str,
    date: str | None = None,
    user=Depends(require_role(["manager", "accountant"])),
    db: AsyncSession = Depends(get_db),
):
    """أحداث دخول وخروج منطقة العمل للمندوب."""
    return await service.get_rep_geo_events(db, user["tenant_id"], rep_id, date)


@router.get("/{rep_id}/summary")
async def rep_summary(
    rep_id: str,
    user=Depends(require_role(["manager", "accountant", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    """ملخص أداء المندوب"""
    return await service.get_rep_summary(db, user["tenant_id"], rep_id)


# ══════════════════════════════════════════════════════════════════
# تتبع مواقع المناديب
# ══════════════════════════════════════════════════════════════════

@router.post("/me/location", status_code=201)
async def post_my_location(
    data: dict,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """المندوب يرسل موقعه الحالي — يُحفظ في rep_locations"""
    from app.models.reps import SalesRep, RepLocation
    from sqlalchemy import select
    import uuid
    from datetime import datetime

    # تحقق أن المستخدم مندوب
    rep_r = await db.execute(
        select(SalesRep).where(
            SalesRep.user_id == user["user_id"],
            SalesRep.tenant_id == user["tenant_id"],
        )
    )
    rep = rep_r.scalar_one_or_none()
    if not rep:
        from fastapi import HTTPException
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    loc = RepLocation(
        id=str(uuid.uuid4()),
        tenant_id=user["tenant_id"],
        rep_id=rep.id,
        latitude=data["latitude"],
        longitude=data["longitude"],
        accuracy=data.get("accuracy"),
        speed=data.get("speed"),
        heading=data.get("heading"),
        battery_level=data.get("battery_level"),
        is_moving=data.get("is_moving", False),
        recorded_at=datetime.fromisoformat(data["recorded_at"].replace("Z", "+00:00")).replace(tzinfo=None) if data.get("recorded_at") else datetime.utcnow(),
        created_at=datetime.utcnow(),
    )
    db.add(loc)
    # فحص المنطقة إضافة لاحقة لحفظ الموقع، ولا يغيّر نقاط المسار أو تردد التتبع.
    geo_event = await service.record_geo_transition(
        db, user["tenant_id"], rep, loc.id,
        float(loc.latitude), float(loc.longitude), loc.recorded_at,
    )
    await db.commit()
    return {
        "id": loc.id,
        "rep_id": loc.rep_id,
        "recorded_at": loc.recorded_at.isoformat(),
        "geo_event": geo_event,
    }


@router.get("/me/location/latest")
async def my_latest_location(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """آخر موقع مسجّل للمندوب الحالي"""
    from app.models.reps import SalesRep, RepLocation
    from sqlalchemy import select

    rep_r = await db.execute(
        select(SalesRep).where(
            SalesRep.user_id == user["user_id"],
            SalesRep.tenant_id == user["tenant_id"],
        )
    )
    rep = rep_r.scalar_one_or_none()
    if not rep:
        from fastapi import HTTPException
        raise HTTPException(403, "هذا الحساب ليس مندوباً")

    loc_r = await db.execute(
        select(RepLocation)
        .where(RepLocation.rep_id == rep.id, RepLocation.tenant_id == user["tenant_id"])
        .order_by(RepLocation.recorded_at.desc())
        .limit(1)
    )
    loc = loc_r.scalar_one_or_none()
    if not loc:
        from fastapi import HTTPException
        raise HTTPException(404, "لا يوجد موقع مسجّل")

    return {
        "id": loc.id,
        "rep_id": loc.rep_id,
        "latitude": float(loc.latitude),
        "longitude": float(loc.longitude),
        "accuracy": float(loc.accuracy) if loc.accuracy else None,
        "speed": float(loc.speed) if loc.speed else None,
        "heading": float(loc.heading) if loc.heading else None,
        "battery_level": loc.battery_level,
        "is_moving": loc.is_moving,
        "recorded_at": loc.recorded_at.isoformat(),
    }


@router.get("/locations/live")
async def live_locations(
    user=Depends(require_role(["manager", "accountant", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    """
    آخر موقع لكل مندوب ومشرف نشط — للخريطة الحية.
    يُخفي من لم يرسل موقعه منذ أكثر من ساعتين (التطبيق مغلق).
    """
    from app.models.reps import SalesRep, RepLocation, Supervisor
    from app.models.user import User
    from sqlalchemy import select
    from datetime import datetime, timedelta

    # حد الوقت — 2 ساعة
    cutoff = datetime.utcnow() - timedelta(hours=2)
    result = []

    # ── 1. المناديب النشطين ───────────────────────────────────────────
    reps_r = await db.execute(
        select(SalesRep, User)
        .join(User, User.id == SalesRep.user_id)
        .where(SalesRep.tenant_id == user["tenant_id"], SalesRep.is_active == True)
    )
    for rep, u in reps_r.all():
        loc_r = await db.execute(
            select(RepLocation)
            .where(
                RepLocation.rep_id == rep.id,
                RepLocation.tenant_id == user["tenant_id"],
                RepLocation.recorded_at >= cutoff,
            )
            .order_by(RepLocation.recorded_at.desc())
            .limit(1)
        )
        loc = loc_r.scalar_one_or_none()
        if loc:
            result.append({
                "rep_id": rep.id,
                "rep_code": rep.rep_code,
                "rep_name": u.full_name,
                "person_type": "rep",
                "latitude": float(loc.latitude),
                "longitude": float(loc.longitude),
                "accuracy": float(loc.accuracy) if loc.accuracy else None,
                "speed": float(loc.speed) if loc.speed else None,
                "heading": float(loc.heading) if loc.heading else None,
                "battery_level": loc.battery_level,
                "is_moving": loc.is_moving,
                "recorded_at": loc.recorded_at.isoformat() + "Z",
            })

    # ── 2. المشرفون النشطين ───────────────────────────────────────────
    sups_r = await db.execute(
        select(Supervisor, User)
        .join(User, User.id == Supervisor.user_id)
        .where(Supervisor.tenant_id == user["tenant_id"], Supervisor.is_active == True)
    )
    for sup, u in sups_r.all():
        loc_r = await db.execute(
            select(RepLocation)
            .where(
                RepLocation.rep_id == sup.id,
                RepLocation.tenant_id == user["tenant_id"],
                RepLocation.recorded_at >= cutoff,
            )
            .order_by(RepLocation.recorded_at.desc())
            .limit(1)
        )
        loc = loc_r.scalar_one_or_none()
        if loc:
            result.append({
                "rep_id": sup.id,
                "rep_code": "SUP",
                "rep_name": sup.name,
                "person_type": "supervisor",
                "latitude": float(loc.latitude),
                "longitude": float(loc.longitude),
                "accuracy": float(loc.accuracy) if loc.accuracy else None,
                "speed": float(loc.speed) if loc.speed else None,
                "heading": float(loc.heading) if loc.heading else None,
                "battery_level": loc.battery_level,
                "is_moving": loc.is_moving,
                "recorded_at": loc.recorded_at.isoformat() + "Z",
            })

    return result


@router.get("/{rep_id}/locations")
async def rep_location_history(
    rep_id: str,
    date: str | None = None,
    user=Depends(require_role(["manager", "accountant", "sales"])),
    db: AsyncSession = Depends(get_db),
):
    """
    مسار مندوب أو مشرف خلال يوم محدد (YYYY-MM-DD).
    إذا لم يُحدَّد التاريخ يُعاد اليوم الحالي.
    """
    from app.models.reps import SalesRep, RepLocation, Supervisor
    from sqlalchemy import select
    from datetime import datetime, date as date_type

    # تحقق أن المعرّف ينتمي لمندوب أو مشرف
    rep_r = await db.execute(
        select(SalesRep).where(SalesRep.id == rep_id, SalesRep.tenant_id == user["tenant_id"])
    )
    entity = rep_r.scalar_one_or_none()
    if not entity:
        sup_r = await db.execute(
            select(Supervisor).where(Supervisor.id == rep_id, Supervisor.tenant_id == user["tenant_id"])
        )
        entity = sup_r.scalar_one_or_none()
    if not entity:
        from fastapi import HTTPException
        raise HTTPException(404, "المندوب أو المشرف غير موجود")

    if date:
        target = datetime.strptime(date, "%Y-%m-%d").date()
    else:
        target = date_type.today()

    day_start = datetime(target.year, target.month, target.day, 0, 0, 0)
    day_end   = datetime(target.year, target.month, target.day, 23, 59, 59)

    locs_r = await db.execute(
        select(RepLocation)
        .where(
            RepLocation.rep_id == rep_id,
            RepLocation.tenant_id == user["tenant_id"],
            RepLocation.recorded_at >= day_start,
            RepLocation.recorded_at <= day_end,
        )
        .order_by(RepLocation.recorded_at.asc())
    )
    locs = locs_r.scalars().all()

    return [
        {
            "id": loc.id,
            "latitude": float(loc.latitude),
            "longitude": float(loc.longitude),
            "accuracy": float(loc.accuracy) if loc.accuracy else None,
            "speed": float(loc.speed) if loc.speed else None,
            "heading": float(loc.heading) if loc.heading else None,
            "battery_level": loc.battery_level,
            "is_moving": loc.is_moving,
            "recorded_at": loc.recorded_at.isoformat(),
        }
        for loc in locs
    ]


# ══════════════════════════════════════════════════════════════════
# نهاية الـ router
# ══════════════════════════════════════════════════════════════════
