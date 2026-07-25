"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSuperAdminStore } from "@/store/superAdminStore";

// ─── SVG Icons (نفس نمط Icons.tsx) ───────────────────────────────────
const s = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const IcDashboard  = () => <svg {...s}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>;
const IcBuilding   = () => <svg {...s}><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01"/></svg>;
const IcDiamond    = () => <svg {...s}><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z"/></svg>;
const IcTarget     = () => <svg {...s}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const IcGlobe      = () => <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IcAI         = () => <svg {...s}><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>;
const IcLogout     = () => <svg {...s}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IcChevron    = () => <svg {...s}><polyline points="9 18 15 12 9 6"/></svg>;
const IcShield     = () => <svg {...s}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcMenu       = () => <svg {...s}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;

const NAV = [
  { key: "dashboard",  IconComp: IcDashboard, ar: "الرئيسية",      en: "Dashboard",    path: "dashboard" },
  { key: "tenants",    IconComp: IcBuilding,  ar: "الشركات",        en: "Companies",    path: "tenants" },
  { key: "plans",      IconComp: IcDiamond,   ar: "الباقات",        en: "Plans",        path: "plans" },
  { key: "activities", IconComp: IcTarget,    ar: "الأنشطة",        en: "Activities",   path: "activities" },
  { key: "landing",    IconComp: IcGlobe,     ar: "صفحة الهبوط",   en: "Landing Page", path: "landing" },
  { key: "ai",         IconComp: IcAI,        ar: "إعدادات AI",     en: "AI Settings",  path: "ai" },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, logout, _hasHydrated } = useSuperAdminStore();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (_hasHydrated && !token && !pathname?.includes("/super-admin/login")) {
      router.replace(`/${locale}/super-admin/login`);
    }
  }, [_hasHydrated, token]);

  // صفحة الـ login لا تحتاج layout
  if (pathname?.includes("/super-admin/login")) return <>{children}</>;

  if (!_hasHydrated || !token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.push(`/${locale}/super-admin/login`);
  }

  const currentNav = NAV.find(n => pathname?.includes(`/super-admin/${n.path}`));
  const sidebarW = collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)";

  return (
    <div dir={ar ? "rtl" : "ltr"} className="app-layout" style={{ fontFamily: "'Alexandria', sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <IcShield />
          </div>
          <span className="sidebar-logo-text" style={{ fontSize: 15 }}>
            {ar ? "المدير العام" : "Super Admin"}
          </span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <div className="sidebar-section">
            <div className="sidebar-section-label">{ar ? "القائمة" : "MENU"}</div>
            {NAV.map(item => {
              const active = !!pathname?.includes(`/super-admin/${item.path}`);
              return (
                <Link key={item.key} href={`/${locale}/super-admin/${item.path}`}
                  className={`sidebar-item${active ? " active" : ""}`}>
                  <span className="sidebar-item-icon"><item.IconComp /></span>
                  <span className="sidebar-item-text">{ar ? item.ar : item.en}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* User info */}
          {!collapsed && (
            <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="profile-avatar" style={{ width: 30, height: 30, fontSize: 12 }}>
                  {user?.full_name?.[0] || "A"}
                </div>
                <div>
                  <div style={{ color: "white", fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{user?.full_name}</div>
                  <div style={{ color: "#475569", fontSize: 10 }}>{user?.email}</div>
                </div>
              </div>
            </div>
          )}
          {/* Logout */}
          <button onClick={handleLogout} className="sidebar-collapse-btn" style={{ color: "#F87171" }}>
            <IcLogout />
            <span className="sidebar-item-text">{ar ? "تسجيل الخروج" : "Sign Out"}</span>
          </button>
          {/* Collapse */}
          <button onClick={() => setCollapsed(v => !v)} className="sidebar-collapse-btn">
            <span style={{ transform: collapsed ? (ar ? "rotate(180deg)" : "rotate(0deg)") : (ar ? "rotate(0deg)" : "rotate(180deg)"), display: "inline-flex", transition: "transform 0.3s" }}>
              <IcChevron />
            </span>
            <span className="sidebar-item-text">{ar ? "طي القائمة" : "Collapse"}</span>
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <div className={`main-content${collapsed ? " collapsed" : ""}`}>

        {/* Header */}
        <header className={`header${collapsed ? " collapsed" : ""}`}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              {currentNav ? (ar ? currentNav.ar : currentNav.en) : ""}
            </span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="badge badge-success" style={{ fontSize: 11 }}>
              {ar ? "مدير عام" : "Super Admin"}
            </span>
            <div className="header-divider" />
            <div className="profile-btn" style={{ cursor: "default" }}>
              <div className="profile-avatar">{user?.full_name?.[0] || "A"}</div>
              <div className="profile-info">
                <div className="profile-name">{user?.full_name}</div>
                <div className="profile-role">{user?.email}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content animate-fade">
          {children}
        </main>
      </div>
    </div>
  );
}
