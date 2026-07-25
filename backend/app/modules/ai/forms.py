"""
AI Conversational Forms
-----------------------
يعرّف الحقول الكاملة لكل كيان حسب نوع النشاط.
الـ AI يسأل عنها خطوة بخطوة قبل الإنشاء.
"""
from __future__ import annotations

# ══════════════════════════════════════════════════════════════════════
# تعريف الحقول لكل كيان
# ══════════════════════════════════════════════════════════════════════

CUSTOMER_FIELDS = {
    "required": [
        {"key": "name_ar",       "label_ar": "اسم العميل (عربي)",      "label_en": "Customer Name (Arabic)",  "type": "text"},
    ],
    "optional": [
        {"key": "customer_type", "label_ar": "نوع العميل",              "label_en": "Customer Type",           "type": "choice", "choices": ["company=شركة", "individual=فرد", "government=حكومي"]},
        {"key": "vat_number",    "label_ar": "الرقم الضريبي",           "label_en": "VAT Number",              "type": "text",   "hint": "15 رقم يبدأ وينتهي بـ 3"},
        {"key": "cr_number",     "label_ar": "رقم السجل التجاري",       "label_en": "CR Number",               "type": "text"},
        {"key": "phone",         "label_ar": "رقم الهاتف",              "label_en": "Phone",                   "type": "text"},
        {"key": "email",         "label_ar": "البريد الإلكتروني",       "label_en": "Email",                   "type": "text"},
        {"key": "address_city",  "label_ar": "المدينة",                 "label_en": "City",                    "type": "text"},
        {"key": "address_street","label_ar": "الشارع",                  "label_en": "Street",                  "type": "text"},
        {"key": "credit_limit",  "label_ar": "حد الائتمان (ر.س)",       "label_en": "Credit Limit (SAR)",      "type": "number", "default": "0"},
        {"key": "payment_terms_days", "label_ar": "أيام الدفع",         "label_en": "Payment Terms (days)",    "type": "number", "default": "30"},
        {"key": "notes",         "label_ar": "ملاحظات",                 "label_en": "Notes",                   "type": "text"},
    ]
}

VENDOR_FIELDS = {
    "required": [
        {"key": "name_ar",       "label_ar": "اسم المورد (عربي)",       "label_en": "Vendor Name (Arabic)",    "type": "text"},
    ],
    "optional": [
        {"key": "vendor_type",   "label_ar": "نوع المورد",              "label_en": "Vendor Type",             "type": "choice", "choices": ["company=شركة", "individual=فرد"]},
        {"key": "vat_number",    "label_ar": "الرقم الضريبي",           "label_en": "VAT Number",              "type": "text"},
        {"key": "cr_number",     "label_ar": "رقم السجل التجاري",       "label_en": "CR Number",               "type": "text"},
        {"key": "phone",         "label_ar": "رقم الهاتف",              "label_en": "Phone",                   "type": "text"},
        {"key": "email",         "البريد الإلكتروني": "email",          "label_en": "Email",                   "type": "text"},
        {"key": "address_city",  "label_ar": "المدينة",                 "label_en": "City",                    "type": "text"},
        {"key": "payment_terms_days", "label_ar": "أيام الدفع",         "label_en": "Payment Terms (days)",    "type": "number", "default": "30"},
        {"key": "notes",         "label_ar": "ملاحظات",                 "label_en": "Notes",                   "type": "text"},
    ]
}

# حقول الصنف حسب نوع التتبع
ITEM_FIELDS_BASE = {
    "required": [
        {"key": "name_ar",       "label_ar": "اسم الصنف (عربي)",        "label_en": "Item Name (Arabic)",      "type": "text"},
        {"key": "sale_price",    "label_ar": "سعر البيع (ر.س)",          "label_en": "Sale Price (SAR)",        "type": "number"},
        {"key": "cost_price",    "label_ar": "سعر التكلفة (ر.س)",        "label_en": "Cost Price (SAR)",        "type": "number"},
    ],
    "optional": [
        {"key": "barcode",       "label_ar": "الباركود",                 "label_en": "Barcode",                 "type": "text"},
        {"key": "unit_type",     "label_ar": "وحدة القياس",              "label_en": "Unit Type",               "type": "choice", "choices": ["piece=قطعة", "kg=كيلو", "liter=لتر", "meter=متر", "box=صندوق"]},
        {"key": "reorder_point", "label_ar": "نقطة إعادة الطلب",        "label_en": "Reorder Point",           "type": "number", "default": "0"},
        {"key": "vat_rate",      "label_ar": "نسبة الضريبة %",           "label_en": "VAT Rate %",              "type": "number", "default": "15"},
    ]
}

# حقول إضافية للسيريال (جوالات/إلكترونيات/قطع غيار)
ITEM_FIELDS_SERIAL = {
    "required": ITEM_FIELDS_BASE["required"],
    "optional": ITEM_FIELDS_BASE["optional"] + [
        {"key": "color",         "label_ar": "اللون",                   "label_en": "Color",                   "type": "text"},
        {"key": "storage",       "label_ar": "السعة التخزينية",         "label_en": "Storage",                 "type": "text",   "hint": "مثال: 128GB"},
    ],
    "tracking_type": "serial",
    "note_ar": "هذا الصنف يستخدم تتبع السيريال — كل وحدة لها رقم سيريال خاص",
}

# حقول إضافية للصيدلية
ITEM_FIELDS_PHARMACY = {
    "required": ITEM_FIELDS_BASE["required"] + [
        {"key": "manufacturer",  "label_ar": "الشركة المصنّعة",         "label_en": "Manufacturer",            "type": "text"},
    ],
    "optional": ITEM_FIELDS_BASE["optional"] + [
        {"key": "generic_name",  "label_ar": "الاسم العلمي",            "label_en": "Generic Name",            "type": "text"},
        {"key": "dosage_form",   "label_ar": "الشكل الدوائي",           "label_en": "Dosage Form",             "type": "text",   "hint": "مثال: أقراص، شراب، حقن"},
        {"key": "concentration", "label_ar": "التركيز",                 "label_en": "Concentration",           "type": "text",   "hint": "مثال: 500mg"},
        {"key": "sfda_number",   "label_ar": "رقم هيئة الغذاء والدواء","label_en": "SFDA Number",             "type": "text"},
        {"key": "requires_prescription", "label_ar": "يستلزم وصفة طبية","label_en": "Requires Prescription",  "type": "boolean"},
        {"key": "country_of_origin", "label_ar": "بلد المنشأ",          "label_en": "Country of Origin",       "type": "text"},
    ],
    "tracking_type": "batch",
    "note_ar": "هذا الصنف يستخدم تتبع التشغيلة وتاريخ الانتهاء",
}

# حقول الملابس (متغيرات)
ITEM_FIELDS_VARIANT = {
    "required": ITEM_FIELDS_BASE["required"],
    "optional": ITEM_FIELDS_BASE["optional"],
    "tracking_type": "variant",
    "note_ar": "هذا الصنف يستخدم متغيرات (مقاس + لون) — ستحتاج لإضافة المتغيرات من صفحة الصنف",
}

# خريطة نوع النشاط → نوع الحقول
ACTIVITY_TO_ITEM_FIELDS = {
    "mobile_phones": ITEM_FIELDS_SERIAL,
    "spare_parts":   ITEM_FIELDS_SERIAL,
    "pharmacy":      ITEM_FIELDS_PHARMACY,
    "clothing":      ITEM_FIELDS_VARIANT,
    "grocery":       ITEM_FIELDS_BASE,
    "spices":        ITEM_FIELDS_BASE,
    "construction":  ITEM_FIELDS_BASE,
    "general":       ITEM_FIELDS_BASE,
}


def get_item_fields_for_activity(business_type: str) -> dict:
    """يرجع الحقول المناسبة حسب نوع النشاط"""
    return ACTIVITY_TO_ITEM_FIELDS.get(business_type, ITEM_FIELDS_BASE)


def build_creation_prompt(entity: str, business_type: str = "general") -> str:
    """
    يبني prompt للـ AI يشرح له الحقول المطلوبة
    ويطلب منه جمعها من المستخدم قبل الإنشاء
    """
    if entity == "customer":
        fields = CUSTOMER_FIELDS
        entity_ar = "عميل"
    elif entity == "vendor":
        fields = VENDOR_FIELDS
        entity_ar = "مورد"
    elif entity == "item":
        fields = get_item_fields_for_activity(business_type)
        entity_ar = "صنف"
    else:
        return ""

    required = [f["label_ar"] for f in fields["required"]]
    optional = [f["label_ar"] for f in fields.get("optional", [])]
    tracking_note = fields.get("note_ar", "")

    prompt = f"""
لإنشاء {entity_ar} جديد، اجمع المعلومات التالية من المستخدم:

الحقول المطلوبة (لا يمكن الإنشاء بدونها):
{chr(10).join(f"- {f}" for f in required)}

الحقول الاختيارية (اسأل عنها):
{chr(10).join(f"- {f}" for f in optional[:6])}

{f"ملاحظة: {tracking_note}" if tracking_note else ""}

قواعد:
1. اسأل عن الحقول المطلوبة أولاً
2. اسأل عن الاختيارية بشكل طبيعي في المحادثة
3. بعد جمع المعلومات الكافية، استخدم create_{entity} tool
4. لا تُنشئ بدون الحقول المطلوبة على الأقل
"""
    return prompt
