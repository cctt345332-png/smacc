/**
 * activityConfig.ts
 * ─────────────────
 * مصدر الحقيقة الوحيد لتكوين الأنشطة التجارية في النظام.
 * يُستخدم في: Sidebar، صفحة التسجيل، صفحة الهبوط، الكاشير، المخزون.
 */

// ─── أنواع الأنشطة ────────────────────────────────────────────────────
export type BusinessType =
  | "mobile_phones"
  | "spare_parts"
  | "pharmacy"
  | "grocery"
  | "spices"
  | "clothing"
  | "construction"
  | "general";

// ─── الوحدات المتاحة في النظام ────────────────────────────────────────
export type ModuleKey =
  | "dashboard"
  | "accounting"
  | "sales"
  | "purchases"
  | "inventory"
  | "pos"
  | "treasury"
  | "hr"
  | "assets"
  | "reports";

// ─── نوع التتبع لكل نشاط ─────────────────────────────────────────────
export type TrackingType = "serial" | "batch" | "quantity" | "variant" | "weight";

// ─── تكوين النشاط ────────────────────────────────────────────────────
export interface ActivityConfig {
  key: BusinessType;
  label_ar: string;
  label_en: string;
  desc_ar: string;
  desc_en: string;
  icon: string;           // اسم الأيقونة من Icons.tsx
  color: string;
  bg: string;
  tracking: TrackingType; // نوع التتبع الافتراضي
  allowPurchaseFromPOS: boolean;
  modules: ModuleKey[];   // الوحدات المتاحة لهذا النشاط
  inventoryFeatures: {
    serial: boolean;
    batch: boolean;
    variant: boolean;
    weight: boolean;
    expiry: boolean;
    pharmacy_fields: boolean;
  };
}

// ─── تعريف كل نشاط ───────────────────────────────────────────────────
export const ACTIVITIES: Record<BusinessType, ActivityConfig> = {

  mobile_phones: {
    key: "mobile_phones",
    label_ar: "جوالات وإلكترونيات",
    label_en: "Mobile Phones & Electronics",
    desc_ar: "بيع وشراء الجوالات والأجهزة الإلكترونية بتتبع السيريال",
    desc_en: "Buy and sell phones and electronics with serial tracking",
    icon: "mobile",
    color: "#5A187E",
    bg: "#EFF6FF",
    tracking: "serial",
    allowPurchaseFromPOS: true,
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
    inventoryFeatures: { serial: true, batch: false, variant: false, weight: false, expiry: false, pharmacy_fields: false },
  },

  spare_parts: {
    key: "spare_parts",
    label_ar: "قطع غيار",
    label_en: "Spare Parts",
    desc_ar: "إدارة قطع الغيار بتتبع السيريال والشراء المباشر",
    desc_en: "Manage spare parts with serial tracking and direct purchase",
    icon: "spareParts",
    color: "#75617F",
    bg: "#F5F3FF",
    tracking: "serial",
    allowPurchaseFromPOS: true,
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
    inventoryFeatures: { serial: true, batch: false, variant: false, weight: false, expiry: false, pharmacy_fields: false },
  },

  pharmacy: {
    key: "pharmacy",
    label_ar: "صيدلية",
    label_en: "Pharmacy",
    desc_ar: "إدارة الأدوية بتتبع التشغيلة وتاريخ الانتهاء وفق متطلبات SFDA",
    desc_en: "Manage medicines with batch tracking, expiry dates and SFDA compliance",
    icon: "pharmacy",
    color: "#6F4A84",
    bg: "#F4EFF7",
    tracking: "batch",
    allowPurchaseFromPOS: false,
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
    inventoryFeatures: { serial: false, batch: true, variant: false, weight: false, expiry: true, pharmacy_fields: true },
  },

  grocery: {
    key: "grocery",
    label_ar: "بقالة وسوبرماركت",
    label_en: "Grocery & Supermarket",
    desc_ar: "إدارة البقالة والمواد الغذائية بكميات وباركود",
    desc_en: "Manage grocery and food items with quantities and barcodes",
    icon: "grocery",
    color: "#D97706",
    bg: "#FFFBEB",
    tracking: "quantity",
    allowPurchaseFromPOS: false,
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
    inventoryFeatures: { serial: false, batch: false, variant: false, weight: false, expiry: false, pharmacy_fields: false },
  },

  spices: {
    key: "spices",
    label_ar: "عطارة وتوابل",
    label_en: "Spices & Herbs",
    desc_ar: "إدارة العطارة والتوابل بالوزن والكميات",
    desc_en: "Manage spices and herbs by weight and quantities",
    icon: "spices",
    color: "#B45309",
    bg: "#FEF3C7",
    tracking: "weight",
    allowPurchaseFromPOS: false,
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
    inventoryFeatures: { serial: false, batch: false, variant: false, weight: true, expiry: false, pharmacy_fields: false },
  },

  clothing: {
    key: "clothing",
    label_ar: "ملابس وأزياء",
    label_en: "Clothing & Fashion",
    desc_ar: "إدارة الملابس بالمتغيرات (مقاس، لون) والمتجر الإلكتروني",
    desc_en: "Manage clothing with variants (size, color) and online store",
    icon: "clothing",
    color: "#EC4899",
    bg: "#FDF2F8",
    tracking: "variant",
    allowPurchaseFromPOS: false,
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
    inventoryFeatures: { serial: false, batch: false, variant: true, weight: false, expiry: false, pharmacy_fields: false },
  },

  construction: {
    key: "construction",
    label_ar: "مواد بناء",
    label_en: "Construction Materials",
    desc_ar: "إدارة مواد البناء بالكميات والوحدات",
    desc_en: "Manage construction materials by quantities and units",
    icon: "construction",
    color: "#64748B",
    bg: "#F1F5F9",
    tracking: "quantity",
    allowPurchaseFromPOS: false,
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "treasury", "reports"],
    inventoryFeatures: { serial: false, batch: false, variant: false, weight: false, expiry: false, pharmacy_fields: false },
  },

  general: {
    key: "general",
    label_ar: "نشاط عام",
    label_en: "General Business",
    desc_ar: "نظام ERP متكامل لجميع أنواع الأنشطة التجارية",
    desc_en: "Full ERP system for all types of businesses",
    icon: "general",
    color: "#0F172A",
    bg: "#F8FAFC",
    tracking: "quantity",
    allowPurchaseFromPOS: false,
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "hr", "assets", "reports"],
    inventoryFeatures: { serial: false, batch: false, variant: false, weight: false, expiry: false, pharmacy_fields: false },
  },
};

// ─── خطط الاشتراك ─────────────────────────────────────────────────────
export type PlanKey = "trial" | "starter" | "professional" | "enterprise";

export interface PlanConfig {
  key: PlanKey;
  label_ar: string;
  label_en: string;
  price_monthly: number;   // ر.س / شهر (0 = مجاني)
  price_yearly: number;    // ر.س / سنة
  color: string;
  bg: string;
  popular?: boolean;
  is_active?: boolean;
  limits: {
    invoices_per_month: number | null;  // null = غير محدود
    users: number | null;
    warehouses: number | null;
    branches: number | null;
    pos_terminals: number | null;
    trial_days?: number;
  };
  modules: ModuleKey[];   // الوحدات المتاحة في هذه الخطة
  features_ar: string[];
  features_en: string[];
}

export const PLANS: Record<PlanKey, PlanConfig> = {

  trial: {
    key: "trial",
    label_ar: "تجريبية",
    label_en: "Free Trial",
    price_monthly: 0,
    price_yearly: 0,
    color: "#176545",
    bg: "#F4EFF7",
    limits: {
      invoices_per_month: 50,
      users: 2,
      warehouses: 1,
      branches: 1,
      pos_terminals: 1,
      trial_days: 14,
    },
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
    features_ar: [
      "14 يوم مجاناً",
      "50 فاتورة شهرياً",
      "مستخدمان",
      "مستودع واحد",
      "نقطة بيع واحدة",
      "تقارير أساسية",
    ],
    features_en: [
      "14 days free",
      "50 invoices/month",
      "2 users",
      "1 warehouse",
      "1 POS terminal",
      "Basic reports",
    ],
  },

  starter: {
    key: "starter",
    label_ar: "أساسية",
    label_en: "Starter",
    price_monthly: 99,
    price_yearly: 990,
    color: "#3E0865",
    bg: "#F4EFF7",
    limits: {
      invoices_per_month: 300,
      users: 3,
      warehouses: 1,
      branches: 1,
      pos_terminals: 1,
    },
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "reports"],
    features_ar: [
      "300 فاتورة شهرياً",
      "3 مستخدمين",
      "مستودع واحد",
      "فرع واحد",
      "نقطة بيع واحدة",
      "تقارير أساسية",
      "دعم بالبريد الإلكتروني",
    ],
    features_en: [
      "300 invoices/month",
      "3 users",
      "1 warehouse",
      "1 branch",
      "1 POS terminal",
      "Basic reports",
      "Email support",
    ],
  },

  professional: {
    key: "professional",
    label_ar: "احترافية",
    label_en: "Professional",
    price_monthly: 249,
    price_yearly: 2490,
    color: "#75617F",
    bg: "#EDF7EF",
    popular: true,
    limits: {
      invoices_per_month: 2000,
      users: 10,
      warehouses: 3,
      branches: 3,
      pos_terminals: 3,
    },
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "hr", "assets", "reports"],
    features_ar: [
      "2000 فاتورة شهرياً",
      "10 مستخدمين",
      "3 مستودعات",
      "3 فروع",
      "3 نقاط بيع",
      "موارد بشرية",
      "أصول ثابتة",
      "متجر إلكتروني",
      "تقارير متقدمة",
      "دعم بالأولوية",
    ],
    features_en: [
      "2,000 invoices/month",
      "10 users",
      "3 warehouses",
      "3 branches",
      "3 POS terminals",
      "HR module",
      "Fixed assets",
      "Advanced reports",
      "Priority support",
    ],
  },

  enterprise: {
    key: "enterprise",
    label_ar: "مؤسسية",
    label_en: "Enterprise",
    price_monthly: 499,
    price_yearly: 4990,
    color: "#2E493C",
    bg: "#EEF2EE",
    limits: {
      invoices_per_month: null,
      users: null,
      warehouses: null,
      branches: null,
      pos_terminals: null,
    },
    modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "pos", "treasury", "hr", "assets", "reports"],
    features_ar: [
      "فواتير غير محدودة",
      "مستخدمون غير محدودون",
      "مستودعات غير محدودة",
      "فروع غير محدودة",
      "نقاط بيع غير محدودة",
      "جميع الوحدات",
      "API مخصص",
      "دعم مخصص 24/7",
      "تدريب وإعداد",
    ],
    features_en: [
      "Unlimited invoices",
      "Unlimited users",
      "Unlimited warehouses",
      "Unlimited branches",
      "Unlimited POS terminals",
      "All modules",
      "Custom API",
      "Dedicated 24/7 support",
      "Training & onboarding",
    ],
  },
};

// ─── دوال مساعدة ─────────────────────────────────────────────────────

/** هل الوحدة متاحة لهذا النشاط وهذه الخطة؟ */
export function isModuleEnabled(
  module: ModuleKey,
  businessType: BusinessType,
  plan: PlanKey
): boolean {
  const activity = ACTIVITIES[businessType];
  const planCfg  = PLANS[plan];
  return activity.modules.includes(module) && planCfg.modules.includes(module);
}

/** الأنشطة كـ array للعرض */
export const ACTIVITIES_LIST = Object.values(ACTIVITIES);

/** الخطط كـ array للعرض */
export const PLANS_LIST = Object.values(PLANS);
