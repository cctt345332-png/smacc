import uuid
import json
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException

from app.models.purchases import (
    Vendor, PurchaseOrder, PurchaseOrderLine,
    Bill, BillLine, BillPayment, DebitNote, DebitNoteLine,
    BillStatus, PurchaseOrderStatus, VendorType
)


def _calc(qty, price, disc, vat):
    gross = Decimal(str(qty)) * Decimal(str(price))
    disc_amt = gross * Decimal(str(disc)) / 100
    taxable = gross - disc_amt
    vat_amt = (taxable * Decimal(str(vat)) / 100).quantize(Decimal("0.01"))
    return gross, disc_amt, taxable, vat_amt, taxable + vat_amt


def _vat(line: dict, default: int = 15) -> float:
    """يقرأ vat_rate من السطر — يقبل 0 كقيمة صحيحة، يرجع default فقط لو مفقود نهائياً."""
    v = line.get("vat_rate")
    if v is None:
        return default
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _disc(line: dict) -> float:
    """يقرأ discount_pct — يقبل 0 كقيمة صحيحة."""
    v = line.get("discount_pct")
    if v is None:
        return 0
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0


# ─── Vendors ─────────────────────────────────────────────────────────
async def _next_vendor_number(db, tenant_id):
    r = await db.execute(select(func.count(Vendor.id)).where(Vendor.tenant_id == tenant_id))
    return f"VEN-{str((r.scalar() or 0) + 1).zfill(5)}"


async def get_vendors(db: AsyncSession, tenant_id: str, search: str | None = None):
    q = select(Vendor).where(Vendor.tenant_id == tenant_id)
    if search:
        q = q.where(Vendor.name_ar.ilike(f"%{search}%") | Vendor.vendor_number.ilike(f"%{search}%"))
    r = await db.execute(q.order_by(Vendor.vendor_number))
    return r.scalars().all()


async def get_vendor(db: AsyncSession, tenant_id: str, vendor_id: str):
    v = await db.get(Vendor, vendor_id)
    if not v or v.tenant_id != tenant_id:
        raise HTTPException(404, "Vendor not found")
    return v


async def create_vendor(db: AsyncSession, tenant_id: str, data: dict):
    vendor = Vendor(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        vendor_number=await _next_vendor_number(db, tenant_id),
        **{k: v for k, v in data.items() if hasattr(Vendor, k)},
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return vendor


async def update_vendor(db: AsyncSession, tenant_id: str, vendor_id: str, data: dict):
    vendor = await get_vendor(db, tenant_id, vendor_id)
    for k, v in data.items():
        if hasattr(vendor, k) and v is not None:
            setattr(vendor, k, v)
    await db.commit()
    await db.refresh(vendor)
    return vendor


# ─── Purchase Orders ─────────────────────────────────────────────────
async def _next_po_number(db, tenant_id):
    r = await db.execute(select(func.count(PurchaseOrder.id)).where(PurchaseOrder.tenant_id == tenant_id))
    return f"PO-{str((r.scalar() or 0) + 1).zfill(5)}"


async def get_purchase_orders(db: AsyncSession, tenant_id: str, status: str | None = None):
    q = select(PurchaseOrder).where(PurchaseOrder.tenant_id == tenant_id)
    if status:
        q = q.where(PurchaseOrder.status == status)
    r = await db.execute(q.order_by(PurchaseOrder.order_date.desc()))
    return r.scalars().all()


async def get_purchase_order(db: AsyncSession, tenant_id: str, order_id: str):
    r = await db.execute(
        select(PurchaseOrder).options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == order_id, PurchaseOrder.tenant_id == tenant_id)
    )
    o = r.scalar_one_or_none()
    if not o:
        raise HTTPException(404, "Purchase order not found")
    return o


async def create_purchase_order(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    order_date = datetime.fromisoformat(data["order_date"]).replace(tzinfo=None)
    expected_date = datetime.fromisoformat(data["expected_date"]).replace(tzinfo=None) if data.get("expected_date") else None

    subtotal = vat_total = grand_total = Decimal("0")
    order_id = str(uuid.uuid4())
    lines_data = []

    for line in data.get("lines", []):
        gross, disc, taxable, vat, tot = _calc(line["quantity"], line["unit_price"], _disc(line), _vat(line))
        subtotal += taxable; vat_total += vat; grand_total += tot
        lines_data.append((line, taxable, vat, tot))

    order = PurchaseOrder(
        id=order_id, tenant_id=tenant_id,
        order_number=await _next_po_number(db, tenant_id),
        vendor_id=data["vendor_id"],
        order_date=order_date, expected_date=expected_date,
        subtotal=subtotal, vat_amount=vat_total, total=grand_total,
        notes=data.get("notes"), delivery_address=data.get("delivery_address"),
        created_by=user_id,
    )
    db.add(order)

    for i, (line, taxable, vat, tot) in enumerate(lines_data):
        db.add(PurchaseOrderLine(
            id=str(uuid.uuid4()), order_id=order_id, line_order=i,
            description_ar=line["description_ar"], description_en=line.get("description_en"),
            quantity=Decimal(str(line["quantity"])), unit=line.get("unit"),
            unit_price=Decimal(str(line["unit_price"])),
            discount_pct=Decimal(str(_disc(line))),
            vat_rate=Decimal(str(_vat(line))),
            subtotal=taxable, vat_amount=vat, total=tot,
        ))

    await db.commit()
    return await get_purchase_order(db, tenant_id, order_id)


async def confirm_purchase_order(db: AsyncSession, tenant_id: str, order_id: str):
    order = await get_purchase_order(db, tenant_id, order_id)
    if order.status != PurchaseOrderStatus.DRAFT:
        raise HTTPException(400, "Only draft orders can be confirmed")
    order.status = PurchaseOrderStatus.CONFIRMED
    await db.commit()
    return order


async def cancel_purchase_order(db: AsyncSession, tenant_id: str, order_id: str):
    order = await get_purchase_order(db, tenant_id, order_id)
    if order.status in (PurchaseOrderStatus.BILLED, PurchaseOrderStatus.CANCELLED):
        raise HTTPException(400, "Cannot cancel this order")
    order.status = PurchaseOrderStatus.CANCELLED
    await db.commit()
    return order


async def convert_order_to_bill(db: AsyncSession, tenant_id: str, user_id: str, order_id: str):
    """تحويل أمر الشراء لفاتورة واردة تلقائياً"""
    order = await get_purchase_order(db, tenant_id, order_id)
    if order.status == PurchaseOrderStatus.CANCELLED:
        raise HTTPException(400, "لا يمكن تحويل أمر ملغي")
    if order.status == PurchaseOrderStatus.BILLED:
        raise HTTPException(400, "تم إنشاء فاتورة لهذا الأمر مسبقاً")

    lines_r = await db.execute(
        select(PurchaseOrderLine).where(PurchaseOrderLine.order_id == order_id)
    )
    lines = lines_r.scalars().all()

    bill_data = {
        "vendor_id": order.vendor_id,
        "bill_date": datetime.utcnow().isoformat(),
        "supply_date": datetime.utcnow().isoformat(),
        "purchase_order_id": order_id,
        "notes": order.notes,
        "lines": [
            {
                "description_ar": l.description_ar,
                "description_en": l.description_en,
                "quantity": float(l.quantity),
                "unit": l.unit,
                "unit_price": float(l.unit_price),
                "discount_pct": float(l.discount_pct),
                "vat_rate": float(l.vat_rate),
            }
            for l in lines
        ],
    }

    bill = await create_bill(db, tenant_id, user_id, bill_data)
    order.status = PurchaseOrderStatus.BILLED
    await db.commit()
    return bill


# ─── Bills ───────────────────────────────────────────────────────────
async def _next_bill_number(db, tenant_id):
    r = await db.execute(select(func.count(Bill.id)).where(Bill.tenant_id == tenant_id))
    return f"BILL-{str((r.scalar() or 0) + 1).zfill(5)}"


async def get_bills(db: AsyncSession, tenant_id: str, status: str | None = None, vendor_id: str | None = None):
    q = select(Bill).options(selectinload(Bill.lines), selectinload(Bill.payments)).where(Bill.tenant_id == tenant_id)
    if status:
        q = q.where(Bill.status == status)
    if vendor_id:
        q = q.where(Bill.vendor_id == vendor_id)
    r = await db.execute(q.order_by(Bill.bill_date.desc()))
    return r.scalars().all()


async def get_bill(db: AsyncSession, tenant_id: str, bill_id: str):
    r = await db.execute(
        select(Bill).options(selectinload(Bill.lines), selectinload(Bill.payments))
        .where(Bill.id == bill_id, Bill.tenant_id == tenant_id)
    )
    b = r.scalar_one_or_none()
    if not b:
        raise HTTPException(404, "Bill not found")
    return b


async def create_bill(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    """
    إنشاء فاتورة مشتريات جديدة.
    - vendor اختياري — إذا لم يُحدَّد تُحفظ الفاتورة بدون snapshot مورد
    - للسيريالات: unit_price = تكلفة الشراء، sale_price لكل سيريال منفصل داخل new_serial_numbers
    - الكمية في السطر = عدد السيريالات الفعلي (len(new_serial_numbers))
    """
    vendor = None
    if data.get("vendor_id"):
        vendor = await get_vendor(db, tenant_id, data["vendor_id"])

    bill_date   = datetime.fromisoformat(data["bill_date"]).replace(tzinfo=None)
    supply_date = datetime.fromisoformat(data["supply_date"]).replace(tzinfo=None)
    due_date    = datetime.fromisoformat(data["due_date"]).replace(tzinfo=None) if data.get("due_date") else None

    gross_total = disc_total = taxable_total = vat_total = grand_total = Decimal("0")
    bill_id = str(uuid.uuid4())
    lines_data: list = []

    for line in data.get("lines", []):
        # الكمية الفعلية: عدد السيريالات إذا وُجدت، وإلا الكمية المُدخلة
        new_serials: list | None = line.get("new_serial_numbers")
        qty = len(new_serials) if new_serials else line["quantity"]

        gross, disc, taxable, vat, tot = _calc(
            qty, line["unit_price"],
            _disc(line), _vat(line),
        )
        gross_total   += gross
        disc_total    += disc
        taxable_total += taxable
        vat_total     += vat
        grand_total   += tot
        lines_data.append((line, qty, gross, disc, taxable, vat, tot))

    # ── snapshot بيانات المورد ────────────────────────────────────────
    if vendor:
        vendor_address = "، ".join(
            p for p in [
                vendor.address_building, vendor.address_street,
                vendor.address_district, vendor.address_city, vendor.address_postal,
            ] if p
        )
        vendor_name_ar    = vendor.name_ar
        vendor_vat_number = vendor.vat_number
        vendor_cr_number  = vendor.cr_number
    else:
        vendor_address    = None
        vendor_name_ar    = None
        vendor_vat_number = None
        vendor_cr_number  = None

    bill = Bill(
        id=bill_id, tenant_id=tenant_id,
        bill_number=await _next_bill_number(db, tenant_id),
        vendor_invoice_number=data.get("vendor_invoice_number") or None,
        vendor_id=data.get("vendor_id") or None,
        bill_date=bill_date, supply_date=supply_date, due_date=due_date,
        vendor_name_ar=vendor_name_ar,
        vendor_vat_number=vendor_vat_number,
        vendor_cr_number=vendor_cr_number,
        vendor_address=vendor_address,
        # gross_total = الإجمالي قبل الخصم
        subtotal=gross_total,
        discount_amount=disc_total,
        taxable_amount=taxable_total,
        vat_amount=vat_total,
        total=grand_total,
        purchase_order_id=data.get("purchase_order_id") or None,
        fiscal_year_id=data.get("fiscal_year_id") or None,
        warehouse_id=data.get("warehouse_id") or None,
        notes=data.get("notes") or None,
        created_by=user_id,
    )
    db.add(bill)

    for i, (line, qty, gross, disc, taxable, vat, tot) in enumerate(lines_data):
        new_serials = line.get("new_serial_numbers")
        new_serials_json = json.dumps(new_serials, ensure_ascii=False) if new_serials else None

        db.add(BillLine(
            id=str(uuid.uuid4()), bill_id=bill_id, line_order=i,
            description_ar=line["description_ar"],
            description_en=line.get("description_en"),
            quantity=Decimal(str(qty)),
            unit=line.get("unit"),
            # unit_price = تكلفة الشراء (cost_price) — لا يُخلط مع sale_price السيريال
            unit_price=Decimal(str(line["unit_price"])),
            discount_pct=Decimal(str(_disc(line))),
            discount_amount=disc,
            vat_rate=Decimal(str(_vat(line))),
            vat_category=line.get("vat_category", "S"),
            subtotal=gross,
            vat_amount=vat,
            total=tot,
            inventory_item_id=line.get("inventory_item_id") or None,
            serial_item_id=line.get("serial_item_id") or None,
            # سيريالات جماعية — الطريقة المعتمدة
            # كل عنصر: {"serial_number": str, "condition": str, "sale_price": float|null}
            new_serial_numbers_json=new_serials_json,
            # تشغيلة (صيدلية)
            batch_number=line.get("batch_number") or None,
            batch_expiry_date=line.get("batch_expiry_date") or None,
        ))

    await db.commit()
    return await get_bill(db, tenant_id, bill_id)


async def confirm_bill(db: AsyncSession, tenant_id: str, user_id: str, bill_id: str):
    """تأكيد الفاتورة الواردة وإنشاء القيد المحاسبي + إضافة للمخزون"""
    bill = await get_bill(db, tenant_id, bill_id)
    if bill.status != BillStatus.DRAFT:
        raise HTTPException(400, "Only draft bills can be confirmed")

    if bill.fiscal_year_id:
        journal_id = await _create_bill_journal(db, tenant_id, user_id, bill)
        bill.journal_entry_id = journal_id

    # ── إضافة المخزون لكل سطر مرتبط بصنف ──────────────────────────
    await _add_inventory_for_bill(db, tenant_id, user_id, bill)

    bill.status = BillStatus.CONFIRMED
    await db.commit()
    return await get_bill(db, tenant_id, bill_id)


async def _add_inventory_for_bill(
    db: AsyncSession, tenant_id: str, user_id: str, bill: Bill
):
    """
    إضافة المخزون عند تأكيد فاتورة المشتريات.

    للسيريالات:
        - cost_price = line.unit_price  (تكلفة الشراء المُدخلة في الفاتورة)
        - sale_price = القيمة المُدخلة لكل سيريال في new_serial_numbers_json
          (منفصلة تماماً — يمكن تركها None إذا لم تُحدَّد بعد)

    للكمية العادية / التشغيلة:
        - unit_cost = line.unit_price
    """
    from app.modules.inventory.service import add_serial, add_stock, add_batch
    from app.models.inventory import InventoryItem

    wh_id = bill.warehouse_id or None

    lines_r = await db.execute(
        select(BillLine).where(BillLine.bill_id == bill.id)
    )
    lines = lines_r.scalars().all()

    for line in lines:
        if not line.inventory_item_id:
            continue  # سطر نصي حر — بدون مخزون

        # ── سيريالات جماعية (JSON) ────────────────────────────────
        if line.new_serial_numbers_json:
            entries: list = json.loads(line.new_serial_numbers_json)
            for entry in entries:
                if isinstance(entry, str):
                    sn        = entry
                    condition = "new"
                    sale_price_raw = None
                else:
                    sn             = entry.get("serial_number", "").strip()
                    condition      = entry.get("condition") or "new"
                    sale_price_raw = entry.get("sale_price")

                if not sn:
                    continue

                sale_price = (
                    Decimal(str(sale_price_raw))
                    if sale_price_raw is not None and sale_price_raw != 0
                    else None
                )

                try:
                    await add_serial(
                        db=db, tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        serial_number=sn,
                        condition=condition,
                        cost_price=line.unit_price,
                        sale_price=sale_price,
                        purchase_bill_id=bill.id,
                        warehouse_id=wh_id,
                        auto_commit=False,
                    )
                except HTTPException as e:
                    raise HTTPException(400, f"خطأ في إضافة السيريال {sn}: {e.detail}")

            # add_serial يهيّئ بطاقة الصنف من أول سيريال فقط عند غياب الأسعار،
            # ثم يجعل كل السيريالات الجديدة ترث السعر الموحد من البطاقة.

        # ── بدون سيريالات — كمية عادية أو تشغيلة ─────────────────
        else:
            item = await db.get(InventoryItem, line.inventory_item_id)
            if not item:
                continue

            if item.tracking_type == "batch":
                batch_number = line.batch_number or f"BILL-{bill.bill_number}"
                try:
                    await add_batch(
                        db=db, tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        batch_number=batch_number,
                        quantity=line.quantity,
                        cost_price=line.unit_price,
                        expiry_date=line.batch_expiry_date,
                        purchase_bill_id=bill.id,
                        warehouse_id=wh_id,
                        auto_commit=False,
                    )
                except HTTPException as e:
                    raise HTTPException(400, f"خطأ في إضافة التشغيلة: {e.detail}")
            else:
                try:
                    await add_stock(
                        db=db, tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        quantity=line.quantity,
                        unit_cost=line.unit_price,
                        reference_type="bill",
                        reference_id=bill.id,
                        user_id=user_id,
                        warehouse_id=wh_id,
                        auto_commit=False,
                    )
                except HTTPException as e:
                    raise HTTPException(400, f"خطأ في إضافة المخزون: {e.detail}")


async def _create_bill_journal(db, tenant_id, user_id, bill: Bill):
    """
    قيد الفاتورة الواردة:
    مدين: حساب المخزون/المصروف (المبلغ قبل الضريبة) + ضريبة المدخلات
    دائن: حسابات الدائنين (المورد) — الإجمالي شامل الضريبة
    """
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus, Account, AccountType
    from app.modules.accounting.service import _next_entry_number, get_vat_settings

    vendor = await db.get(Vendor, bill.vendor_id)
    ap_account_id = vendor.ap_account_id if vendor else None
    if not ap_account_id:
        return None

    vat_settings = await get_vat_settings(db, tenant_id)

    # جلب أول حساب مصروف/أصل متاح للـ tenant (مخزون أو مصروف)
    expense_r = await db.execute(
        select(Account).where(
            Account.tenant_id == tenant_id,
            Account.account_type.in_([AccountType.EXPENSE, AccountType.ASSET]),
            Account.is_active == True,
            Account.is_posting == True,
        ).order_by(Account.code).limit(1)
    )
    expense_account = expense_r.scalar_one_or_none()
    expense_account_id = expense_account.id if expense_account else ap_account_id  # fallback

    entry_number = await _next_entry_number(db, tenant_id)

    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=bill.bill_date,
        fiscal_year_id=bill.fiscal_year_id,
        description_ar=f"فاتورة مشتريات: {bill.bill_number} - {bill.vendor_name_ar}",
        status=JournalEntryStatus.POSTED,
        source="purchase_bill",
        reference=bill.bill_number,
        total_debit=bill.total,
        total_credit=bill.total,
        created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow(),
    )
    db.add(entry)

    line_order = 0

    # مدين: المصروف/المخزون (المبلغ قبل الضريبة)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=expense_account_id,
        description=f"مشتريات — فاتورة {bill.bill_number}",
        debit=bill.taxable_amount, credit=Decimal("0"), line_order=line_order,
    ))
    line_order += 1

    # مدين: ضريبة المدخلات
    if bill.vat_amount > 0 and vat_settings and vat_settings.vat_account_id:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=vat_settings.vat_account_id,
            description="ضريبة القيمة المضافة — مدخلات",
            debit=bill.vat_amount, credit=Decimal("0"), line_order=line_order,
        ))
        line_order += 1

    # دائن: حسابات الدائنين (الإجمالي شامل الضريبة)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=ap_account_id,
        description=f"مستحقات {bill.vendor_name_ar}",
        debit=Decimal("0"), credit=bill.total, line_order=line_order,
    ))

    return entry.id


async def _reverse_bill_inventory(
    db: AsyncSession, tenant_id: str, user_id: str, bill: Bill
):
    """
    عكس المخزون لفاتورة مؤكدة قبل تعديل أسطرها.
    - للسيريالات: يحذف SerialItem المرتبط بالفاتورة ويُسجّل حركة عكسية.
    - للكميات العادية والتشغيلات: يُسجّل حركة خروج عكسية بنفس الكمية.
    """
    from app.models.inventory import (
        SerialItem, StockMovement, InventoryItem, InventoryStock,
        BatchItem, MovementType,
    )

    lines_r = await db.execute(
        select(BillLine).where(BillLine.bill_id == bill.id)
    )
    old_lines = lines_r.scalars().all()
    wh_id = bill.warehouse_id

    for line in old_lines:
        if not line.inventory_item_id:
            continue

        # ── عكس السيريالات الجماعية ────────────────────────────────
        if line.new_serial_numbers_json:
            entries: list = json.loads(line.new_serial_numbers_json)
            for entry in entries:
                sn = entry if isinstance(entry, str) else entry.get("serial_number", "").strip()
                if not sn:
                    continue
                # احذف SerialItem المرتبط بهذه الفاتورة + هذا الرقم
                serial_r = await db.execute(
                    select(SerialItem).where(
                        SerialItem.product_id == line.inventory_item_id,
                        SerialItem.serial_number == sn,
                        SerialItem.purchase_bill_id == bill.id,
                    )
                )
                serial = serial_r.scalar_one_or_none()
                if serial:
                    db.add(StockMovement(
                        id=str(uuid.uuid4()), tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        warehouse_id=wh_id,
                        movement_type=MovementType.PURCHASE_EDIT_REV,
                        quantity=Decimal("-1"),
                        unit_cost=line.unit_price,
                        reference_type="bill_edit",
                        reference_id=bill.id,
                        notes=f"عكس عند تعديل الفاتورة — سيريال {sn}",
                        created_by=user_id,
                    ))
                    await db.delete(serial)

        # ── عكس كمية عادية أو تشغيلة ──────────────────────────────
        else:
            item = await db.get(InventoryItem, line.inventory_item_id)
            if not item:
                continue

            qty = Decimal(str(line.quantity))

            if item.tracking_type == "batch" and line.batch_number:
                batch_r = await db.execute(
                    select(BatchItem).where(
                        BatchItem.product_id == line.inventory_item_id,
                        BatchItem.batch_number == line.batch_number,
                        BatchItem.purchase_bill_id == bill.id,
                    )
                )
                batch = batch_r.scalar_one_or_none()
                if batch:
                    db.add(StockMovement(
                        id=str(uuid.uuid4()), tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        warehouse_id=wh_id,
                        movement_type=MovementType.PURCHASE_EDIT_REV,
                        quantity=-qty,
                        unit_cost=line.unit_price,
                        reference_type="bill_edit",
                        reference_id=bill.id,
                        notes=f"عكس عند تعديل الفاتورة — تشغيلة {line.batch_number}",
                        created_by=user_id,
                    ))
                    batch.quantity = max(Decimal("0"), batch.quantity - qty)
                    if batch.quantity == 0:
                        await db.delete(batch)

            elif item.tracking_type != "serial":
                # كمية عادية — خصم من InventoryStock
                stock_r = await db.execute(
                    select(InventoryStock).where(
                        InventoryStock.item_id == line.inventory_item_id,
                        InventoryStock.warehouse_id == wh_id,
                    )
                )
                stock_row = stock_r.scalar_one_or_none()
                if stock_row:
                    stock_row.quantity = max(Decimal("0"), stock_row.quantity - qty)

                db.add(StockMovement(
                    id=str(uuid.uuid4()), tenant_id=tenant_id,
                    product_id=line.inventory_item_id,
                    warehouse_id=wh_id,
                    movement_type=MovementType.PURCHASE_EDIT_REV,
                    quantity=-qty,
                    unit_cost=line.unit_price,
                    reference_type="bill_edit",
                    reference_id=bill.id,
                    notes="عكس عند تعديل الفاتورة",
                    created_by=user_id,
                ))


async def update_bill(db: AsyncSession, tenant_id: str, user_id: str, bill_id: str, data: dict):
    """
    تعديل فاتورة المشتريات — يعمل كإعادة إنشاء كاملة للأسطر.
    - للفاتورة المؤكدة: يعكس المخزون القديم أولاً ثم يُضيف الجديد.
    - للمسودة: تعديل مباشر بدون أثر على المخزون.
    """
    from sqlalchemy import delete as sql_delete

    r = await db.execute(
        select(Bill).options(selectinload(Bill.lines))
        .where(Bill.id == bill_id, Bill.tenant_id == tenant_id)
    )
    bill = r.scalar_one_or_none()
    if not bill:
        raise HTTPException(404, "Bill not found")
    if bill.status == BillStatus.CANCELLED:
        raise HTTPException(400, "لا يمكن تعديل فاتورة ملغاة")

    is_confirmed = bill.status in (
        BillStatus.CONFIRMED, BillStatus.PARTIAL, BillStatus.PAID
    )

    # ── حقول رأس الفاتورة ─────────────────────────────────────────
    if "vendor_id" in data:
        bill.vendor_id = data["vendor_id"] or None
        if data.get("vendor_id"):
            vendor = await get_vendor(db, tenant_id, data["vendor_id"])
            bill.vendor_name_ar    = vendor.name_ar
            bill.vendor_vat_number = vendor.vat_number
            bill.vendor_cr_number  = vendor.cr_number
        else:
            bill.vendor_name_ar    = None
            bill.vendor_vat_number = None
            bill.vendor_cr_number  = None

    if "vendor_invoice_number" in data:
        bill.vendor_invoice_number = data["vendor_invoice_number"] or None
    if "notes" in data:
        bill.notes = data["notes"] or None
    if "warehouse_id" in data:
        bill.warehouse_id = data["warehouse_id"] or None
    if data.get("bill_date"):
        bill.bill_date = datetime.fromisoformat(data["bill_date"]).replace(tzinfo=None)
    if data.get("supply_date"):
        bill.supply_date = datetime.fromisoformat(data["supply_date"]).replace(tzinfo=None)
    if "due_date" in data:
        bill.due_date = datetime.fromisoformat(data["due_date"]).replace(tzinfo=None) if data["due_date"] else None

    # ── تعديل الأسطر ──────────────────────────────────────────────
    if "lines" in data:

        # 1) عكس المخزون القديم للفواتير المؤكدة
        if is_confirmed:
            await _reverse_bill_inventory(db, tenant_id, user_id, bill)

        # 2) حذف الأسطر القديمة وإنشاء الجديدة
        await db.execute(sql_delete(BillLine).where(BillLine.bill_id == bill_id))

        gross_total = disc_total = taxable_total = vat_total = grand_total = Decimal("0")
        new_lines_data: list = []

        for i, line in enumerate(data.get("lines", [])):
            new_serials: list | None = line.get("new_serial_numbers")
            qty = len(new_serials) if new_serials else line["quantity"]

            gross, disc, taxable, vat, tot = _calc(
                qty, line["unit_price"],
                _disc(line), _vat(line),
            )
            gross_total   += gross
            disc_total    += disc
            taxable_total += taxable
            vat_total     += vat
            grand_total   += tot

            new_serials_json = json.dumps(new_serials, ensure_ascii=False) if new_serials else None

            new_line = BillLine(
                id=str(uuid.uuid4()), bill_id=bill_id, line_order=i,
                description_ar=line["description_ar"],
                description_en=line.get("description_en"),
                quantity=Decimal(str(qty)),
                unit=line.get("unit"),
                unit_price=Decimal(str(line["unit_price"])),
                discount_pct=Decimal(str(_disc(line))),
                discount_amount=disc,
                vat_rate=Decimal(str(_vat(line))),
                vat_category=line.get("vat_category", "S"),
                subtotal=gross, vat_amount=vat, total=tot,
                inventory_item_id=line.get("inventory_item_id") or None,
                serial_item_id=line.get("serial_item_id") or None,
                new_serial_numbers_json=new_serials_json,
                batch_number=line.get("batch_number") or None,
                batch_expiry_date=line.get("batch_expiry_date") or None,
            )
            db.add(new_line)
            new_lines_data.append(new_line)

        bill.subtotal        = gross_total
        bill.discount_amount = disc_total
        bill.taxable_amount  = taxable_total
        bill.vat_amount      = vat_total
        bill.total           = grand_total

        # 3) أضف المخزون الجديد للفواتير المؤكدة
        if is_confirmed:
            # نحتاج flush أولاً حتى تُحفظ الأسطر الجديدة في الـ session
            await db.flush()
            # حدّث bill.lines مؤقتاً للـ _add_inventory_for_bill
            bill.lines = new_lines_data
            await _add_inventory_for_bill(db, tenant_id, user_id, bill)

    await db.commit()
    return await get_bill(db, tenant_id, bill_id)


async def cancel_bill(db: AsyncSession, tenant_id: str, bill_id: str):
    bill = await get_bill(db, tenant_id, bill_id)
    if bill.status in (BillStatus.PAID, BillStatus.CANCELLED):
        raise HTTPException(400, "Cannot cancel this bill")
    bill.status = BillStatus.CANCELLED
    await db.commit()
    return bill


async def reprocess_bill_inventory(
    db: AsyncSession, tenant_id: str, user_id: str, bill_id: str
):
    """
    إعادة معالجة المخزون لفاتورة مؤكدة — لإصلاح الفواتير القديمة.

    الفرق عن _add_inventory_for_bill:
    - لا يشترط أن تكون الفاتورة draft
    - يتجاوز السيريالات الموجودة مسبقاً بصمت (بدلاً من رمي خطأ)
    - يُسجِّل كل ما تم ويرجعه كتقرير
    """
    from app.modules.inventory.service import add_serial, add_stock, add_batch
    from app.models.inventory import InventoryItem, SerialItem, StockMovement

    bill = await get_bill(db, tenant_id, bill_id)
    if bill.status not in (BillStatus.CONFIRMED, BillStatus.PAID, BillStatus.PARTIAL):
        raise HTTPException(400, "الفاتورة يجب أن تكون مؤكدة أو مدفوعة")

    wh_id = bill.warehouse_id or None

    lines_r = await db.execute(
        select(BillLine).where(BillLine.bill_id == bill.id)
    )
    lines = lines_r.scalars().all()

    added_serials = []
    skipped_serials = []
    added_stock = []
    errors = []

    for line in lines:
        if not line.inventory_item_id:
            continue

        # ── سيريالات جماعية ────────────────────────────────────────
        if line.new_serial_numbers_json:
            entries: list = json.loads(line.new_serial_numbers_json)
            for entry in entries:
                if isinstance(entry, str):
                    sn, condition, sale_price_raw = entry, "new", None
                else:
                    sn             = entry.get("serial_number", "").strip()
                    condition      = entry.get("condition") or "new"
                    sale_price_raw = entry.get("sale_price")

                if not sn:
                    continue

                # تحقق: هل السيريال موجود مسبقاً؟
                existing_r = await db.execute(
                    select(SerialItem).where(
                        SerialItem.product_id == line.inventory_item_id,
                        SerialItem.serial_number == sn,
                    )
                )
                if existing_r.scalar_one_or_none():
                    skipped_serials.append(sn)
                    continue

                sale_price = (
                    Decimal(str(sale_price_raw))
                    if sale_price_raw is not None and sale_price_raw != 0
                    else None
                )

                try:
                    await add_serial(
                        db=db,
                        tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        serial_number=sn,
                        condition=condition,
                        cost_price=line.unit_price,
                        sale_price=sale_price,
                        purchase_bill_id=bill.id,
                        warehouse_id=wh_id,
                        auto_commit=False,
                    )
                    added_serials.append(sn)
                except Exception as e:
                    errors.append(f"سيريال {sn}: {str(e)}")

        # ── كمية عادية أو تشغيلة ──────────────────────────────────
        else:
            item = await db.get(InventoryItem, line.inventory_item_id)
            if not item:
                continue

            # تحقق: هل هناك حركة مخزون مسجلة لهذا السطر من هذه الفاتورة؟
            existing_move_r = await db.execute(
                select(StockMovement).where(
                    StockMovement.reference_type == "bill",
                    StockMovement.reference_id == bill.id,
                    StockMovement.product_id == line.inventory_item_id,
                )
            )
            if existing_move_r.scalar_one_or_none():
                skipped_serials.append(f"{item.name_ar} (موجود)")
                continue

            try:
                if item.tracking_type == "batch":
                    await add_batch(
                        db=db, tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        batch_number=line.batch_number or f"BILL-{bill.bill_number}",
                        quantity=line.quantity,
                        cost_price=line.unit_price,
                        expiry_date=line.batch_expiry_date,
                        purchase_bill_id=bill.id,
                        warehouse_id=wh_id,
                        auto_commit=False,
                    )
                else:
                    await add_stock(
                        db=db, tenant_id=tenant_id,
                        product_id=line.inventory_item_id,
                        quantity=line.quantity,
                        unit_cost=line.unit_price,
                        reference_type="bill",
                        reference_id=bill.id,
                        user_id=user_id,
                        warehouse_id=wh_id,
                        auto_commit=False,
                    )
                added_stock.append(item.name_ar)
            except Exception as e:
                errors.append(f"{item.name_ar}: {str(e)}")

    await db.commit()

    return {
        "bill_id": bill_id,
        "bill_number": bill.bill_number,
        "added_serials": added_serials,
        "added_serials_count": len(added_serials),
        "skipped_serials": skipped_serials,
        "skipped_count": len(skipped_serials),
        "added_stock_items": added_stock,
        "errors": errors,
        "status": "completed" if not errors else "completed_with_errors",
    }


async def get_bill_serials(
    db: AsyncSession, tenant_id: str, bill_id: str, product_id: str | None = None
):
    """جلب السيريالات المرتبطة بفاتورة مشتريات — للاستخدام في المرتجع"""
    from app.models.inventory import SerialItem

    await get_bill(db, tenant_id, bill_id)  # تحقق من الملكية

    lines_r = await db.execute(
        select(BillLine).where(BillLine.bill_id == bill_id)
    )
    lines = lines_r.scalars().all()

    result = []
    for line in lines:
        if product_id and line.inventory_item_id != product_id:
            continue
        if not line.new_serial_numbers_json:
            continue

        entries: list = json.loads(line.new_serial_numbers_json)
        for entry in entries:
            sn = entry.get("serial_number") if isinstance(entry, dict) else entry
            if not sn:
                continue
            serial_r = await db.execute(
                select(SerialItem).where(
                    SerialItem.product_id == line.inventory_item_id,
                    SerialItem.serial_number == sn,
                )
            )
            serial = serial_r.scalar_one_or_none()
            if serial:
                result.append({
                    "id": serial.id,
                    "serial_number": serial.serial_number,
                    "condition": serial.condition,
                    "status": serial.status,
                    "cost_price": float(serial.cost_price),
                    "sale_price": float(serial.sale_price) if serial.sale_price else None,
                    "product_id": serial.product_id,
                })

    return result


async def create_bill_payment(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    bill = await get_bill(db, tenant_id, data["bill_id"])
    if bill.status == BillStatus.CANCELLED:
        raise HTTPException(400, "Cannot pay a cancelled bill")

    payment_date = datetime.fromisoformat(data["payment_date"]).replace(tzinfo=None)
    r = await db.execute(select(func.count(BillPayment.id)).where(BillPayment.tenant_id == tenant_id))
    pay_num = f"BP-{str((r.scalar() or 0) + 1).zfill(5)}"

    payment = BillPayment(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        payment_number=pay_num,
        bill_id=data["bill_id"], vendor_id=bill.vendor_id,
        payment_date=payment_date,
        amount=Decimal(str(data["amount"])),
        payment_method=data.get("payment_method", "bank_transfer"),
        reference=data.get("reference"),
        bank_account_id=data.get("bank_account_id"),
        notes=data.get("notes"),
        created_by=user_id,
    )
    db.add(payment)

    bill.paid_amount += Decimal(str(data["amount"]))
    remaining = bill.total - bill.paid_amount
    if remaining <= Decimal("0.01"):
        bill.status = BillStatus.PAID
    elif bill.paid_amount > 0:
        bill.status = BillStatus.PARTIAL

    # ── إنشاء سند صرف تلقائي في الخزينة ──────────────────────────
    if bill.fiscal_year_id and data.get("ap_account_id") and data.get("bank_account_id"):
        voucher_id = await _create_payment_voucher(db, tenant_id, user_id, payment, bill, data)
        payment.journal_entry_id = voucher_id  # نحفظ رقم السند

    await db.commit()
    await db.refresh(payment)
    return payment


async def _create_payment_voucher(
    db, tenant_id: str, user_id: str,
    payment: BillPayment, bill: Bill, data: dict
) -> str | None:
    """
    إنشاء سند صرف تلقائي عند دفع فاتورة مورد:
    مدين: حسابات الدائنين (المورد)
    دائن: البنك / الصندوق
    """
    from app.models.treasury import Voucher, VoucherType, VoucherStatus
    from app.modules.treasury.service import _create_voucher_journal

    # نحتاج حساب الدائنين من المورد
    vendor = await db.get(Vendor, bill.vendor_id)
    ap_account_id = data.get("ap_account_id") or (vendor.ap_account_id if vendor else None)
    if not ap_account_id:
        return None

    # حساب البنك من الحساب البنكي المختار
    bank_gl_account_id = None
    if data.get("bank_account_id"):
        from app.models.accounting import BankAccount
        bank = await db.get(BankAccount, data["bank_account_id"])
        if bank and bank.gl_account_id:
            bank_gl_account_id = bank.gl_account_id

    if not bank_gl_account_id:
        return None

    from app.modules.treasury.service import _next_number
    voucher_num = await _next_number(db, tenant_id, VoucherType.PAYMENT)

    voucher = Voucher(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        voucher_number=voucher_num,
        voucher_type=VoucherType.PAYMENT,
        status=VoucherStatus.POSTED,
        voucher_date=payment.payment_date,
        amount=payment.amount,
        vat_amount=Decimal("0"),
        currency_code="SAR",
        payment_method=payment.payment_method,
        bank_account_id=data.get("bank_account_id"),
        party_type="vendor",
        party_id=str(bill.vendor_id),
        party_name=bill.vendor_name_ar,
        debit_account_id=ap_account_id,    # مدين: حسابات الدائنين
        credit_account_id=bank_gl_account_id,  # دائن: البنك
        fiscal_year_id=bill.fiscal_year_id,
        description_ar=f"دفعة للمورد: {bill.vendor_name_ar} — فاتورة {bill.bill_number}",
        reference=payment.payment_number,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(voucher)

    # إنشاء القيد المحاسبي
    journal_id = await _create_voucher_journal(db, tenant_id, user_id, voucher)
    voucher.journal_entry_id = journal_id
    return voucher.id


# ─── Debit Notes ─────────────────────────────────────────────────────
async def get_debit_notes(db: AsyncSession, tenant_id: str):
    r = await db.execute(
        select(DebitNote).options(selectinload(DebitNote.lines))
        .where(DebitNote.tenant_id == tenant_id).order_by(DebitNote.issue_date.desc())
    )
    return r.scalars().all()


async def create_debit_note(db: AsyncSession, tenant_id: str, user_id: str, data: dict):
    bill = await get_bill(db, tenant_id, data["original_bill_id"])
    issue_date = datetime.fromisoformat(data["issue_date"]).replace(tzinfo=None)

    subtotal = vat_total = grand_total = Decimal("0")
    dn_id = str(uuid.uuid4())
    lines_data = []

    for line in data.get("lines", []):
        _, _, taxable, vat, tot = _calc(line["quantity"], line["unit_price"], 0, _vat(line))
        subtotal += taxable; vat_total += vat; grand_total += tot
        lines_data.append((line, taxable, vat, tot))

    r = await db.execute(select(func.count(DebitNote.id)).where(DebitNote.tenant_id == tenant_id))
    dn_num = f"DN-{str((r.scalar() or 0) + 1).zfill(5)}"

    dn = DebitNote(
        id=dn_id, tenant_id=tenant_id,
        debit_note_number=dn_num,
        original_bill_id=data["original_bill_id"],
        vendor_id=bill.vendor_id,
        issue_date=issue_date, reason=data["reason"],
        subtotal=subtotal, vat_amount=vat_total, total=grand_total,
        created_by=user_id,
    )
    db.add(dn)

    for i, (line, taxable, vat, tot) in enumerate(lines_data):
        serial_ids = line.get("serial_ids")
        serial_ids_json = json.dumps(serial_ids, ensure_ascii=False) if serial_ids else None
        # إذا سيريالات → الكمية = عددها
        qty_val = len(serial_ids) if serial_ids else line["quantity"]

        db.add(DebitNoteLine(
            id=str(uuid.uuid4()), debit_note_id=dn_id, line_order=i,
            description_ar=line["description_ar"],
            quantity=Decimal(str(qty_val)),
            unit_price=Decimal(str(line["unit_price"])),
            vat_rate=Decimal(str(_vat(line))),
            subtotal=taxable, vat_amount=vat, total=tot,
            inventory_item_id=line.get("inventory_item_id"),
            serial_ids_json=serial_ids_json,
        ))

    await db.commit()

    # ── إرجاع السيريالات للمخزون عند إنشاء المرتجع ──────────────
    await _return_inventory_for_debit_note(db, tenant_id, dn)

    # ── قيد محاسبي لإشعار المدين (مرتجع مشتريات) ──────────────────
    await _create_debit_note_journal(db, tenant_id, user_id, dn, bill)
    await db.commit()

    return dn


async def _return_inventory_for_debit_note(db: AsyncSession, tenant_id: str, dn):
    """إرجاع السيريالات للمخزون عند إنشاء مرتجع مشتريات"""
    from app.models.inventory import SerialItem, StockMovement, MovementType

    lines_r = await db.execute(
        select(DebitNoteLine).where(DebitNoteLine.debit_note_id == dn.id)
    )
    lines = lines_r.scalars().all()

    for line in lines:
        if not line.serial_ids_json:
            continue
        serial_ids = json.loads(line.serial_ids_json)
        for sid in serial_ids:
            serial = await db.get(SerialItem, sid)
            if not serial:
                continue
            # إرجاع الحالة لـ in_stock
            serial.status = "in_stock"
            # حركة مخزون (مرتجع وارد)
            db.add(StockMovement(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                product_id=serial.product_id,
                warehouse_id=serial.warehouse_id,
                movement_type=MovementType.RETURN_IN,
                quantity=Decimal("1"),
                unit_cost=serial.cost_price,
                reference_type="debit_note",
                reference_id=str(dn.id),
                notes=f"مرتجع مشتريات: {dn.debit_note_number}",
            ))


async def _create_debit_note_journal(db, tenant_id: str, user_id: str, dn, bill):
    """
    قيد مرتجع المشتريات (إشعار مدين):
    مدين: حسابات الدائنين (تخفيض ما ندين به للمورد)
    دائن: حساب المصروف/الأصل (عكس الشراء)
    دائن: ضريبة المدخلات (استرداد)
    """
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import _next_entry_number, get_vat_settings

    vendor = await db.get(Vendor, dn.vendor_id)
    ap_account_id = vendor.ap_account_id if vendor else None
    if not ap_account_id:
        return

    vat_settings = await get_vat_settings(db, tenant_id)
    entry_number = await _next_entry_number(db, tenant_id)

    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=dn.issue_date,
        fiscal_year_id=bill.fiscal_year_id if bill else None,
        description_ar=f"إشعار مدين (مرتجع مشتريات): {dn.debit_note_number}",
        description_en=f"Debit Note (Purchase Return): {dn.debit_note_number}",
        status=JournalEntryStatus.POSTED,
        source="debit_note",
        reference=dn.debit_note_number,
        total_debit=dn.total,
        total_credit=dn.total,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(entry)

    # مدين: حسابات الدائنين (تخفيض الدين للمورد)
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=ap_account_id,
        description=f"مرتجع مشتريات — {dn.debit_note_number}",
        debit=dn.total, credit=Decimal("0"), line_order=0,
    ))

    # دائن: ضريبة المدخلات (استرداد)
    if dn.vat_amount > 0 and vat_settings and vat_settings.vat_account_id:
        db.add(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=vat_settings.vat_account_id,
            description="استرداد ضريبة المدخلات — مرتجع",
            debit=Decimal("0"), credit=dn.vat_amount, line_order=1,
        ))


# ─── Summary ─────────────────────────────────────────────────────────
async def get_purchases_summary(db: AsyncSession, tenant_id: str):
    bills_r = await db.execute(select(Bill).where(Bill.tenant_id == tenant_id))
    bills = bills_r.scalars().all()

    total_billed = sum(b.total for b in bills if b.status != BillStatus.CANCELLED)
    total_paid = sum(b.paid_amount for b in bills)
    total_outstanding = total_billed - total_paid

    return {
        "total_billed": float(total_billed),
        "total_paid": float(total_paid),
        "total_outstanding": float(total_outstanding),
        "bill_count": len(bills),
        "draft_count": sum(1 for b in bills if b.status == BillStatus.DRAFT),
    }


# ─── Vendor Statement ─────────────────────────────────────────────────
async def get_vendor_statement(db: AsyncSession, tenant_id: str, vendor_id: str,
                                from_date: datetime, to_date: datetime):
    """كشف حساب المورد الكامل"""
    from_date = from_date.replace(tzinfo=None)
    to_date = to_date.replace(tzinfo=None)

    vendor = await get_vendor(db, tenant_id, vendor_id)

    # الفواتير الواردة
    bill_r = await db.execute(
        select(Bill).where(
            Bill.tenant_id == tenant_id,
            Bill.vendor_id == vendor_id,
            Bill.bill_date >= from_date,
            Bill.bill_date <= to_date,
            Bill.status != BillStatus.CANCELLED,
        ).order_by(Bill.bill_date)
    )
    bills = bill_r.scalars().all()

    # المدفوعات
    pay_r = await db.execute(
        select(BillPayment).where(
            BillPayment.tenant_id == tenant_id,
            BillPayment.vendor_id == vendor_id,
            BillPayment.payment_date >= from_date,
            BillPayment.payment_date <= to_date,
        ).order_by(BillPayment.payment_date)
    )
    payments = pay_r.scalars().all()

    # بناء الحركات مرتبة بالتاريخ
    transactions = []
    for bill in bills:
        transactions.append({
            "date": bill.bill_date,
            "type": "bill",
            "reference": bill.bill_number,
            "description_ar": f"فاتورة مشتريات — {bill.vendor_name_ar}",
            "description_en": f"Purchase Bill — {bill.vendor_name_ar}",
            "debit": 0.0,
            "credit": float(bill.total),   # دائن: مستحق للمورد
        })
    for pay in payments:
        transactions.append({
            "date": pay.payment_date,
            "type": "payment",
            "reference": pay.payment_number,
            "description_ar": f"سند صرف — {pay.payment_method}",
            "description_en": f"Payment Voucher — {pay.payment_method}",
            "debit": float(pay.amount),    # مدين: دفعنا للمورد
            "credit": 0.0,
        })

    transactions.sort(key=lambda x: x["date"])
    balance = 0.0
    for t in transactions:
        # الرصيد = المستحق للمورد (دائن) - المدفوع (مدين)
        balance += t["credit"] - t["debit"]
        t["balance"] = round(balance, 2)
        t["date"] = t["date"].isoformat()

    total_billed = sum(float(b.total) for b in bills)
    total_paid = sum(float(p.amount) for p in payments)

    return {
        "vendor": {
            "id": vendor.id,
            "vendor_number": vendor.vendor_number,
            "name_ar": vendor.name_ar,
            "name_en": vendor.name_en,
            "vat_number": vendor.vat_number,
            "phone": vendor.phone,
            "address_city": vendor.address_city,
        },
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "transactions": transactions,
        "summary": {
            "total_billed": round(total_billed, 2),
            "total_paid": round(total_paid, 2),
            "closing_balance": round(total_billed - total_paid, 2),
        }
    }
