"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import adminApi from "@/lib/adminApi";

interface Stats {
  total_tenants: number;
  active_tenants: number;
  inactive_tenants: number;
  total_users: number;
  expired_plans: number;
  new_this_month: number;
  plans_distribution: Record<string, number>;
  activities_distribution: Record<string, number>;
}

// ─── Icons ────────────────────────────────────────────────────────────
const s = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcBuilding  = () => <svg {...s}><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01"/></svg>;
const IcCheck     = () => <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>;
const IcUsers     = () => <svg {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcWarning   = () => <svg {...s}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IcPause     = () => <svg {...s}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IcStar      = () => <svg {...s}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcArrow     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IcDiamond   = () => <svg {...s}><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z"/></svg>;
const IcTarget    = () => <svg {...s}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const IcGlobe     = () => <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;

const PLAN_CFG: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  trial:        { ar: "تجريبية",  en: "Trial",        color: "#059669", bg: "#ECFDF5" },
  starter:      { ar: "أساسية",   en: "Starter",      color: "#587795", bg: "#EFF6FF" },
  professional: { ar: "احترافية", en: "Professional", color: "#5D7E9F", bg: "#F5F3FF" },
  enterprise:   { ar: "مؤسسية",  en: "Enterprise",   color: "#0F172A", bg: "#F8FAFC" },
};

const ACT_CFG: Record<string, { ar: string; en: string }> = {
  mobile_phones: { ar: "جوالات",     en: "Mobile" },
  spare_parts:   { ar: "قطع غيار",  en: "Spare Parts" },
  pharmacy:      { ar: "صيدلية",    en: "Pharmacy" },
  grocery:       { ar: "بقالة",     en: "Grocery" },
  spices:        { ar: "عطارة",     en: "Spices" },
  clothing:      { ar: "ملابس",     en: "Clothing" },
  construction:  { ar: "مواد بناء", en: "Construction" },
  general:       { ar: "عام",       en: "General" },
};

export default function SuperAdminDashboard() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.get("/admin/stats").then(r => setStats(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="empty-state">
      <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
    </div>
  );

  const kpis = [
    { label: ar ? "إجمالي الشركات"    : "Total Companies",  value: stats?.total_tenants ?? 0,    Icon: IcBuilding, color: "#587795", bg: "#EFF6FF" },
    { label: ar ? "شركات نشطة"        : "Active Companies", value: stats?.active_tenants ?? 0,   Icon: IcCheck,    color: "#059669", bg: "#ECFDF5" },
    { label: ar ? "إجمالي المستخدمين" : "Total Users",      value: stats?.total_users ?? 0,      Icon: IcUsers,    color: "#5D7E9F", bg: "#F5F3FF" },
    { label: ar ? "باقات منتهية"      : "Expired Plans",    value: stats?.expired_plans ?? 0,    Icon: IcWarning,  color: "#DC2626", bg: "#FEF2F2" },
    { label: ar ? "شركات موقوفة"      : "Inactive",         value: stats?.inactive_tenants ?? 0, Icon: IcPause,    color: "#D97706", bg: "#FFFBEB" },
    { label: ar ? "جديدة هذا الشهر"  : "New This Month",   value: stats?.new_this_month ?? 0,   Icon: IcStar,     color: "#0891B2", bg: "#ECFEFF" },
  ];

  const quickActions = [
    { href: `/${locale}/super-admin/tenants`,    label: ar ? "إدارة الشركات"       : "Manage Companies",  Icon: IcBuilding, color: "#587795", bg: "#EFF6FF" },
    { href: `/${locale}/super-admin/plans`,      label: ar ? "تعديل الباقات"       : "Edit Plans",        Icon: IcDiamond,  color: "#5D7E9F", bg: "#F5F3FF" },
    { href: `/${locale}/super-admin/activities`, label: ar ? "إدارة الأنشطة"       : "Manage Activities", Icon: IcTarget,   color: "#059669", bg: "#ECFDF5" },
    { href: `/${locale}/super-admin/landing`,    label: ar ? "تعديل صفحة الهبوط"  : "Edit Landing Page", Icon: IcGlobe,    color: "#D97706", bg: "#FFFBEB" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "لوحة التحكم" : "Dashboard"}</h1>
          <p className="page-subtitle">{ar ? "نظرة عامة على النظام" : "System overview"}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid-3">
        {kpis.map((k, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: k.bg, color: k.color }}>
              <k.Icon />
            </div>
            <div className="stat-content">
              <div className="stat-label">{k.label}</div>
              <div className="stat-value" style={{ color: k.color }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid-2">

        {/* Plans Distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{ar ? "توزيع الباقات" : "Plans Distribution"}</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.entries(stats?.plans_distribution ?? {}).map(([key, count]) => {
              const total = Math.max(stats?.active_tenants ?? 1, 1);
              const pct = Math.round((count / total) * 100);
              const cfg = PLAN_CFG[key];
              return (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{ar ? cfg?.ar : cfg?.en}</span>
                    <span style={{ color: "var(--text-secondary)" }}>{count} <span style={{ color: "var(--text-muted)" }}>({pct}%)</span></span>
                  </div>
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: cfg?.color, borderRadius: 4, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activities Distribution */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">{ar ? "توزيع الأنشطة" : "Activities Distribution"}</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {Object.entries(stats?.activities_distribution ?? {})
              .sort(([, a], [, b]) => b - a)
              .map(([key, count]) => {
                const total = Math.max(stats?.active_tenants ?? 1, 1);
                const pct = Math.round((count / total) * 100);
                const cfg = ACT_CFG[key];
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <div style={{ width: 100, color: "var(--text-primary)", fontWeight: 500, flexShrink: 0 }}>
                      {ar ? cfg?.ar : cfg?.en}
                    </div>
                    <div style={{ flex: 1, height: 5, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--primary)", borderRadius: 3 }} />
                    </div>
                    <div style={{ width: 24, color: "var(--text-secondary)", textAlign: "center", fontWeight: 600 }}>{count}</div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "إجراءات سريعة" : "Quick Actions"}</span>
        </div>
        <div className="card-body">
          <div className="grid-4">
            {quickActions.map((a, i) => (
              <Link key={i} href={a.href} style={{ textDecoration: "none" }}>
                <div className="stat-card" style={{ cursor: "pointer", transition: "box-shadow 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.08)")}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                  <div className="stat-icon" style={{ background: a.bg, color: a.color }}>
                    <a.Icon />
                  </div>
                  <div className="stat-content">
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{a.label}</div>
                    <div style={{ marginTop: 8, color: a.color, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                      {ar ? "فتح" : "Open"} <IcArrow />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
