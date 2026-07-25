"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import AppLayout from "@/components/layout/AppLayout";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icons";
import { getCompany } from "@/lib/settings";
import { getExpiryAlerts } from "@/lib/inventory";
import api from "@/lib/api";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

/* ── StatCard ─────────────────────────────────────────────────────── */
const StatCard = ({ label, value, up, color, icon }: {
  label: string; value: string; up: boolean; color: string; icon: any;
}) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: color + "18", color }}>{icon}</div>
    <div className="stat-content">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  </div>
);

/* ── QuickGroup — أيقونة كبيرة تفتح popup ────────────────────────── */
function QuickGroup({ icon, label, color, bg, children, ar }: {
  icon: any; label: string; color: string; bg: string;
  children: { icon: any; label: string; href: string; color: string }[];
  ar: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      {/* الأيقونة الكبيرة */}
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
          padding: "24px 16px", background: "var(--surface)", border: `2px solid ${open ? color : "var(--border)"}`,
          borderRadius: 16, cursor: "pointer", transition: "all 0.18s", width: "100%",
          boxShadow: open ? `0 0 0 4px ${color}18` : "none",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = color;
          e.currentTarget.style.background = bg;
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = `0 6px 20px ${color}25`;
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--surface)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: 18, background: bg,
          display: "flex", alignItems: "center", justifyContent: "center", color,
          border: `2px solid ${color}30`,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{label}</span>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", color }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </button>

      {/* Popup overlay */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20,
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: "var(--surface)", borderRadius: 20, padding: 28,
              width: "100%", maxWidth: 480, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
              border: `2px solid ${color}30`,
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* رأس الـ popup */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: "flex", alignItems: "center", justifyContent: "center", color }}>
                  {icon}
                </div>
                <span style={{ fontWeight: 700, fontSize: 17 }}>{label}</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* الخيارات */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {children.map((item, i) => (
                <button
                  key={i}
                  onClick={() => { setOpen(false); router.push(item.href); }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                    padding: "20px 12px", background: "var(--bg)", border: `1.5px solid var(--border)`,
                    borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = item.color;
                    e.currentTarget.style.background = item.color + "0a";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.background = "var(--bg)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: item.color + "15", display: "flex", alignItems: "center", justifyContent: "center", color: item.color }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", textAlign: "center", lineHeight: 1.3 }}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function DashboardPage({ params: { locale } }: { params: { locale: string } }) {
  const t = useTranslations("dashboard");
  const tc = useTranslations("common");
  const base = `/${locale}`;
  const ar = locale === "ar";

  const [businessType, setBusinessType] = useState("general");
  const [expiryAlerts, setExpiryAlerts] = useState<any>(null);
  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [treasurySummary, setTreasurySummary] = useState<any>(null);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCompany().then(({ data }) => {
      const bt = data?.business_type || "general";
      setBusinessType(bt);
      if (bt === "pharmacy") {
        getExpiryAlerts(30).then(({ data: alerts }) => setExpiryAlerts(alerts)).catch(() => {});
      }
    }).catch(() => {});

    Promise.all([
      api.get("/sales/invoices/summary").catch(() => ({ data: null })),
      api.get("/treasury/vouchers/summary").catch(() => ({ data: null })),
      api.get("/accounting/journal-entries?status=posted").catch(() => ({ data: [] })),
    ]).then(([salesRes, treasuryRes, journalRes]) => {
      setSalesSummary(salesRes.data);
      setTreasurySummary(treasuryRes.data);
      const entries = Array.isArray(journalRes.data) ? journalRes.data.slice(0, 5) : [];
      setRecentTx(entries);
    }).finally(() => setLoading(false));
  }, []);

  const totalRevenue  = salesSummary?.total_invoiced ?? 0;
  const totalExpenses = (treasurySummary?.total_payments ?? 0) + (treasurySummary?.total_expenses ?? 0);
  const netProfit     = totalRevenue - totalExpenses;
  const pendingInvoices = (salesSummary?.draft_count ?? 0) + (salesSummary?.overdue_count ?? 0);

  const stats = [
    { label: ar ? "إجمالي الإيرادات" : "Total Revenue",  value: `${fmt(totalRevenue)} SAR`,  up: true,  color: "#2563EB", icon: <Icon name="trending" size={20} /> },
    { label: ar ? "إجمالي المصروفات" : "Total Expenses", value: `${fmt(totalExpenses)} SAR`, up: false, color: "#DC2626", icon: <Icon name="trendingDown" size={20} /> },
    { label: ar ? "صافي الربح" : "Net Profit",           value: `${fmt(netProfit)} SAR`,     up: netProfit >= 0, color: "#059669", icon: <Icon name="profit" size={20} /> },
    { label: ar ? "الفواتير المعلقة" : "Pending Invoices", value: `${pendingInvoices}`,       up: false, color: "#D97706", icon: <Icon name="invoice" size={20} /> },
  ];

  /* ── تعريف مجموعات الإجراءات السريعة ── */
  const quickGroups = [
    {
      icon: <Icon name="invoice" size={30} />,
      label: ar ? "الفواتير" : "Invoices",
      color: "#2563EB", bg: "#EFF6FF",
      children: [
        { icon: <Icon name="invoice" size={26} />,  label: ar ? "فاتورة مبيعات جديدة"  : "New Sales Invoice",    href: `${base}/sales/invoices/new`,          color: "#2563EB" },
        { icon: <Icon name="box" size={26} />,      label: ar ? "فاتورة مشتريات جديدة" : "New Purchase Invoice", href: `${base}/purchases/bills/new`,         color: "#7C3AED" },
        { icon: <Icon name="refund" size={26} />,   label: ar ? "مرتجع مبيعات"         : "Sales Return",         href: `${base}/sales/credit-notes/new`,      color: "#DC2626" },
        { icon: <Icon name="reverse" size={26} />,  label: ar ? "مرتجع مشتريات"        : "Purchase Return",      href: `${base}/purchases/debit-notes/new`,   color: "#D97706" },
      ],
    },
    {
      icon: <Icon name="box" size={30} />,
      label: ar ? "جرد المخزون" : "Inventory",
      color: "#059669", bg: "#ECFDF5",
      children: [
        { icon: <Icon name="box" size={26} />,      label: ar ? "جرد المخزون الكامل"   : "Full Stock Count",     href: `${base}/inventory/adjustments`,       color: "#059669" },
        { icon: <Icon name="search" size={26} />,   label: ar ? "جرد حسب المنتج"       : "Count by Product",     href: `${base}/inventory/items`,             color: "#0891B2" },
      ],
    },
    {
      icon: <Icon name="chart" size={30} />,
      label: ar ? "التقارير" : "Reports",
      color: "#7C3AED", bg: "#F5F3FF",
      children: [
        { icon: <Icon name="trending" size={26} />, label: ar ? "تقارير المبيعات"      : "Sales Reports",        href: `${base}/reports/sales`,               color: "#2563EB" },
        { icon: <Icon name="box" size={26} />,      label: ar ? "تقارير المشتريات"     : "Purchase Reports",     href: `${base}/reports/purchases`,           color: "#7C3AED" },
        { icon: <Icon name="profit" size={26} />,   label: ar ? "تقارير الأرباح"       : "Profit Reports",       href: `${base}/reports/accounting/income-statement`, color: "#059669" },
      ],
    },
    {
      icon: <Icon name="users" size={30} />,
      label: ar ? "العملاء" : "Customers",
      color: "#D97706", bg: "#FFFBEB",
      children: [
        { icon: <Icon name="users" size={26} />,    label: ar ? "إضافة عميل جديد"      : "Add Customer",         href: `${base}/sales/customers?action=new`,  color: "#D97706" },
        { icon: <Icon name="search" size={26} />,   label: ar ? "البحث عن عميل"        : "Search Customer",      href: `${base}/sales/customers`,             color: "#0891B2" },
      ],
    },
  ];

  return (
    <AppLayout locale={locale}>
      {/* ── Header ── */}
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <span>{ar ? "الرئيسية" : "Home"}</span>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "لوحة التحكم" : "Dashboard"}</span>
          </div>
          <h1 className="page-title">{ar ? "مرحباً، مدير النظام" : "Welcome, Admin"}</h1>
          <p className="page-subtitle">{ar ? "نظرة عامة على أداء الشركة" : "Company performance overview"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm">{ar ? "هذا الشهر" : "This Month"}</button>
          <button className="btn btn-primary btn-sm">{ar ? "تصدير" : "Export"}</button>
        </div>
      </div>

      {/* ── تنبيه انتهاء الصلاحية — للصيدلية فقط ── */}
      {businessType === "pharmacy" && expiryAlerts && (expiryAlerts.expired_count > 0 || expiryAlerts.near_expiry_count > 0) && (
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {expiryAlerts.expired_count > 0 && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#DC2626" }}>{ar ? `${expiryAlerts.expired_count} تشغيلة منتهية الصلاحية` : `${expiryAlerts.expired_count} expired batches`}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{ar ? `قيمة: ${fmt(expiryAlerts.expired_value)} SAR` : `Value: ${fmt(expiryAlerts.expired_value)} SAR`}</div>
                </div>
              </div>
              <Link href={`/${locale}/reports/inventory/expiry`} className="btn btn-sm" style={{ background: "#DC2626", color: "white", border: "none" }}>{ar ? "عرض التفاصيل" : "View Details"}</Link>
            </div>
          )}
          {expiryAlerts.near_expiry_count > 0 && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#D97706", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#D97706" }}>{ar ? `${expiryAlerts.near_expiry_count} تشغيلة تنتهي خلال 30 يوم` : `${expiryAlerts.near_expiry_count} batches expiring within 30 days`}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{ar ? `قيمة: ${fmt(expiryAlerts.near_expiry_value)} SAR` : `Value: ${fmt(expiryAlerts.near_expiry_value)} SAR`}</div>
                </div>
              </div>
              <Link href={`/${locale}/reports/inventory/expiry`} className="btn btn-sm" style={{ background: "#D97706", color: "white", border: "none" }}>{ar ? "عرض التفاصيل" : "View Details"}</Link>
            </div>
          )}
        </div>
      )}

      {/* ── الكروت الإحصائية ── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {stats.map((s, i) => <StatCard key={i} {...s} />)}
      </div>

      {/* ── بطاقة الإجراءات السريعة ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header" style={{ paddingBottom: 0 }}>
          <span className="card-title" style={{ fontSize: 16, fontWeight: 700 }}>
            {ar ? "الإجراءات السريعة" : "Quick Actions"}
          </span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {ar ? "اضغط على أي أيقونة لعرض الخيارات" : "Tap any icon to see options"}
          </span>
        </div>
        <div className="card-body" style={{ paddingTop: 20 }}>
          <div className="quick-actions-grid">
            {quickGroups.map((g, i) => (
              <QuickGroup key={i} {...g} ar={ar} />
            ))}
          </div>
        </div>
      </div>

      {/* ── التحليلات: جدول المعاملات ── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title">{ar ? "آخر المعاملات" : "Recent Transactions"}</span>
          <Link href={`${base}/accounting/journal`} style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}>
            {ar ? "عرض الكل" : "View All"}
          </Link>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "رقم القيد" : "Entry #"}</th>
                <th>{tc("description")}</th>
                <th>{tc("date")}</th>
                <th style={{ textAlign: "end" }}>{tc("amount")}</th>
                <th>{tc("status")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>{ar ? "جاري التحميل..." : "Loading..."}</td></tr>
              ) : recentTx.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-secondary)", padding: 24 }}>{ar ? "لا توجد قيود بعد" : "No entries yet"}</td></tr>
              ) : recentTx.map((tx: any) => (
                <tr key={tx.id}>
                  <td><span style={{ fontWeight: 600, color: "var(--primary)", fontSize: 12 }}>{tx.entry_number}</span></td>
                  <td>{ar ? tx.description_ar : (tx.description_en || tx.description_ar)}</td>
                  <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{tx.entry_date ? new Date(tx.entry_date).toLocaleDateString("en-GB") : ""}</td>
                  <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(tx.total_debit)} {tc("currency")}</td>
                  <td>
                    <span className={`badge ${tx.status === "posted" ? "badge-success" : "badge-info"}`}>
                      {tx.status === "posted" ? (ar ? "مرحّل" : "Posted") : (ar ? "مسودة" : "Draft")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── زاتكا ── */}
      <div style={{
        background: "linear-gradient(135deg, #1E3A5F, #2563EB)", borderRadius: 12, padding: "20px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ color: "white" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
            {ar ? "ربط زاتكا — الفوترة الإلكترونية" : "ZATCA Integration — e-Invoicing"}
          </div>
          <div style={{ fontSize: 13, opacity: 0.8 }}>
            {ar ? "نظامك متوافق مع متطلبات هيئة الزكاة والضريبة والجمارك للمرحلة الثانية" : "Your system is compliant with ZATCA Phase 2 e-invoicing requirements"}
          </div>
        </div>
        <Link href={`${base}/settings/tax`} className="btn" style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)", flexShrink: 0 }}>
          {ar ? "إعدادات زاتكا" : "ZATCA Settings"}
        </Link>
      </div>
    </AppLayout>
  );
}
