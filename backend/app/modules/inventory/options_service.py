"""
خدمة محاور التخصيص (Product Options)
─────────────────────────────────────
تدير: ProductOptionGroup + ProductOption + ProductVariant

الفكرة:
  كل منتج عنده محاور تخصيص (مثل: اللون، السعة، المقاس)
  كل محور عنده قيم (مثل: أسود، أبيض، 128GB)
  كل تركيبة من القيم = variant في المخزون

يتكيف مع كل الأنشطة:
  جوالات  → اللون + السعة
  ملابس   → المقاس + اللون
  سماعات  → اللون
  عطارة   → الوزن/الحجم
  عام     → حر
"""
from __future__ import annotations
import uuid
import json
from decimal import Decimal
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.inventory import (
    InventoryItem, ProductOptionGroup, ProductOption, ProductVariant,
)


# ══════════════════════════════════════════════════════════════════════
# محاور التخصيص (Option Groups)
# ══════════════════════════════════════════════════════════════════════

async def get_option_groups(
    db: AsyncSession, tenant_id: str, product_id: str
) -> list[dict]:
    """جلب كل محاور التخصيص لمنتج مع قيمها"""
    # تحقق من الـ tenant
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "المنتج غير موجود")

    r = await db.execute(
        select(ProductOptionGroup)
        .where(ProductOptionGroup.product_id == product_id)
        .order_by(ProductOptionGroup.sort_order)
    )
    groups = r.scalars().all()

    result = []
    for g in groups:
        opts_r = await db.execute(
            select(ProductOption)
            .where(ProductOption.group_id == g.id, ProductOption.is_active == True)
            .order_by(ProductOption.sort_order)
        )
        opts = opts_r.scalars().all()
        result.append({
            "id": g.id,
            "name_ar": g.name_ar,
            "name_en": g.name_en,
            "type": g.type,
            "is_required": g.is_required,
            "sort_order": g.sort_order,
            "options": [
                {
                    "id": o.id,
                    "value": o.value,
                    "color_hex": o.color_hex,
                    "image_url": o.image_url,
                    "price_modifier": float(o.price_modifier),
                    "sort_order": o.sort_order,
                    "is_active": o.is_active,
                }
                for o in opts
            ],
        })
    return result


async def create_option_group(
    db: AsyncSession, tenant_id: str, product_id: str, data: dict
) -> dict:
    """إنشاء محور تخصيص جديد"""
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "المنتج غير موجود")

    group = ProductOptionGroup(
        id=str(uuid.uuid4()),
        product_id=product_id,
        name_ar=data["name_ar"],
        name_en=data.get("name_en"),
        type=data.get("type", "text"),
        is_required=data.get("is_required", True),
        sort_order=data.get("sort_order", 0),
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)

    # إضافة القيم إذا أُرسلت مع المحور
    options_data = data.get("options", [])
    for i, opt in enumerate(options_data):
        db.add(ProductOption(
            id=str(uuid.uuid4()),
            group_id=group.id,
            value=opt["value"],
            color_hex=opt.get("color_hex"),
            image_url=opt.get("image_url"),
            price_modifier=Decimal(str(opt.get("price_modifier", 0))),
            sort_order=opt.get("sort_order", i),
        ))
    if options_data:
        await db.commit()

    return (await get_option_groups(db, tenant_id, product_id))[
        next(i for i, g in enumerate(await _get_groups_raw(db, product_id)) if g.id == group.id)
    ]


async def update_option_group(
    db: AsyncSession, tenant_id: str, group_id: str, data: dict
) -> dict:
    """تعديل محور تخصيص"""
    group = await db.get(ProductOptionGroup, group_id)
    if not group:
        raise HTTPException(404, "المحور غير موجود")
    item = await db.get(InventoryItem, group.product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(403, "غير مصرح")

    for k in ["name_ar", "name_en", "type", "is_required", "sort_order"]:
        if k in data:
            setattr(group, k, data[k])
    await db.commit()
    return await _group_to_dict(db, group)


async def delete_option_group(
    db: AsyncSession, tenant_id: str, group_id: str
):
    """حذف محور تخصيص وكل قيمه"""
    group = await db.get(ProductOptionGroup, group_id)
    if not group:
        raise HTTPException(404, "المحور غير موجود")
    item = await db.get(InventoryItem, group.product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(403, "غير مصرح")

    await db.delete(group)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════
# قيم التخصيص (Options)
# ══════════════════════════════════════════════════════════════════════

async def add_option(
    db: AsyncSession, tenant_id: str, group_id: str, data: dict
) -> dict:
    """إضافة قيمة لمحور تخصيص"""
    group = await db.get(ProductOptionGroup, group_id)
    if not group:
        raise HTTPException(404, "المحور غير موجود")
    item = await db.get(InventoryItem, group.product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(403, "غير مصرح")

    opt = ProductOption(
        id=str(uuid.uuid4()),
        group_id=group_id,
        value=data["value"],
        color_hex=data.get("color_hex"),
        image_url=data.get("image_url"),
        price_modifier=Decimal(str(data.get("price_modifier", 0))),
        sort_order=data.get("sort_order", 0),
    )
    db.add(opt)
    await db.commit()
    await db.refresh(opt)
    return _option_to_dict(opt)


async def update_option(
    db: AsyncSession, tenant_id: str, option_id: str, data: dict
) -> dict:
    """تعديل قيمة تخصيص"""
    opt = await db.get(ProductOption, option_id)
    if not opt:
        raise HTTPException(404, "القيمة غير موجودة")
    group = await db.get(ProductOptionGroup, opt.group_id)
    item = await db.get(InventoryItem, group.product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(403, "غير مصرح")

    for k in ["value", "color_hex", "image_url", "sort_order", "is_active"]:
        if k in data:
            setattr(opt, k, data[k])
    if "price_modifier" in data:
        opt.price_modifier = Decimal(str(data["price_modifier"]))
    await db.commit()
    await db.refresh(opt)
    return _option_to_dict(opt)


async def delete_option(
    db: AsyncSession, tenant_id: str, option_id: str
):
    """حذف قيمة تخصيص"""
    opt = await db.get(ProductOption, option_id)
    if not opt:
        raise HTTPException(404, "القيمة غير موجودة")
    group = await db.get(ProductOptionGroup, opt.group_id)
    item = await db.get(InventoryItem, group.product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(403, "غير مصرح")

    await db.delete(opt)
    await db.commit()


# ══════════════════════════════════════════════════════════════════════
# المتغيرات (Variants) — التركيبات الفعلية
# ══════════════════════════════════════════════════════════════════════

async def get_variants(
    db: AsyncSession, tenant_id: str, product_id: str
) -> list[dict]:
    """جلب كل المتغيرات لمنتج"""
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "المنتج غير موجود")

    r = await db.execute(
        select(ProductVariant)
        .where(ProductVariant.product_id == product_id, ProductVariant.is_active == True)
        .order_by(ProductVariant.created_at)
    )
    variants = r.scalars().all()
    return [_variant_to_dict(v) for v in variants]


async def create_variant(
    db: AsyncSession, tenant_id: str, product_id: str, data: dict
) -> dict:
    """
    إنشاء متغير جديد.
    data يحتوي على:
      - options: {"اللون": "أسود", "السعة": "128GB"}
      - quantity: 5
      - cost_price: 2500
      - sale_price: 3499 (اختياري — يُحسب من السعر الأساسي + price_modifiers)
      - sku_variant: (اختياري)
    """
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "المنتج غير موجود")

    options = data.get("options", {})

    # حساب السعر تلقائياً إذا لم يُحدد
    sale_price = data.get("sale_price")
    if not sale_price:
        sale_price = await _calculate_variant_price(db, product_id, options, item.sale_price)

    # بناء options_json
    options_json = json.dumps(options, ensure_ascii=False) if options else None

    # استخراج size/color/other_attr من options للتوافق مع الكود القديم
    size = options.get("المقاس") or options.get("Size") or options.get("size")
    color = options.get("اللون") or options.get("Color") or options.get("color")
    other_keys = [k for k in options if k not in ("المقاس", "Size", "size", "اللون", "Color", "color")]
    other_attr = options.get(other_keys[0]) if other_keys else None

    variant = ProductVariant(
        id=str(uuid.uuid4()),
        product_id=product_id,
        options_json=options_json,
        size=size,
        color=color,
        other_attr=other_attr,
        sku_variant=data.get("sku_variant"),
        barcode_variant=data.get("barcode_variant"),
        quantity=Decimal(str(data.get("quantity", 0))),
        cost_price=Decimal(str(data.get("cost_price", item.cost_price))),
        sale_price=Decimal(str(sale_price)) if sale_price else None,
    )
    db.add(variant)

    # تحديث الكمية الإجمالية في InventoryItem
    item.quantity_on_hand += variant.quantity
    await db.commit()
    await db.refresh(variant)
    return _variant_to_dict(variant)


async def update_variant(
    db: AsyncSession, tenant_id: str, variant_id: str, data: dict
) -> dict:
    """تعديل متغير"""
    variant = await db.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(404, "المتغير غير موجود")
    item = await db.get(InventoryItem, variant.product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(403, "غير مصرح")

    old_qty = variant.quantity

    if "options" in data:
        options = data["options"]
        variant.options_json = json.dumps(options, ensure_ascii=False)
        variant.size = options.get("المقاس") or options.get("Size") or options.get("size")
        variant.color = options.get("اللون") or options.get("Color") or options.get("color")

    for k in ["sku_variant", "barcode_variant", "is_active"]:
        if k in data:
            setattr(variant, k, data[k])
    if "quantity" in data:
        variant.quantity = Decimal(str(data["quantity"]))
    if "cost_price" in data:
        variant.cost_price = Decimal(str(data["cost_price"]))
    if "sale_price" in data:
        variant.sale_price = Decimal(str(data["sale_price"])) if data["sale_price"] else None

    # تحديث الكمية الإجمالية
    qty_diff = variant.quantity - old_qty
    item.quantity_on_hand += qty_diff

    await db.commit()
    await db.refresh(variant)
    return _variant_to_dict(variant)


async def delete_variant(
    db: AsyncSession, tenant_id: str, variant_id: str
):
    """حذف متغير"""
    variant = await db.get(ProductVariant, variant_id)
    if not variant:
        raise HTTPException(404, "المتغير غير موجود")
    item = await db.get(InventoryItem, variant.product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(403, "غير مصرح")

    # تحديث الكمية الإجمالية
    item.quantity_on_hand -= variant.quantity
    if item.quantity_on_hand < 0:
        item.quantity_on_hand = Decimal("0")

    await db.delete(variant)
    await db.commit()


async def bulk_create_variants(
    db: AsyncSession, tenant_id: str, product_id: str,
    groups_data: list[dict],
) -> list[dict]:
    """
    إنشاء كل التركيبات الممكنة من المحاور تلقائياً.
    groups_data: [
      {"name_ar": "اللون", "options": [{"value": "أسود"}, {"value": "أبيض"}]},
      {"name_ar": "السعة", "options": [{"value": "128GB", "price_modifier": 0}, {"value": "256GB", "price_modifier": 200}]},
    ]
    """
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "المنتج غير موجود")

    # حذف المحاور القديمة وإعادة البناء
    old_groups_r = await db.execute(
        select(ProductOptionGroup).where(ProductOptionGroup.product_id == product_id)
    )
    for g in old_groups_r.scalars().all():
        await db.delete(g)
    await db.commit()

    # إنشاء المحاور الجديدة
    created_groups = []
    for i, gd in enumerate(groups_data):
        group = ProductOptionGroup(
            id=str(uuid.uuid4()),
            product_id=product_id,
            name_ar=gd["name_ar"],
            name_en=gd.get("name_en"),
            type=gd.get("type", "text"),
            is_required=gd.get("is_required", True),
            sort_order=i,
        )
        db.add(group)
        await db.flush()

        opts = []
        for j, od in enumerate(gd.get("options", [])):
            opt = ProductOption(
                id=str(uuid.uuid4()),
                group_id=group.id,
                value=od["value"],
                color_hex=od.get("color_hex"),
                image_url=od.get("image_url"),
                price_modifier=Decimal(str(od.get("price_modifier", 0))),
                sort_order=j,
            )
            db.add(opt)
            opts.append(opt)
        await db.flush()
        created_groups.append((group, opts))

    # حذف المتغيرات القديمة
    old_variants_r = await db.execute(
        select(ProductVariant).where(ProductVariant.product_id == product_id)
    )
    for v in old_variants_r.scalars().all():
        await db.delete(v)
    await db.flush()

    # بناء كل التركيبات الممكنة (Cartesian product)
    def cartesian(groups):
        if not groups:
            return [{}]
        result = []
        rest = cartesian(groups[1:])
        group, opts = groups[0]
        for opt in opts:
            for combo in rest:
                new_combo = {group.name_ar: opt.value, **combo}
                result.append((new_combo, opt.price_modifier + sum(
                    Decimal("0") for _ in combo
                )))
        return result

    # حساب price_modifier لكل تركيبة
    def cartesian_with_price(groups):
        if not groups:
            return [({})]
        result = []
        rest = cartesian_with_price(groups[1:])
        group, opts = groups[0]
        for opt in opts:
            for combo in rest:
                combo_dict, combo_price = combo if isinstance(combo, tuple) else (combo, Decimal("0"))
                new_combo = {group.name_ar: opt.value, **combo_dict}
                new_price = opt.price_modifier + combo_price
                result.append((new_combo, new_price))
        return result

    combos = cartesian_with_price(created_groups)

    # إنشاء variant لكل تركيبة
    created_variants = []
    total_qty = Decimal("0")
    for options_dict, price_modifier in combos:
        sale_price = item.sale_price + price_modifier if item.sale_price else None

        # استخراج size/color للتوافق
        size = options_dict.get("المقاس") or options_dict.get("Size")
        color = options_dict.get("اللون") or options_dict.get("Color")
        other_keys = [k for k in options_dict if k not in ("المقاس", "Size", "اللون", "Color")]
        other_attr = options_dict.get(other_keys[0]) if other_keys else None

        variant = ProductVariant(
            id=str(uuid.uuid4()),
            product_id=product_id,
            options_json=json.dumps(options_dict, ensure_ascii=False),
            size=size,
            color=color,
            other_attr=other_attr,
            quantity=Decimal("0"),
            cost_price=item.cost_price,
            sale_price=sale_price,
        )
        db.add(variant)
        created_variants.append(variant)

    item.quantity_on_hand = total_qty
    await db.commit()

    return [_variant_to_dict(v) for v in created_variants]


# ══════════════════════════════════════════════════════════════════════
# تقرير المخزون حسب المتغيرات
# ══════════════════════════════════════════════════════════════════════

async def get_variant_stock_report(
    db: AsyncSession, tenant_id: str, product_id: str
) -> dict:
    """
    تقرير المخزون مع تفصيل كل متغير.
    يُستخدم في:
    - صفحة المنتج العامة (للعميل)
    - تقارير المخزون (للمدير)
    """
    item = await db.get(InventoryItem, product_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "المنتج غير موجود")

    groups = await get_option_groups(db, tenant_id, product_id)
    variants = await get_variants(db, tenant_id, product_id)

    total_qty = sum(v["quantity"] for v in variants)
    available_variants = [v for v in variants if v["quantity"] > 0]

    # بناء مصفوفة التوفر لكل خيار
    availability_map: dict[str, dict[str, int]] = {}
    for group in groups:
        availability_map[group["name_ar"]] = {}
        for opt in group["options"]:
            qty = sum(
                v["quantity"] for v in variants
                if v.get("options", {}).get(group["name_ar"]) == opt["value"]
            )
            availability_map[group["name_ar"]][opt["value"]] = qty

    return {
        "product_id": product_id,
        "product_name": item.name_ar,
        "tracking_type": item.tracking_type.value if hasattr(item.tracking_type, "value") else str(item.tracking_type),
        "total_quantity": float(total_qty),
        "available_variants_count": len(available_variants),
        "option_groups": groups,
        "variants": variants,
        "availability_map": availability_map,
    }


# ══════════════════════════════════════════════════════════════════════
# Helpers
# ══════════════════════════════════════════════════════════════════════

async def _get_groups_raw(db: AsyncSession, product_id: str) -> list[ProductOptionGroup]:
    r = await db.execute(
        select(ProductOptionGroup)
        .where(ProductOptionGroup.product_id == product_id)
        .order_by(ProductOptionGroup.sort_order)
    )
    return r.scalars().all()


async def _group_to_dict(db: AsyncSession, group: ProductOptionGroup) -> dict:
    opts_r = await db.execute(
        select(ProductOption)
        .where(ProductOption.group_id == group.id, ProductOption.is_active == True)
        .order_by(ProductOption.sort_order)
    )
    opts = opts_r.scalars().all()
    return {
        "id": group.id,
        "name_ar": group.name_ar,
        "name_en": group.name_en,
        "type": group.type,
        "is_required": group.is_required,
        "sort_order": group.sort_order,
        "options": [_option_to_dict(o) for o in opts],
    }


def _option_to_dict(opt: ProductOption) -> dict:
    return {
        "id": opt.id,
        "value": opt.value,
        "color_hex": opt.color_hex,
        "image_url": opt.image_url,
        "price_modifier": float(opt.price_modifier),
        "sort_order": opt.sort_order,
        "is_active": opt.is_active,
    }


def _variant_to_dict(v: ProductVariant) -> dict:
    options = {}
    if v.options_json:
        try:
            options = json.loads(v.options_json)
        except Exception:
            pass
    return {
        "id": v.id,
        "product_id": v.product_id,
        "options": options,
        "options_json": v.options_json,
        "size": v.size,
        "color": v.color,
        "other_attr": v.other_attr,
        "sku_variant": v.sku_variant,
        "barcode_variant": v.barcode_variant,
        "quantity": float(v.quantity),
        "cost_price": float(v.cost_price),
        "sale_price": float(v.sale_price) if v.sale_price else None,
        "is_active": v.is_active,
    }


async def _calculate_variant_price(
    db: AsyncSession, product_id: str,
    options: dict, base_price: Decimal
) -> Decimal:
    """حساب سعر المتغير = السعر الأساسي + مجموع price_modifiers"""
    total_modifier = Decimal("0")
    groups_r = await db.execute(
        select(ProductOptionGroup).where(ProductOptionGroup.product_id == product_id)
    )
    groups = groups_r.scalars().all()

    for group in groups:
        selected_value = options.get(group.name_ar)
        if not selected_value:
            continue
        opt_r = await db.execute(
            select(ProductOption).where(
                ProductOption.group_id == group.id,
                ProductOption.value == selected_value,
            )
        )
        opt = opt_r.scalar_one_or_none()
        if opt:
            total_modifier += opt.price_modifier

    return base_price + total_modifier
