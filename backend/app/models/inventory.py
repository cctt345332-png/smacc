"""
موديل المخزون — مصمم للعزل الصحيح بين أنواع التتبع
يدعم: كمية عادية | سيريال | تشغيلة | متغيرات
"""
from sqlalchemy import (
    String, Boolean, ForeignKey, DateTime, Numeric,
    Integer, Text, Enum as SAEnum, Index
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, date
from decimal import Decimal
import enum
from app.core.database import Base


# ─── Enums ───────────────────────────────────────────────────────────

class BusinessType(str, enum.Enum):
    """نوع النشاط التجاري — يحدد الميزات المفعّلة"""
    MOBILE_PHONES  = "mobile_phones"   # جوالات وإلكترونيات → Serial
    PHARMACY       = "pharmacy"        # صيدليات → Batch + Expiry
    GROCERY        = "grocery"         # بقالات → Quantity
    SPICES         = "spices"          # عطارات → Weight + Quantity
    CLOTHING       = "clothing"        # ملابس → Variants
    SPARE_PARTS    = "spare_parts"     # قطع غيار → Quantity + Serial
    CONSTRUCTION   = "construction"    # مواد بناء → Quantity + Unit
    GENERAL        = "general"         # عام → Quantity


class TrackingType(str, enum.Enum):
    """طريقة تتبع المخزون لكل منتج"""
    QUANTITY = "quantity"   # كمية عادية — بقالات، عطارات
    SERIAL   = "serial"     # سيريال — جوالات، إلكترونيات
    BATCH    = "batch"      # تشغيلة + انتهاء — صيدليات
    VARIANT  = "variant"    # متغيرات (مقاس/لون) — ملابس
    WEIGHT   = "weight"     # وزن — عطارات، ذهب


class UnitType(str, enum.Enum):
    PIECE  = "piece"   # قطعة
    KG     = "kg"      # كيلوجرام
    GRAM   = "gram"    # جرام
    LITER  = "liter"   # لتر
    METER  = "meter"   # متر
    BOX    = "box"     # صندوق
    PACK   = "pack"    # عبوة
    TON    = "ton"     # طن


class SerialCondition(str, enum.Enum):
    NEW          = "new"          # جديد
    USED         = "used"         # مستخدم
    REFURBISHED  = "refurbished"  # مجدد


class SerialStatus(str, enum.Enum):
    IN_STOCK  = "in_stock"   # في المخزون
    SOLD      = "sold"       # مباع
    RESERVED  = "reserved"   # محجوز
    DAMAGED   = "damaged"    # تالف
    RETURNED  = "returned"   # مرتجع


class MovementType(str, enum.Enum):
    PURCHASE          = "purchase"           # شراء
    SALE              = "sale"               # بيع
    RETURN_IN         = "return_in"          # مرتجع وارد
    RETURN_OUT        = "return_out"         # مرتجع صادر
    ADJUSTMENT        = "adjustment"         # تسوية
    TRANSFER          = "transfer"           # تحويل بين مستودعات
    DAMAGE            = "damage"             # تلف
    PURCHASE_EDIT_REV = "purchase_edit_rev"  # عكس شراء عند تعديل فاتورة


# ─── Warehouse (المستودعات) ──────────────────────────────────────────
class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    branch_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    products: Mapped[list["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="default_warehouse"
    )


# ─── Category (تصنيفات المنتجات) ─────────────────────────────────────
class ProductCategory(Base):
    __tablename__ = "product_categories"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    name_ar: Mapped[str] = mapped_column(String(200))
    name_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    parent_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("product_categories.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    products: Mapped[list["InventoryItem"]] = relationship(
        "InventoryItem", back_populates="category"
    )


# ─── InventoryItem (المنتج / الصنف) ──────────────────────────────────
class InventoryItem(Base):
    """
    النواة المشتركة لكل الأنشطة.
    tracking_type يحدد أي جدول امتداد يُستخدم.
    """
    __tablename__ = "inventory_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    category_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("product_categories.id"), nullable=True
    )
    default_warehouse_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("warehouses.id"), nullable=True
    )

    # ── الهوية ──────────────────────────────────────────────────────
    name_ar: Mapped[str] = mapped_column(String(300))
    name_en: Mapped[str | None] = mapped_column(String(300), nullable=True)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    barcode: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    description_ar: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── نوع التتبع — هذا هو العزل الأساسي ──────────────────────────
    tracking_type: Mapped[TrackingType] = mapped_column(
        SAEnum(TrackingType, values_callable=lambda x: [e.value for e in x]), default="quantity"
    )
    unit_type: Mapped[UnitType] = mapped_column(
        SAEnum(UnitType, values_callable=lambda x: [e.value for e in x]), default="piece"
    )

    # ── التسعير (للمنتجات العادية — متوسط متحرك) ────────────────────
    cost_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    sale_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    vat_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("15"))

    # ── الكمية (للمنتجات العادية فقط — serial/batch لها جداولها) ────
    quantity_on_hand: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("0"))
    quantity_reserved: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("0"))
    reorder_point: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("0"))

    # ── ربط المتجر الإلكتروني ───────────────────────────────────────
    store_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    store_description_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    store_images_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    store_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)
    store_featured: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── ربط نقطة البيع ──────────────────────────────────────────────
    pos_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    # ── خصائص المنتج (للجوالات والإلكترونيات) ───────────────────────
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)    # اللون: أسود، أبيض...
    storage: Mapped[str | None] = mapped_column(String(50), nullable=True)  # السعة: 128GB, 256GB...

    # ── حقول الصيدلية ────────────────────────────────────────────────
    manufacturer: Mapped[str | None] = mapped_column(String(200), nullable=True)   # الشركة المصنّعة
    sfda_number: Mapped[str | None] = mapped_column(String(50), nullable=True)     # رقم التسجيل الصحي SFDA
    dosage_form: Mapped[str | None] = mapped_column(String(50), nullable=True)     # شكل الدواء
    concentration: Mapped[str | None] = mapped_column(String(100), nullable=True)  # التركيز / الجرعة
    requires_prescription: Mapped[bool] = mapped_column(Boolean, default=False)    # يحتاج وصفة
    # حقول إضافية — متطلبات السعودية
    generic_name: Mapped[str | None] = mapped_column(String(300), nullable=True)   # المادة الفعّالة
    country_of_origin: Mapped[str | None] = mapped_column(String(100), nullable=True)  # بلد المنشأ
    import_license: Mapped[str | None] = mapped_column(String(100), nullable=True) # رقم ترخيص الاستيراد
    gs1_code: Mapped[str | None] = mapped_column(String(50), nullable=True)        # رمز GS1/GTIN
    nphies_code: Mapped[str | None] = mapped_column(String(50), nullable=True)     # رمز نوفا NPHIES

    # ── تخصيصات إضافية (JSON) — تُستخدم لتخزين خصائص النشاط المخصصة ──
    # مثال mobile_phones: {"ram": "8GB", "network": "5G", "screen_size": "6.7"}
    # مثال spices:        {"weight_unit": "kg", "origin": "السعودية", "grade": "ممتاز"}
    # مثال spare_parts:   {"part_number": "ABC-123", "brand": "تويوتا", "compatibility": "كامري 2020"}
    extra_attrs_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # ── العلاقات ────────────────────────────────────────────────────
    category: Mapped["ProductCategory | None"] = relationship(
        "ProductCategory", back_populates="products"
    )
    default_warehouse: Mapped["Warehouse | None"] = relationship(
        "Warehouse", back_populates="products"
    )
    serial_items: Mapped[list["SerialItem"]] = relationship(
        "SerialItem", back_populates="product", cascade="all, delete-orphan"
    )
    batch_items: Mapped[list["BatchItem"]] = relationship(
        "BatchItem", back_populates="product", cascade="all, delete-orphan"
    )
    option_groups: Mapped[list["ProductOptionGroup"]] = relationship(
        "ProductOptionGroup", back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductOptionGroup.sort_order",
    )
    variants: Mapped[list["ProductVariant"]] = relationship(
        "ProductVariant", back_populates="product", cascade="all, delete-orphan"
    )
    movements: Mapped[list["StockMovement"]] = relationship(
        "StockMovement", back_populates="product"
    )
    stock_levels: Mapped[list["InventoryStock"]] = relationship(
        "InventoryStock", back_populates="item", cascade="all, delete-orphan"
    )
    count_sessions: Mapped[list["StockCountSession"]] = relationship(
        "StockCountSession", back_populates="item", cascade="all, delete-orphan"
    )


# ─── InventoryStock (كمية الصنف في كل مستودع) ────────────────────────
class InventoryStock(Base):
    """ربط صنف × مستودع × كمية — يتيح تتبع المخزون لكل مستودع"""
    __tablename__ = "inventory_stock"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    item_id: Mapped[str] = mapped_column(String, ForeignKey("inventory_items.id"), index=True)
    warehouse_id: Mapped[str] = mapped_column(String, ForeignKey("warehouses.id"), index=True)

    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("0"))
    reserved_qty: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("0"))
    reorder_point: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("0"))

    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    item: Mapped["InventoryItem"] = relationship("InventoryItem", back_populates="stock_levels")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse")

    __table_args__ = (
        Index("ix_inventory_stock_item_warehouse", "item_id", "warehouse_id", unique=True),
    )


# ─── SerialItem (وحدة بسيريال) ───────────────────────────────────────
# يُستخدم عندما tracking_type = SERIAL
# مثال: جوالات، لابتوبات، أجهزة إلكترونية
class SerialItem(Base):
    __tablename__ = "serial_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("inventory_items.id"), index=True
    )
    warehouse_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("warehouses.id"), nullable=True
    )

    serial_number: Mapped[str] = mapped_column(String(200), index=True)
    condition: Mapped[SerialCondition] = mapped_column(
        SAEnum(SerialCondition, values_callable=lambda x: [e.value for e in x]), default="new"
    )
    status: Mapped[SerialStatus] = mapped_column(
        SAEnum(SerialStatus, values_callable=lambda x: [e.value for e in x]), default="in_stock"
    )

    # ── التكلفة والسعر لهذه الوحدة تحديداً ─────────────────────────
    # هذا هو جوهر ميزة "ربح لكل سيريال"
    cost_price: Mapped[Decimal] = mapped_column(Numeric(18, 4))
    sale_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    # ── الربط بالمستندات ─────────────────────────────────────────────
    purchase_bill_id: Mapped[str | None] = mapped_column(String, nullable=True)
    sale_invoice_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # ── معلومات إضافية ───────────────────────────────────────────────
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    purchased_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sold_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["InventoryItem"] = relationship(
        "InventoryItem", back_populates="serial_items"
    )

    __table_args__ = (
        Index("ix_serial_items_product_status", "product_id", "status"),
    )


# ─── BatchItem (تشغيلة) ──────────────────────────────────────────────
# يُستخدم عندما tracking_type = BATCH
# مثال: صيدليات، مواد غذائية
class BatchItem(Base):
    __tablename__ = "batch_items"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("inventory_items.id"), index=True
    )
    warehouse_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("warehouses.id"), nullable=True
    )

    batch_number: Mapped[str] = mapped_column(String(100), index=True)
    expiry_date: Mapped[date | None] = mapped_column(DateTime, nullable=True)
    manufacture_date: Mapped[date | None] = mapped_column(DateTime, nullable=True)

    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("0"))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(18, 4))

    purchase_bill_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["InventoryItem"] = relationship(
        "InventoryItem", back_populates="batch_items"
    )


# ─── ProductOptionGroup (محاور التخصيص) ─────────────────────────────
# مثال: "اللون"، "السعة"، "المقاس"
# يعمل مع جميع الأنشطة — كل نشاط يضيف محاوره الخاصة
class ProductOptionGroup(Base):
    __tablename__ = "product_option_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("inventory_items.id", ondelete="CASCADE"), index=True
    )
    name_ar: Mapped[str] = mapped_column(String(100))   # "اللون" / "السعة" / "المقاس"
    name_en: Mapped[str | None] = mapped_column(String(100), nullable=True)
    type: Mapped[str] = mapped_column(String(20), default="text")
    # text | color | image | number
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["InventoryItem"] = relationship(
        "InventoryItem", back_populates="option_groups"
    )
    options: Mapped[list["ProductOption"]] = relationship(
        "ProductOption", back_populates="group",
        cascade="all, delete-orphan",
        order_by="ProductOption.sort_order",
    )


# ─── ProductOption (قيم التخصيص) ─────────────────────────────────────
# مثال: "أسود"، "128GB"، "L"
class ProductOption(Base):
    __tablename__ = "product_options"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("product_option_groups.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[str] = mapped_column(String(200))         # "أسود" / "128GB" / "L"
    color_hex: Mapped[str | None] = mapped_column(String(7), nullable=True)   # "#000000"
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_modifier: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))
    # +200 يعني يُضاف للسعر الأساسي، -50 يعني خصم
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    group: Mapped["ProductOptionGroup"] = relationship(
        "ProductOptionGroup", back_populates="options"
    )


# ─── ProductVariant (التركيبة = المخزون الفعلي) ──────────────────────
# كل تركيبة من الخيارات = سجل variant واحد
# مثال: iPhone أسود 128GB = variant واحد بكميته وسعره
class ProductVariant(Base):
    __tablename__ = "product_variants"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("inventory_items.id"), index=True
    )

    # snapshot للخيارات المختارة — للعرض السريع بدون JOIN
    # مثال: {"اللون": "أسود", "السعة": "128GB"}
    # مثال: {"المقاس": "L", "اللون": "أحمر"}
    options_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # حقول legacy للتوافق مع الكود القديم
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(100), nullable=True)
    other_attr: Mapped[str | None] = mapped_column(String(100), nullable=True)

    sku_variant: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    barcode_variant: Mapped[str | None] = mapped_column(String(100), nullable=True)

    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3), default=Decimal("0"))
    cost_price: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))
    sale_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 4), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["InventoryItem"] = relationship(
        "InventoryItem", back_populates="variants"
    )


# ─── StockMovement (حركات المخزون) ───────────────────────────────────
# سجل كل حركة — مشترك بين جميع أنواع التتبع
class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    product_id: Mapped[str] = mapped_column(
        String, ForeignKey("inventory_items.id"), index=True
    )
    warehouse_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("warehouses.id"), nullable=True
    )

    # ── نوع الحركة ───────────────────────────────────────────────────
    movement_type: Mapped[MovementType] = mapped_column(SAEnum(MovementType, values_callable=lambda x: [e.value for e in x]))

    # ── الكمية (+ داخل، - خارج) ──────────────────────────────────────
    quantity: Mapped[Decimal] = mapped_column(Numeric(18, 3))
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(18, 4), default=Decimal("0"))

    # ── الربط بنوع التتبع (واحد فقط يكون غير null) ──────────────────
    serial_item_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("serial_items.id"), nullable=True
    )
    batch_item_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("batch_items.id"), nullable=True
    )
    variant_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("product_variants.id"), nullable=True
    )

    # ── الربط بالمستند المصدر ────────────────────────────────────────
    reference_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # bill | invoice | adjustment | pos_transaction
    reference_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # ── للتحويلات بين المستودعات ──────────────────────────────────────
    to_warehouse_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("warehouses.id"), nullable=True
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(
        String, ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped["InventoryItem"] = relationship(
        "InventoryItem", back_populates="movements"
    )

    __table_args__ = (
        Index("ix_stock_movements_tenant_date", "tenant_id", "created_at"),
        Index("ix_stock_movements_product_type", "product_id", "movement_type"),
    )




# ─── StockCountSession (جلسة جرد) ────────────────────────────────────
class StockCountSession(Base):
    """سجل كل عملية جرد — للرجوع إليها لاحقاً"""
    __tablename__ = "stock_count_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), index=True)
    item_id: Mapped[str] = mapped_column(String, ForeignKey("inventory_items.id"), index=True)
    warehouse_id: Mapped[str] = mapped_column(String, ForeignKey("warehouses.id"))

    previous_qty: Mapped[Decimal] = mapped_column(Numeric(18, 3))
    counted_qty: Mapped[Decimal] = mapped_column(Numeric(18, 3))
    diff_qty: Mapped[Decimal] = mapped_column(Numeric(18, 3))
    diff_value: Mapped[Decimal] = mapped_column(Numeric(18, 2), default=Decimal("0"))

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    counted_by: Mapped[str | None] = mapped_column(String, ForeignKey("users.id"), nullable=True)
    counted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    item: Mapped["InventoryItem"] = relationship("InventoryItem", back_populates="count_sessions")
