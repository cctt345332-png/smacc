"""
Notifications Service — تنبيهات عامة لكل الأقسام
"""
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.models.notifications import (
    Notification, AlertSetting, NotificationType, NotificationSeverity
)


# ─── CRUD ────────────────────────────────────────────────────────────

async def get_notifications(db: AsyncSession, tenant_id: str, unread_only: bool = False):
    q = select(Notification).where(Notification.tenant_id == tenant_id)
    if unread_only:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc()).limit(50)
    r = await db.execute(q)
    return r.scalars().all()


async def get_unread_count(db: AsyncSession, tenant_id: str) -> int:
    r = await db.execute(
        select(func.count()).where(
            Notification.tenant_id == tenant_id,
            Notification.is_read == False,
        )
    )
    return r.scalar() or 0


async def mark_read(db: AsyncSession, tenant_id: str, notification_id: str):
    n = await db.get(Notification, notification_id)
    if n and n.tenant_id == tenant_id:
        n.is_read = True
        await db.commit()


async def mark_all_read(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(Notification).where(
            Notification.tenant_id == tenant_id,
            Notification.is_read == False,
        )
    )
    for n in r.scalars().all():
        n.is_read = True
    await db.commit()


# ─── Alert Settings ──────────────────────────────────────────────────

async def get_alert_settings(db: AsyncSession, tenant_id: str) -> AlertSetting:
    r = await db.execute(select(AlertSetting).where(AlertSetting.tenant_id == tenant_id))
    settings = r.scalar_one_or_none()
    if not settings:
        settings = AlertSetting(id=str(uuid.uuid4()), tenant_id=tenant_id, updated_at=datetime.utcnow())
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


async def update_alert_settings(db: AsyncSession, tenant_id: str, data: dict) -> AlertSetting:
    settings = await get_alert_settings(db, tenant_id)
    for k, v in data.items():
        if hasattr(settings, k):
            setattr(settings, k, v)
    settings.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(settings)
    return settings


# ─── Helper ──────────────────────────────────────────────────────────

def _notif(tenant_id: str, ntype: NotificationType, severity: NotificationSeverity,
           title_ar: str, title_en: str, msg_ar: str, msg_en: str,
           ref_id: str | None = None, ref_type: str | None = None) -> Notification:
    return Notification(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        type=ntype, severity=severity,
        title_ar=title_ar, title_en=title_en,
        message_ar=msg_ar, message_en=msg_en,
        reference_id=ref_id, reference_type=ref_type,
    )


async def _exists(db: AsyncSession, tenant_id: str, ref_id: str, ntype: NotificationType) -> bool:
    r = await db.execute(
        select(Notification).where(
            Notification.tenant_id == tenant_id,
            Notification.reference_id == ref_id,
            Notification.type == ntype,
            Notification.is_read == False,
        )
    )
    return r.scalar_one_or_none() is not None


# ─── Run All Alerts ───────────────────────────────────────────────────

async def run_all_alerts(db: AsyncSession, tenant_id: str) -> dict:
    """فحص كل الأقسام وإنشاء التنبيهات المطلوبة"""
    settings = await get_alert_settings(db, tenant_id)
    now = datetime.utcnow()
    created = 0

    # 1. تنبيهات الأصول الثابتة
    created += await _check_asset_alerts(db, tenant_id, settings, now)

    # 2. تنبيهات المخزون
    created += await _check_inventory_alerts(db, tenant_id, settings, now)

    # 3. تنبيهات المبيعات
    created += await _check_sales_alerts(db, tenant_id, settings, now)

    # 4. تنبيهات المشتريات
    created += await _check_purchases_alerts(db, tenant_id, settings, now)

    # 5. تنبيهات الموارد البشرية
    created += await _check_hr_alerts(db, tenant_id, settings, now)

    # 6. تنبيهات المحاسبة
    created += await _check_accounting_alerts(db, tenant_id, settings, now)

    await db.commit()
    return {"alerts_created": created}


# للتوافق مع الكود القديم
async def run_asset_alerts(db: AsyncSession, tenant_id: str) -> dict:
    return await run_all_alerts(db, tenant_id)


# ─── Asset Alerts ─────────────────────────────────────────────────────

async def _check_asset_alerts(db: AsyncSession, tenant_id: str, settings: AlertSetting, now: datetime) -> int:
    try:
        from app.models.assets import Asset, AssetStatus
    except ImportError:
        return 0

    assets_r = await db.execute(
        select(Asset).where(Asset.tenant_id == tenant_id, Asset.status == AssetStatus.ACTIVE)
    )
    assets = assets_r.scalars().all()
    created = 0

    for asset in assets:
        # انتهاء الضمان
        if settings.asset_warranty_alert and asset.warranty_expiry:
            days_left = (asset.warranty_expiry - now).days
            if 0 <= days_left <= settings.asset_warranty_days:
                if not await _exists(db, tenant_id, asset.id, NotificationType.ASSET_WARRANTY_EXPIRY):
                    db.add(_notif(
                        tenant_id, NotificationType.ASSET_WARRANTY_EXPIRY,
                        NotificationSeverity.WARNING if days_left > 7 else NotificationSeverity.CRITICAL,
                        f"انتهاء ضمان: {asset.name_ar}", f"Warranty Expiring: {asset.name_en or asset.name_ar}",
                        f"ضمان الأصل '{asset.name_ar}' سينتهي خلال {days_left} يوم.",
                        f"Warranty for '{asset.name_en or asset.name_ar}' expires in {days_left} days.",
                        asset.id, "asset",
                    ))
                    created += 1

        # استهلاك كامل
        if settings.asset_full_depreciation_alert and asset.book_value <= asset.salvage_value and asset.accumulated_depreciation > 0:
            if not await _exists(db, tenant_id, asset.id, NotificationType.ASSET_FULLY_DEPRECIATED):
                db.add(_notif(
                    tenant_id, NotificationType.ASSET_FULLY_DEPRECIATED, NotificationSeverity.INFO,
                    f"أصل مستهلك بالكامل: {asset.name_ar}", f"Fully Depreciated: {asset.name_en or asset.name_ar}",
                    f"الأصل '{asset.name_ar}' تم استهلاكه بالكامل.",
                    f"Asset '{asset.name_en or asset.name_ar}' is fully depreciated.",
                    asset.id, "asset",
                ))
                created += 1

        # استهلاك متأخر
        if settings.asset_depreciation_due_alert and asset.last_depreciation_date:
            days_since = (now - asset.last_depreciation_date).days
            if days_since > settings.asset_depreciation_due_days:
                if not await _exists(db, tenant_id, asset.id, NotificationType.ASSET_DEPRECIATION_DUE):
                    db.add(_notif(
                        tenant_id, NotificationType.ASSET_DEPRECIATION_DUE, NotificationSeverity.WARNING,
                        f"استهلاك متأخر: {asset.name_ar}", f"Depreciation Overdue: {asset.name_en or asset.name_ar}",
                        f"لم يتم احتساب استهلاك الأصل '{asset.name_ar}' منذ {days_since} يوم.",
                        f"Asset '{asset.name_en or asset.name_ar}' not depreciated for {days_since} days.",
                        asset.id, "asset",
                    ))
                    created += 1

        # استهلاك مرتفع
        if settings.asset_high_depreciation_alert and asset.purchase_cost > 0:
            dep_pct = float(asset.accumulated_depreciation / asset.purchase_cost * 100)
            if dep_pct >= settings.asset_high_depreciation_threshold:
                if not await _exists(db, tenant_id, asset.id, NotificationType.ASSET_HIGH_DEPRECIATION):
                    db.add(_notif(
                        tenant_id, NotificationType.ASSET_HIGH_DEPRECIATION, NotificationSeverity.WARNING,
                        f"استهلاك مرتفع: {asset.name_ar}", f"High Depreciation: {asset.name_en or asset.name_ar}",
                        f"الأصل '{asset.name_ar}' استُهلك {dep_pct:.0f}% من قيمته.",
                        f"Asset '{asset.name_en or asset.name_ar}' is {dep_pct:.0f}% depreciated.",
                        asset.id, "asset",
                    ))
                    created += 1

    return created


# ─── Inventory Alerts ─────────────────────────────────────────────────

async def _check_inventory_alerts(db: AsyncSession, tenant_id: str, settings: AlertSetting, now: datetime) -> int:
    created = 0

    # مخزون منخفض
    if settings.inventory_low_stock_alert:
        try:
            from app.models.inventory import InventoryItem
            r = await db.execute(
                select(InventoryItem).where(
                    InventoryItem.tenant_id == tenant_id,
                    InventoryItem.is_active == True,
                    InventoryItem.tracking_type == "quantity",
                    InventoryItem.reorder_point > 0,
                    InventoryItem.quantity_on_hand <= InventoryItem.reorder_point,
                )
            )
            items = r.scalars().all()
            for item in items:
                if not await _exists(db, tenant_id, item.id, NotificationType.INVENTORY_LOW_STOCK):
                    db.add(_notif(
                        tenant_id, NotificationType.INVENTORY_LOW_STOCK, NotificationSeverity.WARNING,
                        f"مخزون منخفض: {item.name_ar}", f"Low Stock: {item.name_ar}",
                        f"الصنف '{item.name_ar}' وصل للحد الأدنى. الكمية المتبقية: {float(item.quantity_on_hand)}",
                        f"Item '{item.name_ar}' reached reorder point. Qty: {float(item.quantity_on_hand)}",
                        item.id, "inventory_item",
                    ))
                    created += 1
        except Exception:
            pass

    # انتهاء صلاحية (صيدلية)
    if settings.inventory_expiry_alert:
        try:
            from app.models.inventory import BatchItem, InventoryItem
            expiry_date = now + timedelta(days=settings.inventory_expiry_days)
            r = await db.execute(
                select(BatchItem).join(
                    InventoryItem, BatchItem.product_id == InventoryItem.id
                ).where(
                    InventoryItem.tenant_id == tenant_id,
                    BatchItem.expiry_date <= expiry_date,
                    BatchItem.expiry_date >= now,
                    BatchItem.quantity > 0,
                )
            )
            batches = r.scalars().all()
            for batch in batches:
                if not await _exists(db, tenant_id, batch.id, NotificationType.INVENTORY_EXPIRY):
                    days_left = (batch.expiry_date - now).days if batch.expiry_date else 0
                    db.add(_notif(
                        tenant_id, NotificationType.INVENTORY_EXPIRY,
                        NotificationSeverity.CRITICAL if days_left <= 7 else NotificationSeverity.WARNING,
                        f"انتهاء صلاحية قريب", f"Expiry Alert",
                        f"تشغيلة رقم {batch.batch_number} ستنتهي صلاحيتها خلال {days_left} يوم.",
                        f"Batch {batch.batch_number} expires in {days_left} days.",
                        batch.id, "batch",
                    ))
                    created += 1
        except Exception:
            pass

    return created


# ─── Sales Alerts ─────────────────────────────────────────────────────

async def _check_sales_alerts(db: AsyncSession, tenant_id: str, settings: AlertSetting, now: datetime) -> int:
    created = 0

    if settings.sales_overdue_alert:
        try:
            from app.models.sales import Invoice, InvoiceStatus
            overdue_date = now - timedelta(days=settings.sales_overdue_days)
            r = await db.execute(
                select(Invoice).where(
                    Invoice.tenant_id == tenant_id,
                    Invoice.status.in_([InvoiceStatus.CONFIRMED, InvoiceStatus.PARTIAL]),
                    Invoice.due_date < now,
                    Invoice.due_date.isnot(None),
                )
            )
            invoices = r.scalars().all()
            for inv in invoices:
                if not await _exists(db, tenant_id, inv.id, NotificationType.SALES_OVERDUE_INVOICE):
                    days_overdue = (now - inv.due_date).days if inv.due_date else 0
                    remaining = float(inv.total) - float(inv.paid_amount)
                    db.add(_notif(
                        tenant_id, NotificationType.SALES_OVERDUE_INVOICE,
                        NotificationSeverity.CRITICAL if days_overdue > 30 else NotificationSeverity.WARNING,
                        f"فاتورة متأخرة: {inv.buyer_name_ar}", f"Overdue Invoice: {inv.buyer_name_ar}",
                        f"الفاتورة {inv.invoice_number} للعميل '{inv.buyer_name_ar}' متأخرة {days_overdue} يوم. المبلغ المستحق: {remaining:.2f} ر.س",
                        f"Invoice {inv.invoice_number} for '{inv.buyer_name_ar}' is {days_overdue} days overdue. Amount: {remaining:.2f} SAR",
                        inv.id, "invoice",
                    ))
                    created += 1
        except Exception:
            pass

    return created


# ─── Purchases Alerts ─────────────────────────────────────────────────

async def _check_purchases_alerts(db: AsyncSession, tenant_id: str, settings: AlertSetting, now: datetime) -> int:
    created = 0

    if settings.purchases_overdue_alert:
        try:
            from app.models.purchases import Bill, BillStatus
            r = await db.execute(
                select(Bill).where(
                    Bill.tenant_id == tenant_id,
                    Bill.status.in_(["confirmed", "partial"]),
                    Bill.due_date < now,
                    Bill.due_date.isnot(None),
                )
            )
            bills = r.scalars().all()
            for bill in bills:
                if not await _exists(db, tenant_id, bill.id, NotificationType.PURCHASES_OVERDUE_BILL):
                    days_overdue = (now - bill.due_date).days if bill.due_date else 0
                    db.add(_notif(
                        tenant_id, NotificationType.PURCHASES_OVERDUE_BILL, NotificationSeverity.WARNING,
                        f"فاتورة مورد متأخرة", f"Overdue Bill",
                        f"فاتورة المورد رقم {bill.bill_number} متأخرة {days_overdue} يوم.",
                        f"Bill {bill.bill_number} is {days_overdue} days overdue.",
                        bill.id, "bill",
                    ))
                    created += 1
        except Exception:
            pass

    return created


# ─── HR Alerts ────────────────────────────────────────────────────────

async def _check_hr_alerts(db: AsyncSession, tenant_id: str, settings: AlertSetting, now: datetime) -> int:
    created = 0

    # طلبات الإجازة المعلقة
    if settings.hr_leave_request_alert:
        try:
            from app.models.hr import LeaveRequest
            r = await db.execute(
                select(LeaveRequest).where(
                    LeaveRequest.tenant_id == tenant_id,
                    LeaveRequest.status == "pending",
                )
            )
            leaves = r.scalars().all()
            for leave in leaves:
                if not await _exists(db, tenant_id, leave.id, NotificationType.HR_LEAVE_REQUEST):
                    db.add(_notif(
                        tenant_id, NotificationType.HR_LEAVE_REQUEST, NotificationSeverity.INFO,
                        "طلب إجازة معلق", "Pending Leave Request",
                        f"يوجد طلب إجازة معلق يحتاج موافقتك.",
                        f"There is a pending leave request awaiting your approval.",
                        leave.id, "leave_request",
                    ))
                    created += 1
        except Exception:
            pass

    # انتهاء عقود الموظفين
    if settings.hr_contract_expiry_alert:
        try:
            from app.models.hr import Employee
            expiry_date = now + timedelta(days=settings.hr_contract_expiry_days)
            r = await db.execute(
                select(Employee).where(
                    Employee.tenant_id == tenant_id,
                    Employee.status == "active",
                    Employee.end_date <= expiry_date,
                    Employee.end_date >= now,
                )
            )
            employees = r.scalars().all()
            for emp in employees:
                if not await _exists(db, tenant_id, emp.id, NotificationType.HR_CONTRACT_EXPIRY):
                    days_left = (emp.end_date - now.date()).days if emp.end_date else 0
                    db.add(_notif(
                        tenant_id, NotificationType.HR_CONTRACT_EXPIRY, NotificationSeverity.WARNING,
                        f"انتهاء عقد: {emp.full_name_ar}", f"Contract Expiry: {emp.full_name_ar}",
                        f"عقد الموظف '{emp.full_name_ar}' سينتهي خلال {days_left} يوم.",
                        f"Employee '{emp.full_name_ar}' contract expires in {days_left} days.",
                        emp.id, "employee",
                    ))
                    created += 1
        except Exception:
            pass

    return created


# ─── Accounting Alerts ────────────────────────────────────────────────

async def _check_accounting_alerts(db: AsyncSession, tenant_id: str, settings: AlertSetting, now: datetime) -> int:
    created = 0

    # تنبيه الإقرار الضريبي
    if settings.vat_due_alert:
        try:
            # الإقرار الضريبي يُقدَّم في اليوم الأول من الشهر التالي بعد نهاية الربع
            month = now.month
            # نهايات الأرباع: مارس(3)، يونيو(6)، سبتمبر(9)، ديسمبر(12)
            quarter_ends = [3, 6, 9, 12]
            for qe in quarter_ends:
                if month == qe:
                    # نهاية الربع هذا الشهر — الإقرار مستحق بعد 30 يوم
                    days_left = 30 - now.day
                    if 0 <= days_left <= settings.vat_due_days:
                        ref_id = f"vat_{now.year}_q{quarter_ends.index(qe)+1}"
                        if not await _exists(db, tenant_id, ref_id, NotificationType.ACCOUNTING_VAT_DUE):
                            db.add(_notif(
                                tenant_id, NotificationType.ACCOUNTING_VAT_DUE,
                                NotificationSeverity.CRITICAL if days_left <= 3 else NotificationSeverity.WARNING,
                                "موعد الإقرار الضريبي قريب", "VAT Return Due Soon",
                                f"موعد تقديم الإقرار الضريبي بعد {days_left} يوم.",
                                f"VAT return is due in {days_left} days.",
                                ref_id, "vat",
                            ))
                            created += 1
        except Exception:
            pass

    return created
