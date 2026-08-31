"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getPurchasesSummary } from "@/lib/purchases";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function PurchasesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    getPurchasesSummary().then(({ data }) => setSummary(data)).catch(() => {});
  }, []);

  const modules = [
    { label: ar ? "الموردون" : "Vendors", href: `/${locale}/purchases/vendors`, icon: <Icon name="users" size={24} />, color: "#5A187E", desc: ar ? "إدارة قاعدة بيانات الموردين" : "Manage vendor database" },
    { label: ar ? "أوامر الشراء" : "Purchase Orders", href: `/${locale}/purchases/orders`, icon: <Icon name="receipt" size={24} />, color: "#75617F", desc: ar ? "إنشاء وتتبع أوامر الشراء" : "Create and track purchase orders" },
    { label: ar ? "الفواتير الواردة" : "Bills", href: `/${locale}/purchases/bills`, icon: <Icon name="invoice" size={24} />, color: "#6F4A84", desc: ar ? "فواتير الموردين والمدفوعات" : "Vendor bills and payments" },
    { label: ar ? "مرتجعات المشتريات" : "Purchase Returns", href: `/${locale}/purchases/debit-notes`, icon: <Icon name="reverse" size={24} />, color: "#DC2626", desc: ar ? "إرجاع البضاعة للموردين" : "Return goods to vendors" },
  ];

  const reports = [
    { label: ar ? "تقرير المشتريات" : "Purchases Report", href: `/${locale}/reports/purchases`, color: "#75617F" },
    { label: ar ? "كشف حساب المورد" : "Vendor Statement", href: `/${locale}/reports/purchases/statement`, color: "#5A187E" },
    { label: ar ? "عمر ديون الموردين" : "AP Aging", href: `/${locale}/reports/purchases/aging`, color: "#DC2626" },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "المشتريات" : "Purchases"}</h1>
          <p className="page-subtitle">{ar ? "إدارة الموردين والفواتير الواردة" : "Manage vendors and incoming bills"}</p>
        </div>
      </div>

      {summary && (
        <div className="grid-3" style={{ marginBottom: 24 }}>
          {[
            { label: ar ? "إجمالي الفواتير" : "Total Billed", value: `${fmt(summary.total_billed)} SAR`, color: "#75617F" },
            { label: ar ? "المدفوع" : "Total Paid", value: `${fmt(summary.total_paid)} SAR`, color: "#6F4A84" },
            { label: ar ? "المستحق للموردين" : "Outstanding", value: `${fmt(summary.total_outstanding)} SAR`, color: "#DC2626" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.color + "18", color: s.color }}><Icon name="money" size={20} /></div>
              <div className="stat-content">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color, fontSize: 18 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        {modules.map(m => (
          <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: 20, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.boxShadow = `0 4px 16px ${m.color}18`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: m.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: m.color, flexShrink: 0 }}>
                  {m.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{m.desc}</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Reports */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {ar ? "التقارير" : "Reports"}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {reports.map(r => (
            <Link key={r.href} href={r.href} className="btn btn-secondary btn-sm" style={{ color: r.color, borderColor: r.color + "40" }}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
