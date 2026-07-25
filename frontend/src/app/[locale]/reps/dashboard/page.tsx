"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getMySummary } from "@/lib/reps";
import { useAuthStore } from "@/store/authStore";

const fmt = (n: any) =>
  Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function RepDashboard({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const { user } = useAuthStore();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMySummary()
      .then((res) => setSummary(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const stats = summary
    ? [
        {
          label: ar ? "إجمالي مبيعاتي" : "Total Sales",
          value: `${fmt(summary.total_sales)} SAR`,
          color: "#2563EB",
        },
        {
          label: ar ? "عدد الفواتير" : "Invoices",
          value: summary.invoice_count,
          color: "#7C3AED",
        },
        {
          label: ar ? "المقبوض" : "Collected",
          value: `${fmt(summary.total_collected)} SAR`,
          color: "#059669",
        },
        {
          label: ar ? "المستحق" : "Outstanding",
          value: `${fmt(summary.outstanding)} SAR`,
          color: summary.outstanding > 0 ? "#DC2626" : "#059669",
        },
        {
          label: ar ? "رصيد المخزون" : "Stock Balance",
          value: fmt(summary.stock_qty),
          color: "#D97706",
        },
      ]
    : [];

  const modules = [
    {
      label: ar ? "مخزوني" : "My Stock",
      href: `/${locale}/reps/stock`,
      color: "#7C3AED",
      desc: ar ? "عرض بضاعتي الحالية" : "View my current stock",
      icon: "📦",
    },
    {
      label: ar ? "فاتورة جديدة" : "New Invoice",
      href: `/${locale}/reps/invoices/new`,
      color: "#2563EB",
      desc: ar ? "إصدار فاتورة مبيعات" : "Create a sales invoice",
      icon: "📄",
    },
    {
      label: ar ? "فواتيري" : "My Invoices",
      href: `/${locale}/reps/invoices`,
      color: "#059669",
      desc: ar ? "عرض كل فواتيري" : "View all my invoices",
      icon: "📋",
    },
    {
      label: ar ? "سندات القبض" : "Receipts",
      href: `/${locale}/reps/payments`,
      color: "#D97706",
      desc: ar ? "سندات القبض من العملاء" : "Customer payment receipts",
      icon: "💰",
    },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {ar ? `أهلاً، ${user?.fullName || "المندوب"}` : `Welcome, ${user?.fullName || "Rep"}`}
          </h1>
          <p className="page-subtitle">
            {ar ? "لوحة تحكم المندوب" : "Sales Representative Dashboard"}
          </p>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13, padding: 20 }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : (
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {stats.map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-content">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>
                  {s.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Access */}
      <div className="grid-2">
        {modules.map((m) => (
          <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
            <div
              className="card"
              style={{ padding: 20, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = m.color;
                e.currentTarget.style.boxShadow = `0 4px 16px ${m.color}18`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: m.color + "18",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 22,
                    flexShrink: 0,
                  }}
                >
                  {m.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {m.desc}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
