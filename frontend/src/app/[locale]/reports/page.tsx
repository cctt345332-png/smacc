"use client";;
import { use } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icons";

type IconName = "journal" | "receipt" | "box" | "users" | "pos";

const groups = (base: string, ar: boolean): { title: string; color: string; icon: IconName; reports: { label: string; href: string; desc: string }[] }[] => [
  {
    title: ar ? "تقارير المحاسبة المالية" : "Accounting Reports",
    color: "#5A187E",
    icon: "journal",
    reports: [
      { label: ar ? "ميزان المراجعة" : "Trial Balance", href: `${base}/reports/accounting/trial-balance`, desc: ar ? "أرصدة جميع الحسابات" : "All account balances" },
      { label: ar ? "الميزانية العمومية" : "Balance Sheet", href: `${base}/reports/accounting/balance-sheet`, desc: ar ? "الأصول والخصوم وحقوق الملكية" : "Assets, liabilities & equity" },
      { label: ar ? "قائمة الدخل" : "Income Statement", href: `${base}/reports/accounting/income-statement`, desc: ar ? "الإيرادات والمصروفات" : "Revenue & expenses" },
      { label: ar ? "التدفقات النقدية" : "Cash Flow", href: `${base}/reports/accounting/cash-flow`, desc: ar ? "حركة النقدية" : "Cash movements" },
      { label: ar ? "تقرير ضريبة القيمة المضافة" : "VAT Report", href: `${base}/reports/accounting/vat`, desc: ar ? "الإقرار الضريبي الفصلي" : "Quarterly VAT return" },
    ],
  },
  {
    title: ar ? "تقارير المبيعات" : "Sales Reports",
    color: "#6F4A84",
    icon: "receipt" as IconName,
    reports: [
      { label: ar ? "تقرير المبيعات" : "Sales Report", href: `${base}/reports/sales`, desc: ar ? "إجمالي المبيعات بالفترة" : "Total sales by period" },
      { label: ar ? "عمر الديون" : "Aging Report", href: `${base}/reports/sales/aging`, desc: ar ? "الفواتير المتأخرة" : "Overdue invoices" },
    ],
  },
  {
    title: ar ? "تقارير المشتريات" : "Purchase Reports",
    color: "#75617F",
    icon: "box" as IconName,
    reports: [
      { label: ar ? "تقرير المشتريات" : "Purchase Report", href: `${base}/reports/purchases`, desc: ar ? "إجمالي المشتريات" : "Total purchases" },
    ],
  },
  {
    title: ar ? "تقارير المخزون" : "Inventory Reports",
    color: "#D97706",
    icon: "box" as IconName,
    reports: [
      { label: ar ? "تقرير المخزون" : "Inventory Report", href: `${base}/reports/inventory`, desc: ar ? "أرصدة المخزون الحالية" : "Current stock levels" },
    ],
  },
  {
    title: ar ? "تقارير نقطة البيع" : "POS Reports",
    color: "#6F4A84",
    icon: "pos" as IconName,
    reports: [
      { label: ar ? "مبيعات POS اليومية" : "Daily POS Sales",      href: `${base}/reports/pos`,              desc: ar ? "إجمالي مبيعات الكاشير يومياً" : "Daily cashier sales totals" },
      { label: ar ? "تقرير الجلسات" : "Sessions Report",           href: `${base}/reports/pos/sessions`,     desc: ar ? "ملخص جلسات الكاشير وإغلاقاتها" : "Cashier sessions summary" },
      { label: ar ? "أفضل الأصناف مبيعاً" : "Top Selling Items",  href: `${base}/reports/pos/top-items`,    desc: ar ? "الأصناف الأكثر مبيعاً في POS" : "Best selling items in POS" },
      { label: ar ? "تقرير طرق الدفع" : "Payment Methods",        href: `${base}/reports/pos/payments`,     desc: ar ? "توزيع المبيعات حسب طريقة الدفع" : "Sales breakdown by payment method" },
    ],
  },
  {
    title: ar ? "تقارير الموارد البشرية" : "HR Reports",
    color: "#DC2626",
    icon: "users" as IconName,
    reports: [
      { label: ar ? "تقرير الرواتب" : "Payroll Report", href: `${base}/reports/hr/payroll`, desc: ar ? "ملخص الرواتب الشهرية" : "Monthly payroll summary" },
    ],
  },
];

export default function ReportsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const base = `/${locale}`;

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "التقارير" : "Reports"}</h1>
          <p className="page-subtitle">{ar ? "جميع التقارير المالية والتشغيلية في مكان واحد" : "All financial and operational reports in one place"}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {groups(base, ar).map(group => (
          <div key={group.title}>
            {/* Group header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: group.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: group.color }}>
                <Icon name={group.icon} size={18} />
              </div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{group.title}</h2>
              <div style={{ flex: 1, height: 1, background: "var(--border)", marginInlineStart: 8 }} />
            </div>

            {/* Reports grid */}
            <div className="grid-4">
              {group.reports.map(r => (
                <Link key={r.href} href={r.href} style={{ textDecoration: "none" }}>
                  <div className="card" style={{ padding: 16, cursor: "pointer", transition: "all 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = group.color; e.currentTarget.style.boxShadow = `0 4px 16px ${group.color}18`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: "var(--text-primary)" }}>{r.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{r.desc}</div>
                    <div style={{ marginTop: 12, fontSize: 12, color: group.color, fontWeight: 600 }}>
                      {ar ? "عرض ←" : "View →"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
