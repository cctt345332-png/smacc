"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { getUnreadCount } from "@/lib/notifications";

/* ══════════════════════════════════════════════════════════════════
   RepLayout — واجهة المندوب الحصرية
   موبايل فيرست، بدون sidebar، bottom navigation bar
   ══════════════════════════════════════════════════════════════════ */

/* ── أيقونات Bottom Nav ─────────────────────────────────────────── */
const NavIcons = {
  home: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  invoice: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  customers: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  stock: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    </svg>
  ),
  more: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="1" fill="currentColor"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  ),
};

/* ── أيقونة Bell ────────────────────────────────────────────────── */
const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);

/* ── أيقونة Logout ──────────────────────────────────────────────── */
const LogoutIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

/* ── More Menu (drawer من الأسفل) ───────────────────────────────── */
function MoreDrawer({
  open, onClose, locale, ar, onLogout,
}: {
  open: boolean; onClose: () => void; locale: string; ar: boolean; onLogout: () => void;
}) {
  const base = `/${locale}`;
  const links = [
    { label: ar ? "سندات القبض" : "Receipts",   href: `${base}/reps/me/payments`,  color: "#059669" },
    { label: ar ? "تقاريري" : "My Reports",      href: `${base}/reps/me/reports`,   color: "#7C3AED" },
  ];

  return (
    <>
      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 900 }}
          onClick={onClose}
        />
      )}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 901,
        background: "var(--surface)",
        borderRadius: "20px 20px 0 0",
        padding: "20px 20px 36px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.15)",
        transform: open ? "translateY(0)" : "translateY(110%)",
        transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 20px" }} />

        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
          {ar ? "المزيد" : "More"}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={onClose}
              style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                background: "var(--bg)", borderRadius: 14, padding: "16px 8px", border: "1.5px solid var(--border)" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: l.color + "18",
                display: "flex", alignItems: "center", justifyContent: "center", color: l.color }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
                </svg>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textAlign: "center" }}>
                {l.label}
              </span>
            </Link>
          ))}
        </div>

        <button
          onClick={onLogout}
          style={{
            width: "100%", padding: "14px", border: "1.5px solid #FECACA",
            background: "#FEF2F2", borderRadius: 12, color: "#DC2626",
            fontWeight: 700, fontSize: 14, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <LogoutIcon />
          {ar ? "تسجيل الخروج" : "Logout"}
        </button>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════ */
export default function RepLayout({
  children, locale,
}: {
  children: React.ReactNode; locale: string;
}) {
  const ar = locale === "ar";
  const base = `/${locale}`;
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, _hasHydrated } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  // نتحقق من الـ hydration مباشرة من localStorage لتجنب الشاشة البيضاء
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  /* auth guard — بعد الـ mount فقط */
  useEffect(() => {
    if (!mounted) return;
    if (!token) router.replace(`/${locale}/login`);
  }, [mounted, token]);

  /* جلب التنبيهات */
  useEffect(() => {
    if (!token) return;
    getUnreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    const id = setInterval(() => {
      getUnreadCount().then(r => setUnread(r.data.count)).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [token]);

  /* تتبع الموقع — صارم، كل دقيقة + عند فتح التطبيق */
  useEffect(() => {
    if (!token) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let lastSent = 0;
    const MIN_INTERVAL = 30_000;

    const sendLocation = () => {
      const now = Date.now();
      if (now - lastSent < MIN_INTERVAL) return;
      lastSent = now;
      navigator.geolocation.getCurrentPosition(
        pos => {
          import("@/lib/reps").then(({ postMyLocation }) => {
            postMyLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy ?? undefined,
              speed: pos.coords.speed ?? undefined,
              heading: pos.coords.heading ?? undefined,
              is_moving: (pos.coords.speed ?? 0) > 0.5,
              recorded_at: new Date(pos.timestamp).toISOString(),
            }).catch(() => {});
          });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    };

    sendLocation();
    const id = setInterval(sendLocation, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") sendLocation();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [token]);

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/login`);
  };

  const switchLocale = () => {
    const newLocale = locale === "ar" ? "en" : "ar";
    router.push(window.location.pathname.replace(`/${locale}`, `/${newLocale}`));
  };

  if (!mounted) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)" }} />
    );
  }
  if (!token) return null;

  /* هل المدير يتصفح كمندوب؟ */
  const isImpersonating = typeof window !== "undefined" && !!sessionStorage.getItem("prev_token");

  const handleExitImpersonation = () => {
    const prevToken = sessionStorage.getItem("prev_token");
    const prevUser = JSON.parse(sessionStorage.getItem("prev_user") || "null");
    const prevPath = sessionStorage.getItem("prev_path") || `/${locale}/reps/manage`;
    sessionStorage.removeItem("prev_token");
    sessionStorage.removeItem("prev_user");
    sessionStorage.removeItem("prev_path");
    if (prevToken && prevUser) {
      // استعادة التوكن الأصلي مباشرة بدون logout
      import("@/store/authStore").then(({ useAuthStore }) => {
        useAuthStore.getState().setAuth(prevToken, prevUser);
      });
      router.replace(prevPath);
    } else {
      logout();
      router.replace(`/${locale}/login`);
    }
  };

  /* Bottom nav items */
  const navItems = [
    { key: "home",      icon: NavIcons.home,      label: ar ? "الرئيسية" : "Home",      href: `${base}/reps/me/dashboard` },
    { key: "invoices",  icon: NavIcons.invoice,   label: ar ? "الفواتير" : "Invoices",  href: `${base}/reps/me/invoices` },
    { key: "customers", icon: NavIcons.customers, label: ar ? "العملاء" : "Customers",  href: `${base}/reps/me/customers` },
    { key: "stock",     icon: NavIcons.stock,     label: ar ? "المخزون" : "Stock",      href: `${base}/reps/me/stock` },
    { key: "more",      icon: NavIcons.more,      label: ar ? "المزيد" : "More",        href: null },
  ];

  const isActive = (href: string | null) =>
    href && (pathname === href || pathname.startsWith(href + "/"));

  const initials = user
    ? ((user as any).fullName || "M").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "M";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column" }}>

      {/* ── شريط تنبيه الدخول كمندوب ───────────────────────────── */}
      {isImpersonating && (
        <div style={{
          background: "#7C3AED", color: "white",
          padding: "8px 16px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 13, fontWeight: 600, flexShrink: 0,
          zIndex: 200,
        }}>
          <span>👁 {ar ? "أنت تتصفح لوحة المندوب — البيانات حقيقية" : "Viewing rep dashboard — real data"}</span>
          <button
            onClick={handleExitImpersonation}
            style={{
              background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 8, color: "white", padding: "4px 14px",
              cursor: "pointer", fontWeight: 700, fontSize: 12,
            }}>
            {ar ? "← الخروج للإدارة" : "← Back to Admin"}
          </button>
        </div>
      )}

      {/* ── Top Bar ────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "0 16px",
        height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}>
        {/* الاسم */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "linear-gradient(135deg,#2563EB,#7C3AED)",
            color: "white", display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 700, fontSize: 13,
            flexShrink: 0,
          }}>{initials}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.2 }}>
              {(user as any)?.fullName || (ar ? "المندوب" : "Rep")}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {ar ? "مندوب مبيعات" : "Sales Rep"}
            </div>
          </div>
        </div>

        {/* الأكشن الجهة الأخرى */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* تغيير اللغة */}
          <button onClick={switchLocale} style={{
            padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8,
            background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600,
            color: "var(--text-secondary)",
          }}>
            {locale === "ar" ? "EN" : "عربي"}
          </button>

          {/* التنبيهات */}
          <button style={{
            width: 36, height: 36, border: "none", background: "transparent",
            cursor: "pointer", position: "relative", display: "flex",
            alignItems: "center", justifyContent: "center", color: "var(--text-secondary)",
          }}>
            <BellIcon />
            {unread > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 4,
                background: "#DC2626", color: "white",
                fontSize: 9, fontWeight: 700, borderRadius: 10,
                padding: "1px 4px", minWidth: 16, textAlign: "center",
                border: "2px solid white", lineHeight: 1.4,
              }}>{unread > 99 ? "99+" : unread}</span>
            )}
          </button>
        </div>
      </header>

      {/* ── المحتوى ─────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        padding: "16px 16px 80px", /* padding bottom لـ bottom nav */
        maxWidth: 640,
        width: "100%",
        margin: "0 auto",
      }}>
        {children}
      </main>

      {/* ── Bottom Navigation ────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        height: 62,
        zIndex: 200,
        boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
      }}>
        {navItems.map(item => {
          const active = isActive(item.href);
          return (
            <button
              key={item.key}
              onClick={() => {
                if (item.key === "more") { setMoreOpen(v => !v); }
                else if (item.href) router.push(item.href);
              }}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 3,
                border: "none", background: "transparent", cursor: "pointer",
                color: active || (item.key === "more" && moreOpen) ? "#2563EB" : "var(--text-muted)",
                padding: "6px 0",
                transition: "color 0.15s",
                position: "relative",
              }}
            >
              {/* نقطة التفعيل */}
              {active && (
                <span style={{
                  position: "absolute", top: 6, width: 4, height: 4,
                  borderRadius: "50%", background: "#2563EB",
                }} />
              )}
              <span style={{ marginTop: active ? 6 : 0 }}>{item.icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ── More Drawer ─────────────────────────────────────────────── */}
      <MoreDrawer
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        locale={locale}
        ar={ar}
        onLogout={handleLogout}
      />
    </div>
  );
}
