import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.assets import Asset, AssetCategory, DepreciationLine, AssetStatus, DepreciationMethod
from app.modules.assets.schemas import (
    AssetCategoryCreate, AssetCreate, AssetUpdate,
    AssetDisposalRequest, DepreciationRunRequest
)


# ─── Categories ──────────────────────────────────────────────────────
async def get_categories(db: AsyncSession, tenant_id: str):
    r = await db.execute(select(AssetCategory).where(AssetCategory.tenant_id == tenant_id).order_by(AssetCategory.name_ar))
    return r.scalars().all()


async def create_category(db: AsyncSession, tenant_id: str, data: AssetCategoryCreate):
    cat = AssetCategory(id=str(uuid.uuid4()), tenant_id=tenant_id, **data.model_dump())
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat


# ─── Assets ──────────────────────────────────────────────────────────
async def get_assets(db: AsyncSession, tenant_id: str, status: str | None = None):
    q = select(Asset).where(Asset.tenant_id == tenant_id)
    if status:
        q = q.where(Asset.status == status)
    q = q.order_by(Asset.asset_number)
    r = await db.execute(q)
    return r.scalars().all()


async def get_asset(db: AsyncSession, tenant_id: str, asset_id: str):
    asset = await db.get(Asset, asset_id)
    if not asset or asset.tenant_id != tenant_id:
        raise HTTPException(404, "Asset not found")
    return asset


async def create_asset(db: AsyncSession, tenant_id: str, data: AssetCreate):
    # Check asset number uniqueness
    existing = await db.execute(
        select(Asset).where(Asset.tenant_id == tenant_id, Asset.asset_number == data.asset_number)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Asset number already exists")

    purchase_date = data.purchase_date.replace(tzinfo=None)
    warranty_expiry = data.warranty_expiry.replace(tzinfo=None) if data.warranty_expiry else None

    asset = Asset(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        book_value=data.purchase_cost,  # القيمة الدفترية = تكلفة الشراء في البداية
        purchase_date=purchase_date,
        warranty_expiry=warranty_expiry,
        **{k: v for k, v in data.model_dump().items() if k not in ("purchase_date", "warranty_expiry")},
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


async def update_asset(db: AsyncSession, tenant_id: str, asset_id: str, data: AssetUpdate):
    asset = await get_asset(db, tenant_id, asset_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(asset, k, v)
    await db.commit()
    await db.refresh(asset)
    return asset


# ─── Depreciation Calculation ────────────────────────────────────────
def _calc_monthly_depreciation(asset: Asset) -> Decimal:
    """احتساب الاستهلاك الشهري"""
    depreciable_amount = asset.purchase_cost - asset.salvage_value

    if asset.depreciation_method == DepreciationMethod.STRAIGHT_LINE:
        # القسط الثابت: (التكلفة - القيمة التخريدية) / العمر الإنتاجي / 12
        annual = depreciable_amount / Decimal(str(asset.useful_life_years))
        return (annual / Decimal("12")).quantize(Decimal("0.01"))

    elif asset.depreciation_method == DepreciationMethod.DECLINING_BALANCE:
        # القسط المتناقص: القيمة الدفترية × نسبة الاستهلاك / 12
        monthly_rate = asset.depreciation_rate / Decimal("100") / Decimal("12")
        return (asset.book_value * monthly_rate).quantize(Decimal("0.01"))

    return Decimal("0")


async def run_depreciation(db: AsyncSession, tenant_id: str, user_id: str, data: DepreciationRunRequest):
    """تشغيل الاستهلاك لفترة معينة"""
    period_date = data.period_date.replace(tzinfo=None)

    # جلب الأصول النشطة
    assets_r = await db.execute(
        select(Asset).where(Asset.tenant_id == tenant_id, Asset.status == AssetStatus.ACTIVE)
    )
    assets = assets_r.scalars().all()

    results = []
    for asset in assets:
        # تحقق إذا تم احتساب الاستهلاك لهذه الفترة مسبقاً
        existing = await db.execute(
            select(DepreciationLine).where(
                DepreciationLine.asset_id == asset.id,
                DepreciationLine.period_date == period_date,
            )
        )
        if existing.scalar_one_or_none():
            continue

        # تحقق إذا الأصل مستهلك بالكامل
        if asset.book_value <= asset.salvage_value:
            continue

        # تحقق إذا الأصل اشتري قبل أو في نفس الفترة
        if asset.purchase_date > period_date:
            continue

        dep_amount = _calc_monthly_depreciation(asset)

        # لا تتجاوز القيمة الدفترية المتبقية
        remaining = asset.book_value - asset.salvage_value
        if dep_amount > remaining:
            dep_amount = remaining

        new_accumulated = asset.accumulated_depreciation + dep_amount
        new_book_value = asset.purchase_cost - new_accumulated

        # إنشاء سطر الاستهلاك
        line = DepreciationLine(
            id=str(uuid.uuid4()),
            asset_id=asset.id,
            tenant_id=tenant_id,
            period_date=period_date,
            depreciation_amount=dep_amount,
            accumulated_depreciation=new_accumulated,
            book_value=new_book_value,
        )
        db.add(line)

        # تحديث الأصل
        asset.accumulated_depreciation = new_accumulated
        asset.book_value = new_book_value
        asset.last_depreciation_date = period_date

        # إذا طُلب الترحيل — نولد قيد يومية
        if data.post_entries:
            journal_entry_id = await _create_depreciation_journal(
                db, tenant_id, user_id, asset, dep_amount, period_date, data.fiscal_year_id
            )
            line.journal_entry_id = journal_entry_id
            line.is_posted = True

        results.append(line)

    await db.commit()
    return results


async def _create_depreciation_journal(
    db: AsyncSession, tenant_id: str, user_id: str,
    asset: Asset, amount: Decimal, period_date: datetime, fiscal_year_id: str
) -> str | None:
    """إنشاء قيد يومية للاستهلاك"""
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import _next_entry_number

    # نحتاج حسابات الاستهلاك من فئة الأصل
    cat_r = await db.execute(select(AssetCategory).where(AssetCategory.id == asset.category_id))
    cat = cat_r.scalar_one_or_none()
    if not cat or not cat.depreciation_expense_account_id or not cat.accumulated_dep_account_id:
        return None

    entry_number = await _next_entry_number(db, tenant_id)
    entry = JournalEntry(
        id=str(uuid.uuid4()),
        tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=period_date,
        fiscal_year_id=fiscal_year_id,
        description_ar=f"استهلاك أصل: {asset.name_ar} - {period_date.strftime('%m/%Y')}",
        description_en=f"Depreciation: {asset.name_en or asset.name_ar} - {period_date.strftime('%m/%Y')}",
        status=JournalEntryStatus.POSTED,
        source="depreciation",
        reference=asset.asset_number,
        total_debit=amount,
        total_credit=amount,
        created_by=user_id,
        posted_by=user_id,
        posted_at=datetime.utcnow(),
    )
    db.add(entry)

    # مدين: مصروف الاستهلاك
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=cat.depreciation_expense_account_id,
        description=f"استهلاك {asset.name_ar}",
        debit=amount, credit=Decimal("0"), line_order=0,
    ))
    # دائن: مجمع الاستهلاك
    db.add(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=cat.accumulated_dep_account_id,
        description=f"مجمع استهلاك {asset.name_ar}",
        debit=Decimal("0"), credit=amount, line_order=1,
    ))
    return entry.id


# ─── Disposal ────────────────────────────────────────────────────────
async def dispose_asset(db: AsyncSession, tenant_id: str, user_id: str, asset_id: str, data: AssetDisposalRequest):
    """التخلص من الأصل — بيع أو إتلاف"""
    asset = await get_asset(db, tenant_id, asset_id)
    if asset.status != AssetStatus.ACTIVE:
        raise HTTPException(400, "Asset is not active")

    disposal_date = data.disposal_date.replace(tzinfo=None)
    gain_loss = data.disposal_amount - asset.book_value  # ربح أو خسارة البيع

    asset.status = AssetStatus.DISPOSED
    asset.disposal_date = disposal_date
    asset.disposal_amount = data.disposal_amount
    asset.disposal_notes = data.disposal_notes

    # قيد التخلص
    await _create_disposal_journal(db, tenant_id, user_id, asset, gain_loss, disposal_date, data.fiscal_year_id)

    await db.commit()
    await db.refresh(asset)
    return asset


async def _create_disposal_journal(
    db: AsyncSession, tenant_id: str, user_id: str,
    asset: Asset, gain_loss: Decimal, disposal_date: datetime, fiscal_year_id: str
):
    from app.models.accounting import JournalEntry, JournalEntryLine, JournalEntryStatus
    from app.modules.accounting.service import _next_entry_number

    cat_r = await db.execute(select(AssetCategory).where(AssetCategory.id == asset.category_id))
    cat = cat_r.scalar_one_or_none()
    if not cat or not cat.asset_account_id:
        return

    entry_number = await _next_entry_number(db, tenant_id)
    total = asset.purchase_cost + max(gain_loss, Decimal("0"))

    entry = JournalEntry(
        id=str(uuid.uuid4()), tenant_id=tenant_id,
        entry_number=entry_number, entry_date=disposal_date,
        fiscal_year_id=fiscal_year_id,
        description_ar=f"التخلص من أصل: {asset.name_ar}",
        status=JournalEntryStatus.POSTED, source="disposal",
        reference=asset.asset_number,
        total_debit=total, total_credit=total,
        created_by=user_id, posted_by=user_id, posted_at=datetime.utcnow(),
    )
    db.add(entry)

    lines = []
    # إلغاء مجمع الاستهلاك (مدين)
    if asset.accumulated_depreciation > 0 and cat.accumulated_dep_account_id:
        lines.append(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=cat.accumulated_dep_account_id,
            description="إلغاء مجمع الاستهلاك",
            debit=asset.accumulated_depreciation, credit=Decimal("0"), line_order=0,
        ))
    # إلغاء الأصل (دائن)
    lines.append(JournalEntryLine(
        id=str(uuid.uuid4()), entry_id=entry.id,
        account_id=cat.asset_account_id,
        description=f"إلغاء أصل: {asset.name_ar}",
        debit=Decimal("0"), credit=asset.purchase_cost, line_order=1,
    ))
    # ربح أو خسارة
    if gain_loss > 0 and cat.gain_on_disposal_account_id:
        lines.append(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=cat.gain_on_disposal_account_id,
            description="ربح التخلص من الأصل",
            debit=Decimal("0"), credit=gain_loss, line_order=2,
        ))
    elif gain_loss < 0 and cat.loss_on_disposal_account_id:
        lines.append(JournalEntryLine(
            id=str(uuid.uuid4()), entry_id=entry.id,
            account_id=cat.loss_on_disposal_account_id,
            description="خسارة التخلص من الأصل",
            debit=abs(gain_loss), credit=Decimal("0"), line_order=2,
        ))

    for line in lines:
        db.add(line)


# ─── Reports ─────────────────────────────────────────────────────────
async def get_depreciation_schedule(db: AsyncSession, tenant_id: str, asset_id: str):
    """جدول الاستهلاك التفصيلي لأصل"""
    r = await db.execute(
        select(DepreciationLine)
        .where(DepreciationLine.asset_id == asset_id, DepreciationLine.tenant_id == tenant_id)
        .order_by(DepreciationLine.period_date)
    )
    return r.scalars().all()


async def get_assets_summary(db: AsyncSession, tenant_id: str):
    """ملخص الأصول الثابتة"""
    assets_r = await db.execute(select(Asset).where(Asset.tenant_id == tenant_id))
    assets = assets_r.scalars().all()

    total_cost = sum(a.purchase_cost for a in assets)
    total_accumulated = sum(a.accumulated_depreciation for a in assets)
    total_book_value = sum(a.book_value for a in assets)
    active_count = sum(1 for a in assets if a.status == AssetStatus.ACTIVE)
    disposed_count = sum(1 for a in assets if a.status == AssetStatus.DISPOSED)

    return {
        "total_assets": len(assets),
        "active_count": active_count,
        "disposed_count": disposed_count,
        "total_cost": total_cost,
        "total_accumulated_depreciation": total_accumulated,
        "total_book_value": total_book_value,
    }
