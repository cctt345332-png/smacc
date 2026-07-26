# توثيق API — تطبيق المندوب (كامل)

**Base URL:** `http://192.168.0.18:8000/api/v1`
**Content-Type:** `application/json`
**Auth:** كل الطلبات تحتاج Header: `Authorization: Bearer <token>`

---

## 1. تسجيل الدخول

```http
POST /auth/login
```

**Request:**
```json
{
  "email": "rep@example.com",
  "password": "password123"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "rep@example.com",
    "full_name": "أحمد محمد",
    "role": "sales_rep",
    "tenant_id": "uuid"
  }
}
```

> احفظ `access_token` واستخدمه في كل طلب.
> عند `401` → أرجع للمستخدم لشاشة الدخول.

---

## 2. بروفايل المندوب

```http
GET /reps/me/profile
```

**Response 200:**
```json
{
  "id": "uuid",
  "rep_code": "REP-001",
  "full_name": "أحمد محمد",
  "email": "rep@example.com",
  "phone": "0501234567",
  "zone": "الرياض — شمال",
  "warehouse_id": "uuid",
  "warehouse_name": "مستودع المندوب — أحمد محمد",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00"
}
```

---

## 3. ملخص الأداء (الشاشة الرئيسية)

```http
GET /reps/me/summary
```

**Response 200:**
```json
{
  "rep_id": "uuid",
  "rep_code": "REP-001",
  "full_name": "أحمد محمد",
  "total_sales": 25000.00,
  "invoice_count": 18,
  "total_collected": 20000.00,
  "outstanding": 5000.00,
  "stock_qty": 245.0
}
```

---

## 4. العملاء

### 4.1 قائمة العملاء

```http
GET /sales/customers
GET /sales/customers?search=شركة النور
```

> المندوب يرى عملاءه فقط تلقائياً.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "customer_number": "CUST-001",
    "customer_type": "company",
    "name_ar": "شركة النور للتجارة",
    "name_en": "Al Noor Trading",
    "phone": "0112345678",
    "email": "info@alnoor.com",
    "address_city": "الرياض",
    "vat_number": "300000000000003",
    "credit_limit": 10000.00,
    "is_active": true
  }
]
```

### 4.2 إنشاء عميل

```http
POST /sales/customers
```

**Request — الحقول المطلوبة فقط:**
```json
{
  "name_ar": "شركة الأمل",
  "customer_type": "company",
  "phone": "0551234567"
}
```

**Request — كامل:**
```json
{
  "customer_type": "company",
  "name_ar": "شركة الأمل للتجارة",
  "name_en": "Al Amal Trading",
  "vat_number": "300000000000003",
  "cr_number": "1010000001",
  "phone": "0551234567",
  "phone2": "0559876543",
  "email": "info@alamal.com",
  "address_street": "شارع الملك فهد",
  "address_building": "12",
  "address_district": "العليا",
  "address_city": "الرياض",
  "address_postal": "12211",
  "address_country": "SA",
  "credit_limit": 5000.00,
  "payment_terms_days": 30,
  "notes": "عميل منطقة الشمال"
}
```

> **قيم `customer_type`:** `company` | `individual`

> عند الإنشاء من المندوب — العميل يُنسب له تلقائياً بدون أي إضافة.

**Response 201:** نفس شكل `CustomerOut`.

### 4.3 تعديل عميل

```http
PATCH /sales/customers/{customer_id}
```

**Request:** أرسل فقط الحقول اللي تبي تغيرها.
```json
{
  "phone": "0559999999",
  "address_city": "جدة"
}
```

---

## 5. الفواتير

### 5.1 قائمة الفواتير

```http
GET /sales/invoices
GET /sales/invoices?status=unpaid
GET /sales/invoices?customer_id=uuid
```

> المندوب يرى فواتيره فقط تلقائياً.

**قيم `status`:** `draft` | `confirmed` | `paid` | `partial` | `unpaid` | `cancelled`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "invoice_number": "INV-2024-0001",
    "customer_id": "uuid",
    "buyer_name_ar": "شركة النور",
    "status": "partial",
    "issue_date": "2024-03-01T00:00:00",
    "due_date": "2024-04-01T00:00:00",
    "subtotal": 1000.00,
    "vat_amount": 150.00,
    "total": 1150.00,
    "paid_amount": 500.00,
    "lines": []
  }
]
```

### 5.2 تفاصيل فاتورة

```http
GET /sales/invoices/{invoice_id}
```

**Response 200:**
```json
{
  "id": "uuid",
  "invoice_number": "INV-2024-0001",
  "uuid": "uuid-zatca",
  "invoice_type": "standard",
  "status": "confirmed",
  "customer_id": "uuid",
  "buyer_name_ar": "شركة النور",
  "buyer_vat_number": "300000000000003",
  "issue_date": "2024-03-01T00:00:00",
  "supply_date": "2024-03-01T00:00:00",
  "due_date": "2024-04-01T00:00:00",
  "subtotal": 1000.00,
  "discount_amount": 0.00,
  "taxable_amount": 1000.00,
  "vat_amount": 150.00,
  "total": 1150.00,
  "paid_amount": 500.00,
  "qr_code": "base64string...",
  "seller_name_ar": "شركة ماسر",
  "seller_vat_number": "300000000000001",
  "lines": [
    {
      "id": "uuid",
      "line_order": 0,
      "description_ar": "عصير برتقال 1 لتر",
      "quantity": 50,
      "unit": "علبة",
      "unit_price": 20.00,
      "discount_pct": 0,
      "discount_amount": 0,
      "vat_rate": 15,
      "subtotal": 1000.00,
      "vat_amount": 150.00,
      "total": 1150.00,
      "inventory_item_id": "uuid"
    }
  ]
}
```

### 5.3 إنشاء فاتورة

```http
POST /sales/invoices
```

**Request — منتجات عادية (quantity):**
```json
{
  "customer_id": "uuid-العميل",
  "invoice_type": "standard",
  "issue_date": "2024-03-15T10:00:00",
  "supply_date": "2024-03-15T10:00:00",
  "due_date": "2024-04-15T10:00:00",
  "notes": "ملاحظات اختيارية",
  "lines": [
    {
      "description_ar": "عصير برتقال 1 لتر",
      "quantity": 50,
      "unit": "علبة",
      "unit_price": 20.00,
      "discount_pct": 0,
      "vat_rate": 15,
      "inventory_item_id": "uuid-الصنف"
    }
  ]
}
```

**Request — منتجات سيريال (جوالات/إلكترونيات):**
```json
{
  "customer_id": "uuid-العميل",
  "invoice_type": "standard",
  "issue_date": "2024-03-15T10:00:00",
  "supply_date": "2024-03-15T10:00:00",
  "lines": [
    {
      "description_ar": "iPhone 15 Pro Max",
      "quantity": 1,
      "unit_price": 5000.00,
      "vat_rate": 15,
      "inventory_item_id": "uuid-الصنف",
      "serial_ids": ["uuid-serial-1", "uuid-serial-2"]
    }
  ]
}
```

**حقول السطر (lines):**

| الحقل | النوع | مطلوب | الوصف |
|-------|-------|--------|-------|
| `description_ar` | string | ✅ | اسم الصنف |
| `quantity` | number | ✅ | الكمية |
| `unit_price` | number | ✅ | سعر الوحدة |
| `discount_pct` | number | ❌ | نسبة الخصم (0-100) |
| `vat_rate` | number | ❌ | نسبة الضريبة (افتراضي: 15) |
| `inventory_item_id` | string | ❌ | UUID الصنف من المخزون |
| `serial_ids` | array | ❌ | قائمة UUIDs السيريالات |

**Response 201:** نفس شكل `InvoiceOut`.

### 5.4 تأكيد فاتورة

```http
POST /sales/invoices/{invoice_id}/confirm
```

> الفاتورة لازم تكون `draft` عشان تقدر تأكدها — بعد التأكيد تصير `confirmed` وتُخصم من المخزون.

**Response 200:** نفس شكل `InvoiceOut` بـ `status: "confirmed"`.

---

## 6. سندات القبض

### 6.1 قائمة السندات

```http
GET /sales/payments
GET /sales/payments?invoice_id=uuid
```

> المندوب يرى سنداته فقط.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "payment_number": "RCP-2024-001",
    "invoice_id": "uuid",
    "customer_id": "uuid",
    "payment_date": "2024-03-05T14:00:00",
    "amount": 1000.00,
    "payment_method": "cash",
    "reference": null,
    "created_at": "2024-03-05T14:00:00"
  }
]
```

### 6.2 إنشاء سند قبض

```http
POST /sales/payments
```

**Request:**
```json
{
  "invoice_id": "uuid-الفاتورة",
  "payment_date": "2024-03-15T10:00:00",
  "amount": 575.00,
  "payment_method": "cash",
  "reference": "رقم الإيصال اختياري",
  "notes": "ملاحظة اختيارية"
}
```

**قيم `payment_method`:**
| القيمة | المعنى |
|--------|--------|
| `cash` | نقداً |
| `transfer` | تحويل بنكي |
| `check` | شيك |
| `card` | بطاقة |

**Response 201:** نفس شكل `PaymentOut`.

---

## 7. المخزون

### 7.1 مخزون المندوب (من مستودعه)

```http
GET /reps/me/stock
```

**Response 200:**
```json
[
  {
    "item_id": "uuid",
    "item_name": "عصير برتقال 1 لتر",
    "item_sku": "SKU-000001",
    "item_tracking": "quantity",
    "warehouse_id": "uuid",
    "warehouse_name": "مستودع المندوب — أحمد محمد",
    "quantity": 150.0,
    "available_qty": 150.0,
    "cost_price": 15.00,
    "sale_price": 20.00
  },
  {
    "item_id": "uuid",
    "item_name": "iPhone 15 Pro Max",
    "item_sku": "SKU-000002",
    "item_tracking": "serial",
    "warehouse_id": "uuid",
    "warehouse_name": "مستودع المندوب — أحمد محمد",
    "quantity": 3.0,
    "available_qty": 3.0,
    "cost_price": 4000.00,
    "sale_price": 5000.00
  }
]
```

> لما `item_tracking == "serial"` → `quantity` = عدد السيريالات المتاحة.

### 7.2 السيريالات المتاحة لصنف محدد

```http
GET /inventory/items/{item_id}/available-serials
```

> المندوب يرى سيريالات مستودعه فقط تلقائياً.

**Response 200:**
```json
[
  {
    "id": "uuid-serial",
    "serial_number": "IMEI123456789",
    "condition": "new",
    "cost_price": 4000.00,
    "sale_price": 5000.00,
    "warehouse_id": "uuid"
  },
  {
    "id": "uuid-serial-2",
    "serial_number": "IMEI987654321",
    "condition": "used",
    "cost_price": 3000.00,
    "sale_price": 3800.00,
    "warehouse_id": "uuid"
  }
]
```

**قيم `condition`:** `new` | `used` | `refurbished`

### 7.3 قائمة الأصناف للفاتورة (Picker)

```http
GET /inventory/items/picker
GET /inventory/items/picker?search=عصير
```

> يُستخدم لشاشة اختيار الأصناف عند إنشاء الفاتورة.
> المندوب يرى أصناف مستودعه فقط مع الكميات المتاحة.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "name_ar": "عصير برتقال 1 لتر",
    "name_en": "Orange Juice 1L",
    "sku": "SKU-000001",
    "barcode": "6281234567890",
    "tracking_type": "quantity",
    "unit_type": "piece",
    "sale_price": 20.00,
    "vat_rate": 15.0,
    "quantity_on_hand": 150.0,
    "category": {
      "id": "uuid",
      "name_ar": "مشروبات"
    }
  }
]
```

### 7.4 مناقلاتي (حركة المخزون)

```http
GET /reps/me/transfers
```

**Response 200:**
```json
[
  {
    "date": "2024-03-10 09:15",
    "direction": "in",
    "from_warehouse": "المستودع الرئيسي",
    "to_warehouse": "مستودع المندوب — أحمد محمد",
    "product_name": "عصير برتقال 1 لتر",
    "quantity": 50.0,
    "serials": [],
    "notes": "تحميل مخزون للمندوب REP-001"
  }
]
```

> `direction: "in"` = بضاعة وصلت لمستودعك
> `direction: "out"` = بضاعة خرجت من مستودعك

---

## 8. تدفق إنشاء فاتورة (Flow كامل)

```
1. GET /inventory/items/picker         → اعرض الأصناف للاختيار
   (لو serial → GET /inventory/items/{id}/available-serials)

2. GET /sales/customers                → اعرض العملاء للاختيار
   (أو POST /sales/customers          → أنشئ عميل جديد)

3. POST /sales/invoices                → أنشئ الفاتورة (status: draft)

4. POST /sales/invoices/{id}/confirm   → أكد الفاتورة (يخصم من المخزون)

5. POST /sales/payments                → استلم دفعة (اختياري)
```

---

## 9. أكواد الأخطاء الشائعة

| الكود | السبب | الحل |
|-------|-------|------|
| `400` | بيانات ناقصة أو خاطئة | اقرأ `detail` في الـ response |
| `401` | التوكن منتهي | أرجع لشاشة الدخول |
| `403` | ليس مندوباً أو صلاحية ناقصة | تأكد من الدور |
| `404` | العنصر غير موجود | تحقق من الـ UUID |
| `500` | خطأ في الخادم | أظهر "حدث خطأ، حاول مرة ثانية" |

---

## 10. ملخص كل الـ Endpoints

| # | Method | Endpoint | الشاشة |
|---|--------|----------|--------|
| — | `POST` | `/auth/login` | تسجيل الدخول |
| 1 | `GET` | `/reps/me/profile` | البروفايل |
| 2 | `GET` | `/reps/me/summary` | الرئيسية (Dashboard) |
| 3 | `GET` | `/reps/me/stock` | المخزون |
| 4 | `GET` | `/reps/me/transfers` | حركة البضاعة |
| 5 | `GET` | `/reps/me/payments` | سنداتي |
| 6 | `GET` | `/sales/customers` | قائمة العملاء |
| 7 | `POST` | `/sales/customers` | إنشاء عميل |
| 8 | `PATCH` | `/sales/customers/{id}` | تعديل عميل |
| 9 | `GET` | `/sales/invoices` | قائمة الفواتير |
| 10 | `GET` | `/sales/invoices/{id}` | تفاصيل فاتورة |
| 11 | `POST` | `/sales/invoices` | إنشاء فاتورة |
| 12 | `POST` | `/sales/invoices/{id}/confirm` | تأكيد فاتورة |
| 13 | `GET` | `/sales/payments` | قائمة السندات |
| 14 | `POST` | `/sales/payments` | إنشاء سند قبض |
| 15 | `GET` | `/inventory/items/picker` | اختيار أصناف للفاتورة |
| 16 | `GET` | `/inventory/items/{id}/available-serials` | سيريالات متاحة |
| 17 | `GET` | `/sales/invoices/summary` | إحصائيات المبيعات |

---

*SMACC ERP — Sales Rep App API — 2026*
