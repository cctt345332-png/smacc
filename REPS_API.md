# توثيق API — تطبيق المندوب

**Base URL:** `https://your-domain.com/api/v1`  
**Content-Type:** `application/json`  
**Authentication:** Bearer Token (JWT)

---

## أولاً: تسجيل الدخول

المندوب يدخل بالبريد وكلمة المرور اللي أنشأها له المدير في النظام.

```http
POST /api/v1/auth/login
```

**Request:**
```json
{
  "email": "ahmed@example.com",
  "password": "SecurePass123"
}
```

**Response 200:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

> احفظ الـ `access_token` وأرسله في كل طلب بعد كده في الـ Header:
> ```
> Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
> ```

**Response 401 — بيانات خاطئة:**
```json
{
  "detail": "بيانات الدخول غير صحيحة"
}
```

---

## ثانياً: Endpoints التطبيق

كل الطلبات تحتاج Header:
```
Authorization: Bearer <access_token>
```

---

### 1. بيانات المندوب

```http
GET /api/v1/reps/me/profile
```

تُستخدم عند فتح التطبيق لعرض اسم المندوب ومنطقته وكوده.

**Response 200:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "rep_code": "REP-001",
  "full_name": "أحمد محمد",
  "email": "ahmed@example.com",
  "phone": "0501234567",
  "zone": "الرياض — شمال",
  "notes": "مندوب منطقة الشمال",
  "warehouse_id": "w1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "warehouse_name": "مستودع المندوب — أحمد محمد",
  "is_active": true,
  "created_at": "2024-01-15T10:30:00"
}
```

**Response 403 — الحساب ليس مندوباً:**
```json
{
  "detail": "هذا الحساب ليس مندوباً"
}
```

---

### 2. مخزوني الحالي

```http
GET /api/v1/reps/me/stock
```

يرجع قائمة المنتجات الموجودة في مستودع المندوب مع الكميات.

**Response 200:**
```json
[
  {
    "item_id": "i1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "item_code": "PROD-001",
    "name_ar": "عصير برتقال 1 لتر",
    "name_en": "Orange Juice 1L",
    "quantity": 150.0,
    "unit": "علبة",
    "warehouse_id": "w1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "warehouse_name": "مستودع المندوب — أحمد محمد"
  },
  {
    "item_id": "i2c3d4e5-f6a7-8901-bcde-f12345678901",
    "item_code": "PROD-002",
    "name_ar": "مياه معدنية 500 مل",
    "name_en": "Mineral Water 500ml",
    "quantity": 300.0,
    "unit": "زجاجة",
    "warehouse_id": "w1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "warehouse_name": "مستودع المندوب — أحمد محمد"
  }
]
```

> **ملاحظة:** لو المخزون صفر يرجع قائمة فارغة `[]` — مش خطأ.

---

### 3. فواتيري

```http
GET /api/v1/reps/me/invoices
```

يرجع كل الفواتير اللي أصدرها المندوب مرتبة من الأحدث.

**Response 200:**
```json
[
  {
    "id": "inv-001",
    "invoice_number": "INV-2024-0101",
    "customer_name": "شركة النور للتجارة",
    "total": 1500.00,
    "paid": 1000.00,
    "remaining": 500.00,
    "status": "partial",
    "created_at": "2024-03-01T11:00:00",
    "lines": [
      {
        "item_name": "عصير برتقال 1 لتر",
        "quantity": 50,
        "unit_price": 20.00,
        "total": 1000.00
      },
      {
        "item_name": "مياه معدنية 500 مل",
        "quantity": 100,
        "unit_price": 5.00,
        "total": 500.00
      }
    ]
  },
  {
    "id": "inv-002",
    "invoice_number": "INV-2024-0102",
    "customer_name": "مؤسسة الأمل",
    "total": 800.00,
    "paid": 800.00,
    "remaining": 0.00,
    "status": "paid",
    "created_at": "2024-03-03T09:30:00",
    "lines": [
      {
        "item_name": "عصير برتقال 1 لتر",
        "quantity": 40,
        "unit_price": 20.00,
        "total": 800.00
      }
    ]
  }
]
```

**قيم `status`:**
| القيمة | المعنى |
|--------|--------|
| `paid` | مدفوعة بالكامل |
| `partial` | مدفوعة جزئياً |
| `unpaid` | غير مدفوعة |

---

### 4. سندات قبضي

```http
GET /api/v1/reps/me/payments
```

يرجع سندات القبض (المبالغ المحصّلة) من العملاء.

**Response 200:**
```json
[
  {
    "id": "pay-001",
    "payment_number": "RCP-2024-001",
    "customer_name": "شركة النور للتجارة",
    "amount": 1000.00,
    "payment_method": "cash",
    "notes": "دفعة أولى",
    "created_at": "2024-03-05T14:00:00"
  },
  {
    "id": "pay-002",
    "payment_number": "RCP-2024-002",
    "customer_name": "مؤسسة الأمل",
    "amount": 500.00,
    "payment_method": "transfer",
    "notes": null,
    "created_at": "2024-03-08T10:30:00"
  }
]
```

**قيم `payment_method`:**
| القيمة | المعنى |
|--------|--------|
| `cash` | نقداً |
| `transfer` | تحويل بنكي |
| `check` | شيك |
| `card` | بطاقة |

---

### 5. ملخص أدائي

```http
GET /api/v1/reps/me/summary
```

يُستخدم للوحة الرئيسية (Dashboard) — يعطي نظرة سريعة على الأداء.

**Response 200:**
```json
{
  "rep_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "rep_code": "REP-001",
  "full_name": "أحمد محمد",
  "zone": "الرياض — شمال",
  "warehouse_name": "مستودع المندوب — أحمد محمد",
  "total_sales": 25000.00,
  "invoice_count": 18,
  "total_collected": 20000.00,
  "outstanding": 5000.00,
  "stock_qty": 245.0
}
```

| الحقل | الوصف |
|-------|-------|
| `total_sales` | إجمالي قيمة الفواتير |
| `invoice_count` | عدد الفواتير |
| `total_collected` | إجمالي المبالغ المحصّلة |
| `outstanding` | المبالغ غير المحصّلة (ديون) |
| `stock_qty` | الكمية الإجمالية الحالية في مستودعه |

**Response 403:**
```json
{
  "detail": "هذا الحساب ليس مندوباً"
}
```

---

### 6. سجل مناقلات مخزوني

```http
GET /api/v1/reps/me/transfers
```

يرجع تاريخ تحميل البضاعة وإرجاعها — من وإلى مستودع المندوب.

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
  },
  {
    "date": "2024-03-12 14:30",
    "direction": "out",
    "from_warehouse": "مستودع المندوب — أحمد محمد",
    "to_warehouse": "المستودع الرئيسي",
    "product_name": "عصير برتقال 1 لتر",
    "quantity": 5.0,
    "serials": [],
    "notes": "إرجاع بضاعة"
  },
  {
    "date": "2024-03-15 11:00",
    "direction": "in",
    "from_warehouse": "المستودع الرئيسي",
    "to_warehouse": "مستودع المندوب — أحمد محمد",
    "product_name": "مياه معدنية 500 مل",
    "quantity": 200.0,
    "serials": [],
    "notes": "تحميل مخزون للمندوب REP-001"
  }
]
```

**قيم `direction`:**
| القيمة | المعنى |
|--------|--------|
| `in` | بضاعة دخلت لمستودعك (تحميل) |
| `out` | بضاعة خرجت من مستودعك (إرجاع أو بيع) |

---

## ملخص كل الـ Endpoints

| # | Method | Endpoint | متى تستخدمها |
|---|--------|----------|--------------|
| — | `POST` | `/auth/login` | أول فتح التطبيق — تسجيل الدخول |
| 1 | `GET` | `/reps/me/profile` | عرض بيانات المندوب |
| 2 | `GET` | `/reps/me/stock` | شاشة المخزون |
| 3 | `GET` | `/reps/me/invoices` | شاشة الفواتير |
| 4 | `GET` | `/reps/me/payments` | شاشة التحصيل |
| 5 | `GET` | `/reps/me/summary` | الشاشة الرئيسية (Dashboard) |
| 6 | `GET` | `/reps/me/transfers` | سجل تحميل البضاعة |

---

## أكواد الأخطاء

| الكود | المعنى | ما تسويه |
|-------|--------|----------|
| `401` | التوكن منتهي أو غير موجود | أرجعه لشاشة الدخول |
| `403` | الحساب ليس مندوباً | أظهر رسالة خطأ |
| `404` | البيانات غير موجودة | أظهر قائمة فارغة |
| `500` | خطأ في الخادم | أظهر رسالة "حاول مرة ثانية" |

---

## تدفق التطبيق (Flow)

```
فتح التطبيق
    ↓
POST /auth/login  →  احفظ access_token
    ↓
GET /reps/me/profile  →  اعرض اسم المندوب
    ↓
GET /reps/me/summary  →  الشاشة الرئيسية

─────────────────────────────
من القائمة الجانبية:
  ├── مخزوني     →  GET /reps/me/stock
  ├── فواتيري    →  GET /reps/me/invoices
  ├── تحصيلاتي   →  GET /reps/me/payments
  └── حركة البضاعة →  GET /reps/me/transfers
```

---

*SMACC ERP — Sales Rep App API*
