"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getSessions, getTerminals } from "@/lib/pos";
import { Icon } from "@/components/ui/Icons";

// ─── خصائص كل نشاط ───────────────────────────────────────────────────
const ACTIVITY_CONFIG: Record<string, {
  label: string; icon: any; color: string; bg: string;
}> = {
  mobile_phones: { label: "جوالات وإلكترونيات", icon: "mobile",       color: "#2563EB", bg: "#EFF6FF" },
  spare_parts:   { label: "قطع غيار",            icon: "spareParts",   color: "#7C3AED", bg: "#F5F3FF" },
  pharmacy:      { label: "صيدلية",              icon: "pharmacy",     color: "#059669", bg: "#ECFDF5" },
  grocery:       { label: "بقالة",               icon: "grocery",      color: "#D97706", bg: "#FFFBEB" },
  spices:        { label: "عطارة وتوابل",         icon: "spices",       color: "#B45309", bg: "#FEF3C7" },
  clothing:      { label: "ملابس وأزياء",         icon: "clothing",     color: "#EC4899", bg: "#FDF2F8" },
  construction:  { label: "مواد بناء",            icon: "construction", color: "#64748B", bg: "#F1F5F9" },
  general:       { label: "عام",                 icon: "general",      color: "#0F172A", bg: "#F8FAFC" },
};

const fmt = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function POSDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) || "ar";
  const isAr = locale === "ar";
  const dir = isAr ? "rtl" : "ltr";

  const [sessions, setSessions] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [sRes, tRes] = await Promise.all([
          getSessions({ limit: 50 }).catch(() => ({ data: [] })),
          getTerminals().catch(() => ({ data: [] })),
        ]);
        setSessions(sRes.data || []);
        setTerminals(tRes.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const openSessions = sessions.filter((s) => s.status === "open");
  const today = new Date();
  const todaySales = sessions
    .filter((s) => {
      const d = new Date(s.opened_at);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    })
    .reduce((sum, s) => sum + Number(s.total_sales || 0), 0);

  const totalTxns = sessions.reduce(
    (sum, s) => sum + Number(s.transaction_count || 0), 0
  );

  const sar = isAr ? "ر.س" : "SAR";

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isAr ? "نقطة البيع" : "Point of Sale"}
          </h1>
          <p className="page-subtitle">
            {isAr
              ? "إدارة الكاشير والجلسات والأجهزة"
              : "Manage cashier, sessions and terminals"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/pos/terminals`} className="btn btn-secondary">
            <Icon name="terminal" size={16} />
            {isAr ? "الأجهزة" : "Terminals"}
          </Link>
          <button
            className="btn btn-primary"
            onClick={() => router.push(`/${locale}/pos/cashier`)}
          >
            <Icon name="cashier" size={16} />
            {isAr ? "فتح الكاشير" : "Open Cashier"}
          </button>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          {
            label: isAr ? "جلسات مفتوحة" : "Open Sessions",
            value: loading ? "—" : String(openSessions.length),
            icon: "session" as const,
            color: "#059669",
            bg: "#ECFDF5",
          },
          {
            label: isAr ? "مبيعات اليوم" : "Today's Sales",
            value: loading ? "—" : `${fmt(todaySales)} ${sar}`,
            icon: "revenue" as const,
            color: "#2563EB",
            bg: "#EFF6FF",
          },
          {
            label: isAr ? "إجمالي الجلسات" : "Total Sessions",
            value: loading ? "—" : String(sessions.length),
            icon: "chart" as const,
            color: "#7C3AED",
            bg: "#F5F3FF",
          },
          {
            label: isAr ? "إجمالي المعاملات" : "Total Transactions",
            value: loading ? "—" : String(totalTxns),
            icon: "receipt" as const,
            color: "#D97706",
            bg: "#FFFBEB",
          },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div
              className="stat-icon"
              style={{ background: s.bg, color: s.color }}
            >
              <Icon name={s.icon} size={20} />
            </div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────── */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        {[
          {
            icon: "cashier" as const,
            label: isAr ? "فتح الكاشير" : "Open Cashier",
            desc: isAr ? "ابدأ جلسة بيع جديدة" : "Start a new sales session",
            href: `/${locale}/pos/cashier`,
            color: "#059669",
            bg: "#ECFDF5",
          },
          {
            icon: "session" as const,
            label: isAr ? "الجلسات" : "Sessions",
            desc: isAr ? "عرض وإدارة جلسات الكاشير" : "View and manage cashier sessions",
            href: `/${locale}/pos/sessions`,
            color: "#2563EB",
            bg: "#EFF6FF",
          },
          {
            icon: "terminal" as const,
            label: isAr ? "الأجهزة" : "Terminals",
            desc: isAr ? "إعداد أجهزة نقطة البيع" : "Configure POS terminals",
            href: `/${locale}/pos/terminals`,
            color: "#7C3AED",
            bg: "#F5F3FF",
          },
        ].map((item) => (
          <div
            key={item.href}
            className="card"
            style={{ padding: 20, cursor: "pointer" }}
            onClick={() => router.push(item.href)}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", color: item.color, flexShrink: 0 }}>
                <Icon name={item.icon} size={24} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Terminals by Activity ───────────────────────────────────── */}
      {!loading && terminals.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 className="card-title">
              <Icon name="terminal" size={16} />
              {isAr ? "الأجهزة المتاحة" : "Available Terminals"}
            </h3>
            <Link href={`/${locale}/pos/terminals`} className="btn btn-secondary btn-sm">
              {isAr ? "إدارة الأجهزة" : "Manage"}
            </Link>
          </div>
          <div style={{ padding: "0 0 4px" }}>
            <div className="grid-3" style={{ padding: "16px 20px", gap: 12 }}>
              {terminals.map((t) => {
                const cfg = ACTIVITY_CONFIG[t.business_type] || ACTIVITY_CONFIG.general;
                const openSession = openSessions.find((s) => s.terminal_id === t.id);
                return (
                  <div key={t.id} style={{ border: `1px solid ${openSession ? cfg.color + "40" : "var(--border)"}`, borderRadius: 12, padding: "14px 16px", background: openSession ? cfg.bg : "var(--surface)", cursor: "pointer", transition: "all 0.15s" }}
                    onClick={() => router.push(`/${locale}/pos/cashier?terminal=${t.id}`)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.color, flexShrink: 0 }}>
                        <Icon name={cfg.icon as any} size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                        {t.branch_name && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t.branch_name}</div>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg, padding: "2px 8px", borderRadius: 20, border: `1px solid ${cfg.color}30` }}>{cfg.label}</span>
                      {openSession ? (
                        <span style={{ fontSize: 11, color: "#059669", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
                          {isAr ? "مفتوح" : "Open"}
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{isAr ? "مغلق" : "Closed"}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Open Sessions ───────────────────────────────────────────── */}
      {!loading && openSessions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Icon name="session" size={16} />
              {isAr ? "الجلسات المفتوحة" : "Open Sessions"}
            </h3>
            <Link href={`/${locale}/pos/sessions`} className="btn btn-secondary btn-sm">
              {isAr ? "عرض الكل" : "View All"}
            </Link>
          </div>
          <div className="table-wrapper" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>{isAr ? "الجهاز" : "Terminal"}</th>
                  <th>{isAr ? "النشاط" : "Activity"}</th>
                  <th>{isAr ? "وقت الفتح" : "Opened At"}</th>
                  <th>{isAr ? "المبيعات" : "Sales"}</th>
                  <th>{isAr ? "المعاملات" : "Txns"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {openSessions.map((s) => {
                  const term = terminals.find((t) => t.id === s.terminal_id);
                  const cfg = ACTIVITY_CONFIG[term?.business_type || "general"] ||
                    ACTIVITY_CONFIG.general;
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {term?.name || "—"}
                        </div>
                        {term?.branch_name && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {term.branch_name}
                          </div>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: cfg.color,
                            background: cfg.bg,
                            padding: "2px 8px",
                            borderRadius: 20,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Icon name={cfg.icon as any} size={12} />
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(s.opened_at).toLocaleString(
                          isAr ? "ar-SA" : "en-US",
                          { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }
                        )}
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--success)" }}>
                        {fmt(Number(s.total_sales))} {sar}
                      </td>
                      <td>{s.transaction_count}</td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() =>
                            router.push(
                              `/${locale}/pos/cashier?terminal=${s.terminal_id}`
                            )
                          }
                        >
                          <Icon name="cashier" size={13} />
                          {isAr ? "فتح" : "Open"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────── */}
      {!loading && terminals.length === 0 && (
        <div className="empty-state" style={{ minHeight: "40vh" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#EFF6FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563EB",
              margin: "0 auto 16px",
            }}
          >
            <Icon name="pos" size={32} />
          </div>
          <div className="empty-state-title">
            {isAr ? "لا توجد أجهزة بعد" : "No terminals yet"}
          </div>
          <div className="empty-state-desc">
            {isAr
              ? "أضف جهاز كاشير وحدد نشاطه لبدء البيع"
              : "Add a terminal and set its activity to start selling"}
          </div>
          <Link href={`/${locale}/pos/terminals`} className="btn btn-primary" style={{ marginTop: 16 }}>
            <Icon name="plus" size={16} />
            {isAr ? "إضافة جهاز" : "Add Terminal"}
          </Link>
        </div>
      )}
    </>
  );
}
