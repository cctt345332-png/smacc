"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

// ── Icons ────────────────────────────────────────────────────────────
const IC = {
  ai: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/></svg>,
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  accounting: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  sales: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  purchases: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  inventory: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>,
  hr: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  reports: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>,
  assets: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  treasury: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>,
  pos: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  chevron: (open: boolean) => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>,
  collapse: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
};

// ── Nav structure ────────────────────────────────────────────────────
interface NavChild { label: string; href: string; divider?: boolean; }
interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: NavChild[];
}

// ── Nav للمندوب فقط — نفس الصفحات الأصلية لكن مبسطة ────────────────
const buildRepNav = (base: string, ar: boolean): { section: string; items: NavItem[] }[] => [
  {
    section: "",
    items: [
      { key: "dashboard", label: ar ? "لوحة التحكم" : "Dashboard", icon: IC.dashboard, href: `${base}/dashboard` },
    ],
  },
  {
    section: ar ? "وحداتي" : "My Modules",
    items: [
      {
        key: "sales", label: ar ? "المبيعات" : "Sales", icon: IC.sales,
        children: [
          { label: ar ? "العملاء" : "Customers",          href: `${base}/sales/customers` },
          { label: ar ? "الفواتير" : "Invoices",          href: `${base}/sales/invoices` },
          { label: ar ? "فاتورة جديدة" : "New Invoice",   href: `${base}/sales/invoices/new` },
          { label: ar ? "سندات القبض" : "Receipts",       href: `${base}/sales/payments` },
        ],
      },
      {
        key: "inventory", label: ar ? "مخزوني" : "My Stock", icon: IC.inventory,
        children: [
          { label: ar ? "عرض المخزون" : "View Stock",     href: `${base}/inventory/stock` },
        ],
      },
    ],
  },
];

const buildNav = (base: string, ar: boolean, bt: string = "general", plan: string = "trial"): { section: string; items: NavItem[] }[] => {
  const hasSerial = bt === "mobile_phones" || bt === "spare_parts";
  const hasBatch  = bt === "pharmacy";
  const hasPos    = bt !== "construction";
  const hasHR     = plan === "professional" || plan === "enterprise";
  const hasAssets = plan === "professional" || plan === "enterprise";
  return [
  {
    section: "",
    items: [
      { key: "ai",        label: ar ? "المساعد الذكي" : "AI Assistant", icon: IC.ai,        href: `${base}/ai` },
      { key: "dashboard", label: ar ? "لوحة التحكم"   : "Dashboard",    icon: IC.dashboard, href: `${base}/dashboard` },
    ],
  },
  {
    section: ar ? "الوحدات" : "Modules",
    items: [
      {
        key: "accounting", label: ar ? "المحاسبة المالية" : "Accounting", icon: IC.accounting,
        children: [
          { label: ar ? "دليل الحسابات" : "Chart of Accounts", href: `${base}/accounting/chart-of-accounts` },
          { label: ar ? "قيود اليومية" : "Journal Entries", href: `${base}/accounting/journal` },
          { label: ar ? "دفتر الأستاذ العام" : "General Ledger", href: `${base}/accounting/ledger` },
          { label: ar ? "مراكز التكلفة" : "Cost Centers", href: `${base}/accounting/cost-centers` },
          { label: ar ? "الحسابات البنكية" : "Bank Accounts", href: `${base}/accounting/banks` },
          { label: ar ? "الميزانيات التقديرية" : "Budgets", href: `${base}/accounting/budgets` },
          { label: ar ? "السنوات المالية" : "Fiscal Years", href: `${base}/accounting/fiscal-years` },
        ],
      },
      {
        key: "sales", label: ar ? "المبيعات" : "Sales", icon: IC.sales,
        children: [
          { label: ar ? "العملاء" : "Customers", href: `${base}/sales/customers` },
          { label: ar ? "عروض الأسعار" : "Quotations", href: `${base}/sales/quotations` },
          { label: ar ? "أوامر البيع" : "Sales Orders", href: `${base}/sales/orders` },
          { label: ar ? "الفواتير" : "Invoices", href: `${base}/sales/invoices` },
          { label: ar ? "سندات القبض" : "Receipts", href: `${base}/sales/payments` },
          { label: ar ? "مرتجعات المبيعات" : "Sales Returns", href: `${base}/sales/credit-notes` },
        ],
      },
      {
        key: "purchases", label: ar ? "المشتريات" : "Purchases", icon: IC.purchases,
        children: [
          { label: ar ? "الموردون" : "Vendors", href: `${base}/purchases/vendors` },
          { label: ar ? "أوامر الشراء" : "Purchase Orders", href: `${base}/purchases/orders` },
          { label: ar ? "الفواتير الواردة" : "Bills", href: `${base}/purchases/bills` },
          { label: ar ? "مرتجعات المشتريات" : "Purchase Returns", href: `${base}/purchases/debit-notes` },
        ],
      },
      {
        key: "inventory", label: ar ? "المخزون" : "Inventory", icon: IC.inventory,
        children: [
          { label: ar ? "الأصناف" : "Items", href: `${base}/inventory/items` },
          { label: ar ? "التصنيفات" : "Categories", href: `${base}/inventory/categories` },
          { label: ar ? "المستودعات" : "Warehouses", href: `${base}/inventory/warehouses` },
          { label: ar ? "حركات المخزون" : "Stock Movements", href: `${base}/inventory/movements` },
          { label: ar ? "جرد المخزون" : "Stock Count", href: `${base}/inventory/adjustments` },
        ],
      },
      ...(hasHR ? [{
        key: "hr", label: ar ? "الموارد البشرية" : "Human Resources", icon: IC.hr,
        children: [
          { label: ar ? "الموظفون" : "Employees",                href: `${base}/hr/employees` },
          { label: ar ? "الأقسام" : "Departments",               href: `${base}/hr/departments` },
          { label: ar ? "الحضور والانصراف" : "Attendance",       href: `${base}/hr/attendance` },
          { label: ar ? "الإجازات" : "Leaves",                   href: `${base}/hr/leaves` },
          { label: ar ? "الرواتب" : "Payroll",                   href: `${base}/hr/payroll` },
          { label: ar ? "التأمينات (GOSI)" : "GOSI",             href: `${base}/hr/gosi` },
        ],
      }] : []),
      ...(hasAssets ? [{
        key: "assets", label: ar ? "الأصول الثابتة" : "Fixed Assets", icon: IC.assets,
        children: [
          { label: ar ? "إدارة الأصول" : "Manage Assets",        href: `${base}/assets` },
          { label: ar ? "فئات الأصول" : "Categories",            href: `${base}/assets/categories` },
          { label: ar ? "تشغيل الاستهلاك" : "Run Depreciation", href: `${base}/assets/depreciation` },
        ],
      }] : []),
      {
        key: "treasury", label: ar ? "الخزينة والمدفوعات" : "Treasury", icon: IC.treasury,
        children: [
          { label: ar ? "سندات القبض" : "Receipt Vouchers", href: `${base}/treasury/receipts` },
          { label: ar ? "سندات الصرف" : "Payment Vouchers", href: `${base}/treasury/payments` },
          { label: ar ? "المصروفات" : "Expenses", href: `${base}/treasury/expenses` },
          { label: ar ? "التحويلات البنكية" : "Bank Transfers", href: `${base}/treasury/transfers` },
        ],
      },
      ...(hasPos ? [{
        key: "pos", label: ar ? "نقطة البيع" : "Point of Sale", icon: IC.pos,
        children: [
          { label: ar ? "لوحة الإدارة" : "Dashboard",  href: `${base}/pos` },
          { label: ar ? "الجلسات" : "Sessions",         href: `${base}/pos/sessions` },
        ],
      }] : []),
      {
        key: "reps", label: ar ? "المناديب" : "Sales Reps", icon: IC.hr,
        children: [
          { label: ar ? "إدارة المناديب"      : "Manage Reps",       href: `${base}/reps/manage` },
          { label: ar ? "المشرفون"             : "Supervisors",       href: `${base}/supervisors` },
          { label: ar ? "خريطة المناديب"      : "Reps Map",          href: `${base}/reps/tracking` },
          { label: ar ? "مراجعة الفواتير"     : "Invoice Review",    href: `${base}/reps/review` },
          { label: ar ? "تقارير المناديب"     : "Rep Reports",       href: `${base}/reps/reports` },
        ],
      },
    ],
  },
  {
    section: ar ? "التحليلات" : "Analytics",
    items: [
      {
        key: "reports", label: ar ? "التقارير" : "Reports", icon: IC.reports,
        children: [
          { label: ar ? "── تقارير المحاسبة ──" : "── Accounting ──", href: "", divider: true },
          { label: ar ? "ميزان المراجعة" : "Trial Balance", href: `${base}/reports/accounting/trial-balance` },
          { label: ar ? "الميزانية العمومية" : "Balance Sheet", href: `${base}/reports/accounting/balance-sheet` },
          { label: ar ? "قائمة الدخل" : "Income Statement", href: `${base}/reports/accounting/income-statement` },
          { label: ar ? "التدفقات النقدية" : "Cash Flow", href: `${base}/reports/accounting/cash-flow` },
          { label: ar ? "تقرير ضريبة القيمة المضافة" : "VAT Report", href: `${base}/reports/accounting/vat` },
          { label: ar ? "── تقارير المبيعات ──" : "── Sales ──", href: "", divider: true },
          { label: ar ? "تقرير المبيعات" : "Sales Report", href: `${base}/reports/sales` },
          { label: ar ? "عمر الديون" : "Aging Report", href: `${base}/reports/sales/aging` },
          { label: ar ? "كشف حساب العميل" : "Customer Statement", href: `${base}/reports/sales/statement` },
          { label: ar ? "── تقارير المشتريات ──" : "── Purchases ──", href: "", divider: true },
          { label: ar ? "تقرير المشتريات" : "Purchases Report", href: `${base}/reports/purchases` },
          { label: ar ? "كشف حساب المورد" : "Vendor Statement", href: `${base}/reports/purchases/statement` },
          { label: ar ? "عمر ديون الموردين" : "AP Aging", href: `${base}/reports/purchases/aging` },
          { label: ar ? "── تقارير المخزون ──" : "── Inventory ──", href: "", divider: true },
          { label: ar ? "تقرير المخزون" : "Inventory Report", href: `${base}/reports/inventory` },
          ...(hasSerial ? [{ label: ar ? "تقرير ربح السيريال" : "Serial Profit", href: `${base}/reports/inventory/serial-profit` }] : []),
          ...(hasBatch  ? [{ label: ar ? "انتهاء الصلاحية" : "Expiry Report", href: `${base}/reports/inventory/expiry` }] : []),
          { label: ar ? "── تقارير الأصول الثابتة ──" : "── Fixed Assets ──", href: "", divider: true },
          { label: ar ? "تقارير الأصول الثابتة" : "Fixed Asset Reports", href: `${base}/reports/assets` },
          { label: ar ? "── تقارير نقطة البيع ──" : "── POS ──", href: "", divider: true },
          { label: ar ? "مبيعات POS اليومية" : "Daily POS Sales",    href: `${base}/reports/pos` },
          { label: ar ? "تقرير الجلسات" : "Sessions Report",         href: `${base}/reports/pos/sessions` },
          { label: ar ? "أفضل الأصناف مبيعاً" : "Top Selling Items", href: `${base}/reports/pos/top-items` },
          { label: ar ? "طرق الدفع" : "Payment Methods",             href: `${base}/reports/pos/payments` },
        ],
      },
    ],
  },
  {
    section: ar ? "النظام" : "System",
    items: [
      {
        key: "settings", label: ar ? "الإعدادات" : "Settings", icon: IC.settings,
        children: [
          { label: ar ? "بيانات الشركة" : "Company Info",       href: `${base}/settings/company` },
          { label: ar ? "اشتراكي" : "My Subscription",          href: `${base}/settings/subscription` },
          { label: ar ? "الضريبة وزاتكا" : "Tax & ZATCA",       href: `${base}/settings/tax` },
          { label: ar ? "المتجر الإلكتروني" : "Online Store",   href: `${base}/settings/store` },
          { label: ar ? "المستخدمون" : "Users",                  href: `${base}/settings/users` },
          { label: ar ? "الصلاحيات" : "Roles",                   href: `${base}/settings/roles` },
          { label: ar ? "إعدادات التنبيهات" : "Alert Settings",  href: `${base}/settings/alerts` },
          { label: ar ? "الفروع" : "Branches",                   href: `${base}/settings/branches` },
          { label: ar ? "العملات" : "Currencies",                href: `${base}/settings/currencies` },
          { label: ar ? "النسخ الاحتياطي" : "Backup",           href: `${base}/settings/backup` },
        ],
      },
    ],
  },
  ];
};

// ── Component ────────────────────────────────────────────────────────
export default function Sidebar({ locale, collapsed, mobileOpen, onToggle }: {
  locale: string; collapsed: boolean; mobileOpen: boolean; onToggle: () => void;
}) {
  const ar = locale === "ar";
  const pathname = usePathname();
  const base = `/${locale}`;
  const { plan, businessType, user } = useAuthStore();

  const isRep = user?.role === "sales_rep";
  const nav = isRep ? buildRepNav(base, ar) : buildNav(base, ar, businessType, plan);

  const isActive = (href: string) =>
    href && (pathname === href || pathname.startsWith(href + "/"));

  const hasActiveChild = (children: NavChild[]) =>
    children.some(c => c.href && isActive(c.href));

  // حساب القوائم المفتوحة — تفتح تلقائياً إذا فيها صفحة نشطة
  // وتبقى مفتوحة إذا فتحها المستخدم يدوياً
  const getInitialOpen = () => {
    const result: Record<string, boolean> = {};
    nav.forEach(group => {
      group.items.forEach(item => {
        if (item.children) {
          result[item.key] = hasActiveChild(item.children);
        }
      });
    });
    return result;
  };

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(getInitialOpen);

  // عند تغيير الـ pathname — افتح القائمة التي تحتوي الصفحة النشطة بدون إغلاق الباقي
  useEffect(() => {
    nav.forEach(group => {
      group.items.forEach(item => {
        if (item.children && hasActiveChild(item.children)) {
          setOpenMenus(prev => ({ ...prev, [item.key]: true }));
        }
      });
    });
  }, [pathname]);

  const toggle = (key: string) => setOpenMenus(p => ({ ...p, [key]: !p[key] }));

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>

      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/logo-masar-blue.png" alt="Logo" style={{ height: 46, maxWidth: 180, objectFit: "contain" }} />
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {nav.map((group, gi) => (
          <div key={gi} className="sidebar-section">
            {group.section && !collapsed && (
              <div className="sidebar-section-label">{group.section}</div>
            )}

            {group.items.map(item => {
              // Simple link (no children)
              if (!item.children) {
                return (
                  <Link key={item.key} href={item.href!}
                    className={`sidebar-item${isActive(item.href!) ? " active" : ""}`}>
                    <span className="sidebar-item-icon">{item.icon}</span>
                    <span className="sidebar-item-text">{item.label}</span>
                  </Link>
                );
              }

              // Has children
              const open = !!openMenus[item.key];
              const active = hasActiveChild(item.children);

              return (
                <div key={item.key}>
                  <div
                    className={`sidebar-item${active ? " active" : ""}`}
                    onClick={() => toggle(item.key)}
                  >
                    <span className="sidebar-item-icon">{item.icon}</span>
                    <span className="sidebar-item-text">{item.label}</span>
                    {!collapsed && IC.chevron(open)}
                  </div>

                  {open && !collapsed && (
                    <div className="sidebar-submenu">
                      {item.children.map((child, ci) => {
                        // Divider label
                        if (child.divider) {
                          return (
                            <div key={ci} style={{
                              fontSize: 10, fontWeight: 700, color: "#334155",
                              padding: "8px 16px 2px", textTransform: "uppercase",
                              letterSpacing: "0.06em", marginTop: 4,
                            }}>
                              {child.label}
                            </div>
                          );
                        }
                        return (
                          <Link key={ci} href={child.href}
                            className={`sidebar-submenu-item${isActive(child.href) ? " active" : ""}`}>
                            <span className="sidebar-submenu-dot" />
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="sidebar-collapse-btn" onClick={onToggle}>
          {IC.collapse}
          <span className="sidebar-item-text">
            {collapsed ? (ar ? "توسيع" : "Expand") : (ar ? "طي القائمة" : "Collapse")}
          </span>
        </button>
      </div>
    </aside>
  );
}
