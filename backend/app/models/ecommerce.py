"""
موديل المتجر الإلكتروني
مخصص لنشاط الجوالات والإلكترونيات
"""
from sqlalchemy import String, Boolean, ForeignKey, DateTime, Numeric, Integer, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime
from decimal import Decimal
import enum
from app.core.database import Base


class StoreStatus(str, enum.Enum):
    DRAFT    = "draft"
    ACTIVE   = "active"
    INACTIVE = "inactive"


class OrderStatus(str, enum.Enum):
    PENDING    = "pending"
    CONFIRMED  = "confirmed"
    PROCESSING = "processing"
    SHIPPED    = "shipped"
    DELIVERED  = "delivered"
    CANCELLED  = "cancelled"


class PaymentMethod(str, enum.Enum):
    COD     = "cod"       # الدفع عند الاستلام
    ONLINE  = "online"    # دفع إلكتروني


# ─── Store ───────────────────────────────────────────────────────────
class Store(Base):
    __tablename__ = "stores"

    id:          Mapped[str]           = mapped_column(String, primary_key=True)
    tenant_id:   Mapped[str]           = mapped_column(String, ForeignKey("tenants.id"), unique=True, index=True)

    # الهوية
    name_ar:     Mapped[str]           = mapped_column(String(300))
    name_en:     Mapped[str | None]    = mapped_column(String(300), nullable=True)
    slug:        Mapped[str]           = mapped_column(String(100), unique=True, index=True)
    description_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    description_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url:    Mapped[str | None]    = mapped_column(Text, nullable=True)
    banner_url:  Mapped[str | None]    = mapped_column(Text, nullable=True)

    # الإعدادات
    status:      Mapped[StoreStatus]   = mapped_column(
        SAEnum(StoreStatus, values_callable=lambda x: [e.value for e in x]),
        default=StoreStatus.DRAFT
    )
    currency:    Mapped[str]           = mapped_column(String(3), default="SAR")

    # التواصل
    phone:       Mapped[str | None]    = mapped_column(String(20), nullable=True)
    email:       Mapped[str | None]    = mapped_column(String(200), nullable=True)
    whatsapp:    Mapped[str | None]    = mapped_column(String(20), nullable=True)
    instagram:   Mapped[str | None]    = mapped_column(String(100), nullable=True)
    twitter:     Mapped[str | None]    = mapped_column(String(100), nullable=True)

    # إعدادات الشحن
    shipping_enabled:        Mapped[bool]          = mapped_column(Boolean, default=False)
    free_shipping_threshold: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    default_shipping_cost:   Mapped[Decimal]        = mapped_column(Numeric(18, 2), default=Decimal("0"))

    # إعدادات الصفحة الرئيسية (JSON)
    homepage_config: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at:  Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:  Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    categories:  Mapped[list["StoreCategory"]] = relationship("StoreCategory", back_populates="store", cascade="all, delete-orphan")
    products:    Mapped[list["StoreProduct"]]   = relationship("StoreProduct",  back_populates="store", cascade="all, delete-orphan")
    orders:      Mapped[list["StoreOrder"]]     = relationship("StoreOrder",    back_populates="store", cascade="all, delete-orphan")


# ─── StoreCategory ───────────────────────────────────────────────────
class StoreCategory(Base):
    __tablename__ = "store_categories"

    id:          Mapped[str]        = mapped_column(String, primary_key=True)
    store_id:    Mapped[str]        = mapped_column(String, ForeignKey("stores.id"), index=True)
    name_ar:     Mapped[str]        = mapped_column(String(200))
    name_en:     Mapped[str | None] = mapped_column(String(200), nullable=True)
    image_url:   Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order:  Mapped[int]        = mapped_column(Integer, default=0)
    is_active:   Mapped[bool]       = mapped_column(Boolean, default=True)
    created_at:  Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)

    store:       Mapped["Store"]    = relationship("Store", back_populates="categories")
    products:    Mapped[list["StoreProduct"]] = relationship("StoreProduct", back_populates="category")


# ─── StoreProduct ────────────────────────────────────────────────────
class StoreProduct(Base):
    __tablename__ = "store_products"

    id:               Mapped[str]           = mapped_column(String, primary_key=True)
    store_id:         Mapped[str]           = mapped_column(String, ForeignKey("stores.id"), index=True)
    category_id:      Mapped[str | None]    = mapped_column(String, ForeignKey("store_categories.id"), nullable=True)
    inventory_item_id:Mapped[str | None]    = mapped_column(String, ForeignKey("inventory_items.id"), nullable=True)

    # البيانات الأساسية
    name_ar:          Mapped[str]           = mapped_column(String(500))
    name_en:          Mapped[str | None]    = mapped_column(String(500), nullable=True)
    description_ar:   Mapped[str | None]    = mapped_column(Text, nullable=True)
    description_en:   Mapped[str | None]    = mapped_column(Text, nullable=True)
    brand:            Mapped[str | None]    = mapped_column(String(200), nullable=True)
    sku:              Mapped[str | None]    = mapped_column(String(100), nullable=True)

    # السعر
    price:            Mapped[Decimal]       = mapped_column(Numeric(18, 2))
    compare_price:    Mapped[Decimal | None]= mapped_column(Numeric(18, 2), nullable=True)

    # الصور
    image_url:        Mapped[str | None]    = mapped_column(Text, nullable=True)
    images_json:      Mapped[str | None]    = mapped_column(Text, nullable=True)  # JSON array

    # المخزون
    stock_quantity:   Mapped[int]           = mapped_column(Integer, default=0)
    allow_backorder:  Mapped[bool]          = mapped_column(Boolean, default=False)
    track_inventory:  Mapped[bool]          = mapped_column(Boolean, default=True)

    # الحالة
    is_active:        Mapped[bool]          = mapped_column(Boolean, default=True)
    is_featured:      Mapped[bool]          = mapped_column(Boolean, default=False)

    created_at:       Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:       Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store:            Mapped["Store"]           = relationship("Store", back_populates="products")
    category:         Mapped["StoreCategory | None"] = relationship("StoreCategory", back_populates="products")


# ─── StoreOrder ──────────────────────────────────────────────────────
class StoreOrder(Base):
    __tablename__ = "store_orders"

    id:               Mapped[str]           = mapped_column(String, primary_key=True)
    store_id:         Mapped[str]           = mapped_column(String, ForeignKey("stores.id"), index=True)
    order_number:     Mapped[str]           = mapped_column(String(50), unique=True, index=True)

    # بيانات العميل
    customer_name:    Mapped[str]           = mapped_column(String(300))
    customer_phone:   Mapped[str]           = mapped_column(String(20))
    customer_email:   Mapped[str | None]    = mapped_column(String(200), nullable=True)

    # الشحن
    shipping_city:    Mapped[str | None]    = mapped_column(String(200), nullable=True)
    shipping_address: Mapped[str | None]    = mapped_column(Text, nullable=True)

    # المالية
    subtotal:         Mapped[Decimal]       = mapped_column(Numeric(18, 2))
    shipping_cost:    Mapped[Decimal]       = mapped_column(Numeric(18, 2), default=Decimal("0"))
    total:            Mapped[Decimal]       = mapped_column(Numeric(18, 2))

    # الحالة
    status:           Mapped[OrderStatus]   = mapped_column(
        SAEnum(OrderStatus, values_callable=lambda x: [e.value for e in x]),
        default=OrderStatus.PENDING
    )
    payment_method:   Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod, values_callable=lambda x: [e.value for e in x]),
        default=PaymentMethod.COD
    )

    notes:            Mapped[str | None]    = mapped_column(Text, nullable=True)
    created_at:       Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:       Mapped[datetime]      = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store:            Mapped["Store"]       = relationship("Store", back_populates="orders")
    lines:            Mapped[list["StoreOrderLine"]] = relationship("StoreOrderLine", back_populates="order", cascade="all, delete-orphan")


# ─── StoreOrderLine ──────────────────────────────────────────────────
class StoreOrderLine(Base):
    __tablename__ = "store_order_lines"

    id:           Mapped[str]     = mapped_column(String, primary_key=True)
    order_id:     Mapped[str]     = mapped_column(String, ForeignKey("store_orders.id"), index=True)
    product_id:   Mapped[str]     = mapped_column(String, ForeignKey("store_products.id"))
    product_name: Mapped[str]     = mapped_column(String(500))  # snapshot
    unit_price:   Mapped[Decimal] = mapped_column(Numeric(18, 2))
    quantity:     Mapped[int]     = mapped_column(Integer)
    total:        Mapped[Decimal] = mapped_column(Numeric(18, 2))
    variant_id:   Mapped[str | None] = mapped_column(String, nullable=True)
    variant_info: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON

    order:        Mapped["StoreOrder"] = relationship("StoreOrder", back_populates="lines")
