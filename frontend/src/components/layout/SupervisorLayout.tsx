"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { getUnreadCount } from "@/lib/notifications";

const NavIcons = {
  home: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  invoices: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  reports: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  reps: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
};

export default function SupervisorLayout({ children, locale }: { children: React.ReactNode; locale: string }) {
  const ar = locale === "ar";
  const base = `/${locale}`;
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, _hasHydrated } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!token) router.replace(`/${locale}/login`);
  }, [mounted, token]);

  useEffect(() => {
    if (!token) return;
    getUnreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    const id = setInterval(() => getUnreadCount().then(r => setUnread(r.data.count)).catch(() => {}), 60_000);
    return () => clearInterval(id);
  }, [token]);

  const handleLogout = () => { logout(); router.push(`/${locale}/login`); };

  const navItems = [
    { key: "home",     icon: NavIcons.home,     label: ar ? "الرئيسية" : "Home",     href: `${base}/supervisor/dashboard` },
    { key: "invoices", icon: NavIcons.invoices,  label: ar ? "الفواتير" : "Invoices", href: `${base}/supervisor/invoices` },
    { key: "reports",  icon: NavIcons.reports,   label: ar ? "التقارير" : "Reports",  href: `${base}/supervisor/reports` },
    { key: "reps",     icon: NavIcons.reps,      label: ar ? "مناديبي" : "My Reps",  href: `${base}/supervisor/reps` },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const initials = user
    ? ((user as any).fullName || "S").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "S";

  if (!mounted) return <div style={{ minHeight: "100vh", background: "var(--bg)" }} />;
  if (!token) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
      {/* Top Bar */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "#65707E",
        padding: "0 16px", height: 56, display: "flex", alignItems: "center",
        justifyContent: "space-between", boxShadow: "0 1px 8px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(255,255,255,0.2)",
            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13 }}>{initials}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "white", lineHeight: 1.2 }}>
              {(user as any)?.fullName || (ar ? "المشرف" : "Supervisor")}
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>
              {ar ? "مشرف مناديب" : "Sales Supervisor"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => router.push(pathname.replace(`/${locale === "ar" ? "ar" : "en"}`, `/${locale === "ar" ? "en" : "ar"}`))}
            style={{ padding: "5px 10px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8,
              background: "transparent", color: "white", fontSize: 12, cursor: "pointer" }}>
            {locale === "ar" ? "EN" : "عربي"}
          </button>
          <button onClick={handleLogout}
            style={{ padding: "5px 10px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8,
              background: "transparent", color: "white", fontSize: 12, cursor: "pointer" }}>
            {ar ? "خروج" : "Logout"}
          </button>
        </div>
      </header>

      {/* المحتوى */}
      <main style={{ flex: 1, padding: "16px 16px 80px", maxWidth: 640, width: "100%", margin: "0 auto" }}>
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--surface)",
        borderTop: "1px solid var(--border)", display: "flex", height: 62, zIndex: 200,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.08)" }}>
        {navItems.map(item => {
          const active = isActive(item.href);
          return (
            <button key={item.key} onClick={() => router.push(item.href)}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 3, border: "none", background: "transparent",
                cursor: "pointer", color: active ? "#65707E" : "var(--text-muted)",
                padding: "6px 0", position: "relative" }}>
              {active && <span style={{ position: "absolute", top: 6, width: 4, height: 4,
                borderRadius: "50%", background: "#65707E" }} />}
              <span style={{ marginTop: active ? 6 : 0 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
