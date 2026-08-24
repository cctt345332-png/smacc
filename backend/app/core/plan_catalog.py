"""Single commercial plan catalogue shared by administration and public onboarding APIs."""

from copy import deepcopy

DEFAULT_PLAN_CATALOG: dict[str, dict] = {
    "trial": {
        "key": "trial", "label_ar": "تجريبية", "label_en": "Free Trial",
        "price_monthly": 0, "price_yearly": 0, "color": "#176545", "bg": "#E8F1E9", "popular": False,
        "is_active": True,
        "limits": {"invoices_per_month": 50, "users": 2, "warehouses": 1, "branches": 1, "pos_terminals": 1, "trial_days": 14},
        "modules": ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
        "features_ar": ["14 يومًا مجانًا", "50 فاتورة شهريًا", "مستخدمان", "مستودع واحد", "نقطة بيع واحدة", "تقارير أساسية"],
        "features_en": ["14 days free", "50 invoices/month", "2 users", "1 warehouse", "1 POS terminal", "Basic reports"],
    },
    "starter": {
        "key": "starter", "label_ar": "أساسية", "label_en": "Starter",
        "price_monthly": 99, "price_yearly": 990, "color": "#0B5D4A", "bg": "#E8F1E9", "popular": False,
        "is_active": True,
        "limits": {"invoices_per_month": 300, "users": 3, "warehouses": 1, "branches": 1, "pos_terminals": 1},
        "modules": ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
        "features_ar": ["300 فاتورة شهريًا", "3 مستخدمين", "مستودع واحد", "فرع واحد", "نقطة بيع واحدة", "تقارير أساسية", "دعم بالبريد الإلكتروني"],
        "features_en": ["300 invoices/month", "3 users", "1 warehouse", "1 branch", "1 POS terminal", "Basic reports", "Email support"],
    },
    "professional": {
        "key": "professional", "label_ar": "احترافية", "label_en": "Professional",
        "price_monthly": 249, "price_yearly": 2490, "color": "#126D57", "bg": "#EDF7EF", "popular": True,
        "is_active": True,
        "limits": {"invoices_per_month": 2000, "users": 10, "warehouses": 3, "branches": 3, "pos_terminals": 3},
        "modules": ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "hr", "assets", "reports"],
        "features_ar": ["2000 فاتورة شهريًا", "10 مستخدمين", "3 مستودعات", "3 فروع", "3 نقاط بيع", "موارد بشرية", "أصول ثابتة", "تقارير متقدمة", "دعم بالأولوية"],
        "features_en": ["2,000 invoices/month", "10 users", "3 warehouses", "3 branches", "3 POS terminals", "HR module", "Fixed assets", "Advanced reports", "Priority support"],
    },
    "enterprise": {
        "key": "enterprise", "label_ar": "مؤسسية", "label_en": "Enterprise",
        "price_monthly": 499, "price_yearly": 4990, "color": "#2E493C", "bg": "#EEF2EE", "popular": False,
        "is_active": True,
        "limits": {"invoices_per_month": None, "users": None, "warehouses": None, "branches": None, "pos_terminals": None},
        "modules": ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "hr", "assets", "reports"],
        "features_ar": ["فواتير غير محدودة", "مستخدمون غير محدودين", "مستودعات غير محدودة", "فروع غير محدودة", "نقاط بيع غير محدودة", "جميع الوحدات", "API مخصص", "دعم مخصص 24/7", "تدريب وإعداد"],
        "features_en": ["Unlimited invoices", "Unlimited users", "Unlimited warehouses", "Unlimited branches", "Unlimited POS terminals", "All modules", "Custom API", "Dedicated 24/7 support", "Training & onboarding"],
    },
}


def default_plan_catalog() -> dict[str, dict]:
    return deepcopy(DEFAULT_PLAN_CATALOG)
