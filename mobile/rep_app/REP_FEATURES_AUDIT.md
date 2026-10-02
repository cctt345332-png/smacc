# جرد ميزات تطبيق المندوب

مصادر الجرد داخل المشروع:
- `smacc-main/frontend/src/components/layout/RepLayout.tsx`
- `smacc-main/frontend/src/app/[locale]/reps/me/*`
- `smacc-main/frontend/src/lib/reps.ts`
- `smacc-main/REPS_APP_API.md`
- `smacc-main/backend/app/modules/reps/router.py`

## شريط الويب
- الرئيسية: `/reps/me/dashboard`
- الفواتير: `/reps/me/invoices`
- العملاء: `/reps/me/customers`
- المخزون: `/reps/me/stock`
- تقارير المندوب: `/reps/me/reports`
- إجراء سريع: فاتورة مبيعات، سند قبض، مرتجع مبيعات

## ميزات API
- `GET /reps/me/profile`
- `GET /reps/me/summary`
- `GET /reps/me/stock`
- `GET /reps/me/transfers`
- `GET /reps/me/payments`
- `GET /reps/me/attendance/today`
- `POST /reps/me/attendance/check-in`
- `POST /reps/me/location`
- `GET /reps/me/location/latest`
- `GET /sales/customers` و`POST/PATCH /sales/customers`
- `GET /sales/invoices` و`GET /sales/invoices/{id}`
- `POST /sales/invoices` ثم `POST /sales/invoices/{id}/confirm`
- `GET /sales/payments` و`POST /sales/payments`
- `POST /reps/me/credit-notes`
- `GET /inventory/items/picker`
- `GET /inventory/items/{id}/available-serials`

## خطة تطبيق الجوال
شريط سفلي ثابت:
1. الرئيسية
2. الفواتير
3. العملاء
4. المخزون
5. المزيد

قائمة المزيد:
- سندات القبض
- المناقلات
- تقارير المندوب
- الحضور والانصراف
- الملف الشخصي وتسجيل الخروج

عنوان API الإنتاج:
`https://api.masa-erp.com/api/v1`
