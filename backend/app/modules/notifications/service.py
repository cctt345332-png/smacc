"""
Notifications Service — تنبيهات عامة لكل الأقسام
"""
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from app.models.user import User

from app.models.notifications import (
    Notification, AlertSetting, NotificationType, NotificationSeverity
)


# ─── CRUD ────────────────────────────────────────────────────────────

async def get_notifications(db: AsyncSession, tenant_id: str, unread_only: bool = False, user: dict | None = None):
    q = select(Notification).where(Notification.tenant_id == tenant_id)
    if user:
        q = q.where(or_(Notification.user_id == user["user_id"], Notification.user_id.is_(None)))
    if unread_only:
        q = q.where(Notification.is_read == False)
    q = q.order_by(Notification.created_at.desc()).limit(50)
    r = await db.execute(q)
    return r.scalars().all()


async def get_unread_count(db: AsyncSession, tenant_id: str, user: dict | None = None) -> int:
    conditions = [Notification.tenant_id == tenant_id, Notification.is_read == False]
    if user:
        conditions.append(or_(Notification.user_id == user["user_id"], Notification.user_id.is_(None)))
    r = await db.execute(select(func.count()).where(*conditions))
    return r.scalar() or 0


async def mark_read(db: AsyncSession, tenant_id: str, notification_id: str, user: dict | None = None):
    n = await db.get(Notification, notification_id)
    if n and n.tenant_id == tenant_id and (not user or n.user_id in (None, user["user_id"])):
        n.is_read = True
        await db.commit()


async def mark_all_read(db: AsyncSession, tenant_id: str, user: dict | None = None):
    conditions = [Notification.tenant_id == tenant_id, Notification.is_read == False]
    if user:
        conditions.append(or_(Notification.user_id == user["user_id"], Notification.user_id.is_(None)))
    r = await db.execute(
        select(Notification).where(
            *conditions,
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
           ref_id: str | None = None, ref_type: str | None = None,
           user_id: str | None = None) -> Notification:
    return Notification(
        id=str(uuid.uuid4()), tenant_id=tenant_id, user_id=user_id,
        type=ntype, severity=severity,
        title_ar=title_ar, title_en=title_en,
        message_ar=msg_ar, message_en=msg_en,
        reference_id=ref_id, reference_type=ref_type,
    )


async def _exists(db: AsyncSession, tenant_id: str, ref_id: str, ntype: NotificationType,
                  user_id: str | None = None) -> bool:
    r = await db.execute(
        select(Notification).where(
            Notification.tenant_id == tenant_id,
            Notification.reference_id == ref_id,
            Notification.type == ntype,
            Notification.user_id == user_id,
            Notification.created_at >= datetime.utcnow() - timedelta(days=1),
        )
    )
    return r.scalar_one_or_none() is not None


async def _management_user_ids(db: AsyncSession, tenant_id: str) -> list[str]:
    result = await db.execute(select(User.id).where(
        User.tenant_id == tenant_id,
        User.is_active == True,
        User.role.in_(["admin", "manager", "accountant"]),
    ))
    return list(result.scalars().all())


# ─── Run All Alerts ───────────────────────────────────────────────────

async def run_all_alerts(db: AsyncSession, tenant_id: str) -> dict:
    """فحص كل الأقسام وإنشاء التنبيهات المطلوبة"""
    settings = await get_alert_settings(db, tenant_id)
    now = datetime.utcnow()
    run_started_at = now
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

    await db.flush()
    new_result = await db.execute(select(Notification).where(
        Notification.tenant_id == tenant_id,
        Notification.created_at >= run_started_at,
    ))
    new_notifications = new_result.scalars().all()
    await db.commit()
    push = await dispatch_push(db, tenant_id, new_notifications) if new_notifications else {"sent": 0}
    return {"alerts_created": created, "push": push}


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
            from app.models.reps import SalesRep
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
            management_ids = await _management_user_ids(db, tenant_id)
            for inv in invoices:
                days_overdue = (now - inv.due_date).days if inv.due_date else 0
                remaining = float(inv.total) - float(inv.paid_amount)
                rep_user_id = None
                if inv.rep_id:
                    rep_user_id = await db.scalar(select(SalesRep.user_id).where(
                        SalesRep.id == inv.rep_id, SalesRep.tenant_id == tenant_id,
                    ))
                recipients = list(dict.fromkeys(
                    ([rep_user_id] if rep_user_id else []) + management_ids
                ))
                for recipient_id in recipients:
                    if await _exists(db, tenant_id, inv.id, NotificationType.SALES_OVERDUE_INVOICE, recipient_id):
                        continue
                    db.add(_notif(
                        tenant_id, NotificationType.SALES_OVERDUE_INVOICE,
                        NotificationSeverity.CRITICAL if days_overdue > 30 else NotificationSeverity.WARNING,
                        f"فاتورة متأخرة: {inv.buyer_name_ar}", f"Overdue Invoice: {inv.buyer_name_ar}",
                        f"الفاتورة {inv.invoice_number} للعميل '{inv.buyer_name_ar}' متأخرة {days_overdue} يوم. المبلغ المستحق: {remaining:.2f} ر.س",
                        f"Invoice {inv.invoice_number} for '{inv.buyer_name_ar}' is {days_overdue} days overdue. Amount: {remaining:.2f} SAR",
                        inv.id, "invoice", recipient_id,
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


async def list_recipients(db: AsyncSession, tenant_id: str):
    result = await db.execute(
        select(User.id, User.full_name, User.email, User.role)
        .where(User.tenant_id == tenant_id, User.is_active == True)
        .order_by(User.full_name.asc())
    )
    return [
        {"id": row.id, "full_name": row.full_name, "email": row.email, "role": row.role}
        for row in result.all()
    ]


async def create_manual_notifications(db: AsyncSession, tenant_id: str, sender: dict, data: dict):
    title_ar = str(data.get("title_ar") or data.get("title") or "").strip()
    title_en = str(data.get("title_en") or title_ar).strip()
    message_ar = str(data.get("message_ar") or data.get("message") or "").strip()
    message_en = str(data.get("message_en") or message_ar).strip()
    if not title_ar or not message_ar:
        raise ValueError("العنوان والرسالة مطلوبان")

    requested_ids = {str(value) for value in (data.get("user_ids") or []) if value}
    requested_roles = {str(value) for value in (data.get("roles") or []) if value}
    query = select(User).where(User.tenant_id == tenant_id, User.is_active == True)
    if requested_ids and requested_roles:
        query = query.where(or_(User.id.in_(requested_ids), User.role.in_(requested_roles)))
    elif requested_ids:
        query = query.where(User.id.in_(requested_ids))
    elif requested_roles:
        query = query.where(User.role.in_(requested_roles))
    else:
        raise ValueError("حدد مستخدماً واحداً على الأقل أو دوراً مستهدفاً")

    recipients = (await db.execute(query)).scalars().all()
    if not recipients:
        raise ValueError("لم يتم العثور على مستلمين نشطين")

    severity_value = str(data.get("severity") or "info").lower()
    severity = next((item for item in NotificationSeverity if item.value == severity_value), NotificationSeverity.INFO)
    created = []
    for recipient in recipients:
        created.append(Notification(
            id=str(uuid.uuid4()), tenant_id=tenant_id, user_id=recipient.id,
            type=NotificationType.GENERAL, severity=severity,
            title_ar=title_ar, title_en=title_en, message_ar=message_ar, message_en=message_en,
            reference_id=data.get("reference_id"), reference_type=data.get("reference_type"),
            created_by_id=sender["user_id"], is_manual=True,
        ))
    db.add_all(created)
    await db.commit()
    push_result = await dispatch_push(db, tenant_id, created)
    return {"created": len(created), "recipient_ids": [item.user_id for item in created], "push": push_result}


async def get_manual_history(db: AsyncSession, tenant_id: str, limit: int = 100):
    result = await db.execute(
        select(Notification, User.full_name.label("recipient_name"))
        .outerjoin(User, User.id == Notification.user_id)
        .where(Notification.tenant_id == tenant_id, Notification.is_manual == True)
        .order_by(Notification.created_at.desc())
        .limit(min(max(limit, 1), 500))
    )
    fields = (
        "id", "user_id", "title_ar", "title_en", "message_ar", "message_en",
        "severity", "is_read", "created_at", "created_by_id", "reference_id", "reference_type",
    )
    return [
        {**{key: getattr(notification, key) for key in fields}, "recipient_name": recipient_name}
        for notification, recipient_name in result.all()
    ]


async def register_device(db: AsyncSession, user: dict, data: dict):
    from app.models.notifications import UserDevice

    token = str(data.get("fcm_token") or "").strip()
    if not token:
        raise ValueError("رمز الجهاز مطلوب")
    result = await db.execute(select(UserDevice).where(UserDevice.fcm_token == token))
    device = result.scalar_one_or_none()
    if device:
        device.tenant_id = user["tenant_id"]
        device.user_id = user["user_id"]
        device.platform = str(data.get("platform") or device.platform or "android")
        device.device_name = data.get("device_name")
        device.app_version = data.get("app_version")
        device.is_active = True
        device.last_seen_at = datetime.utcnow()
    else:
        device = UserDevice(
            id=str(uuid.uuid4()), tenant_id=user["tenant_id"], user_id=user["user_id"],
            fcm_token=token, platform=str(data.get("platform") or "android"),
            device_name=data.get("device_name"), app_version=data.get("app_version"),
            is_active=True, last_seen_at=datetime.utcnow(),
        )
        db.add(device)
    await db.commit()
    return {"ok": True, "device_id": device.id}


async def unregister_device(db: AsyncSession, user: dict, data: dict):
    from app.models.notifications import UserDevice

    token = str(data.get("fcm_token") or "").strip()
    if token:
        result = await db.execute(select(UserDevice).where(
            UserDevice.fcm_token == token,
            UserDevice.tenant_id == user["tenant_id"],
            UserDevice.user_id == user["user_id"],
        ))
        device = result.scalar_one_or_none()
        if device:
            device.is_active = False
            await db.commit()
    return {"ok": True}


async def dispatch_push(db: AsyncSession, tenant_id: str, notifications: list[Notification]):
    from app.modules.notifications.fcm import send_notifications
    return await send_notifications(db, tenant_id, notifications)


async def notify_management_event(
    db: AsyncSession,
    tenant_id: str,
    actor_id: str,
    title_ar: str,
    title_en: str,
    message_ar: str,
    message_en: str,
    reference_id: str | None = None,
    reference_type: str | None = None,
    severity: NotificationSeverity = NotificationSeverity.INFO,
):
    """إرسال إشعار تشغيلي للمديرين والمحاسبين بعد نجاح العملية."""
    recipients = (await db.execute(select(User).where(
        User.tenant_id == tenant_id,
        User.is_active == True,
        User.role.in_(["admin", "manager", "accountant"]),
        User.id != actor_id,
    ))).scalars().all()
    if not recipients:
        return {"created": 0, "push": {"sent": 0}}

    notifications = [Notification(
        id=str(uuid.uuid4()), tenant_id=tenant_id, user_id=recipient.id,
        type=NotificationType.GENERAL, severity=severity,
        title_ar=title_ar, title_en=title_en,
        message_ar=message_ar, message_en=message_en,
        reference_id=reference_id, reference_type=reference_type,
        created_by_id=actor_id, is_manual=False,
    ) for recipient in recipients]
    db.add_all(notifications)
    await db.commit()
    try:
        push = await dispatch_push(db, tenant_id, notifications)
    except Exception:
        push = {"sent": 0, "error": "push_dispatch_failed"}
    return {"created": len(notifications), "push": push}


async def notify_users_event(
    db: AsyncSession, tenant_id: str, actor_id: str, recipient_ids: list[str],
    title_ar: str, title_en: str, message_ar: str, message_en: str,
    reference_id: str | None = None, reference_type: str | None = None,
    severity: NotificationSeverity = NotificationSeverity.INFO,
):
    recipients = list(dict.fromkeys(str(item) for item in recipient_ids if item and str(item) != str(actor_id)))
    if not recipients:
        return {"created": 0, "push": {"sent": 0}}
    notifications = [Notification(
        id=str(uuid.uuid4()), tenant_id=tenant_id, user_id=recipient_id,
        type=NotificationType.GENERAL, severity=severity,
        title_ar=title_ar, title_en=title_en, message_ar=message_ar, message_en=message_en,
        reference_id=reference_id, reference_type=reference_type,
        created_by_id=actor_id, is_manual=False,
    ) for recipient_id in recipients]
    db.add_all(notifications)
    await db.commit()
    try:
        push = await dispatch_push(db, tenant_id, notifications)
    except Exception:
        push = {"sent": 0, "error": "push_dispatch_failed"}
    return {"created": len(notifications), "push": push}
