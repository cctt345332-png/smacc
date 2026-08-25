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
    { label: ar ? "تقاريري" : "My Reports",      href: `${base}/reps/me/reports`,   color: "#356B63" },
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

  /* auth guard — بعد الـ mount فقط، مرة واحدة */
  useEffect(() => {
    if (!mounted) return;
    if (!token) router.replace(`/${locale}/login`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  /* مراقبة token — لو انتهى أثناء الجلسة */
  useEffect(() => {
    if (mounted && !token) router.replace(`/${locale}/login`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* جلب التنبيهات — مرة عند التحميل ثم كل دقيقة */
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const fetch = () => {
      getUnreadCount()
        .then(r => { if (!cancelled) setUnread(r.data.count); })
        .catch(() => {});
    };
    fetch();
    const id = setInterval(fetch, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* تتبع الموقع — فقط للمناديب، كل دقيقة + عند فتح التطبيق */
  useEffect(() => {
    if (!token) return;
    // لا ترسل الموقع إلا إذا كان المستخدم مندوباً فعلاً
    const userRole = (user as any)?.role;
    if (userRole && userRole !== "rep" && userRole !== "sales_rep") return;
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
    <div className="rep-legacy-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <style jsx global>{`
        .rep-legacy-shell { --rep-green:#3E0865; --rep-paper:#FFFEFA; --rep-grid:#C8D0C7; --rep-soft:#F4EFF7; background-color:var(--rep-paper); background-image:linear-gradient(rgba(11,93,74,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(11,93,74,.035) 1px,transparent 1px); background-size:24px 24px; color:#1F2D27; }
        .rep-legacy-shell .rep-legacy-menu { display:flex; align-items:center; gap:0; background:#E9ECE6; border-bottom:1px solid var(--rep-grid); min-height:34px; padding-inline:14px; overflow-x:auto; }
        .rep-legacy-shell .rep-legacy-menu a { color:#233B31; text-decoration:none; font-size:12px; font-weight:700; padding:8px 13px; border-inline-start:1px solid #D5DAD4; white-space:nowrap; }
        .rep-legacy-shell .rep-legacy-menu a:hover, .rep-legacy-shell .rep-legacy-menu a.active { background:var(--rep-soft); color:var(--rep-green); }
        .rep-legacy-shell .rep-legacy-toolbar { display:flex; align-items:center; gap:7px; padding:8px 14px; background:#FFFEFA; border-bottom:1px solid var(--rep-grid); }
        .rep-legacy-shell .rep-legacy-toolbar a { background:linear-gradient(#16806a,#3E0865); color:#fff; border:1px solid #26033F; border-radius:2px; padding:6px 10px; font-size:12px; font-weight:700; text-decoration:none; white-space:nowrap; }
        .rep-legacy-shell .rep-legacy-toolbar span { font-size:11px; color:#587066; margin-inline-start:5px; }
        .rep-legacy-shell main { max-width:1160px !important; padding:18px 20px 88px !important; }
        .rep-legacy-shell main > div > div { border-radius:2px; }
        .rep-legacy-shell button { border-radius:2px !important; }
        .rep-legacy-shell input, .rep-legacy-shell select, .rep-legacy-shell textarea { border-radius:1px !important; border-color:var(--rep-grid) !important; }
        .rep-legacy-shell .rep-legacy-note { font-family:"IBM Plex Sans Arabic", Cairo, sans-serif; font-size:11px; color:#577066; }
        /* طبقة موحدة لكافة صفحات المندوب: أزرار ونماذج وجداول Legacy ERP */
        .rep-legacy-shell .btn-primary, .rep-legacy-shell .btn.btn-primary { background:linear-gradient(#16806A,#3E0865) !important; border:1px solid #26033F !important; color:#fff !important; border-radius:2px !important; box-shadow:none !important; }
        .rep-legacy-shell .btn-secondary, .rep-legacy-shell .btn.btn-secondary { background:#E9ECE6 !important; border:1px solid #AEB9B0 !important; color:#23463A !important; border-radius:2px !important; box-shadow:none !important; }
        .rep-legacy-shell .card, .rep-legacy-shell .table-wrapper { background:#FFFEFA !important; border-color:#C8D0C7 !important; border-radius:2px !important; box-shadow:none !important; }
        .rep-legacy-shell .card-header { background:#F4EFF7 !important; border-bottom:1px solid #C8D0C7 !important; }
        .rep-legacy-shell table { border-collapse:collapse !important; background:#FFFEFA !important; }
        .rep-legacy-shell th { background:#E9ECE6 !important; color:#28463A !important; border:1px solid #C8D0C7 !important; font-size:12px !important; }
        .rep-legacy-shell td { border:1px solid #D7DDD6 !important; }
        .rep-legacy-shell tr:hover td { background:#F0F6F0 !important; }
        .rep-legacy-shell input, .rep-legacy-shell select, .rep-legacy-shell textarea { background:#FFFEFA !important; color:#1F2D27 !important; box-shadow:inset 0 1px 1px rgba(0,0,0,.03) !important; }
        .rep-legacy-shell input:focus, .rep-legacy-shell select:focus, .rep-legacy-shell textarea:focus { outline:2px solid #9BBBAD !important; outline-offset:-1px !important; border-color:#3E0865 !important; }
        .rep-legacy-shell input[type="checkbox"], .rep-legacy-shell input[type="radio"] { accent-color:#3E0865 !important; }
        .rep-legacy-shell a[style*="background: rgb(37, 99, 235)"], .rep-legacy-shell button[style*="background: rgb(37, 99, 235)"], .rep-legacy-shell a[style*="background: rgb(124, 58, 237)"], .rep-legacy-shell button[style*="background: rgb(124, 58, 237)"], .rep-legacy-shell a[style*="background: rgb(59, 130, 246)"], .rep-legacy-shell button[style*="background: rgb(59, 130, 246)"], .rep-legacy-shell a[style*="background: rgb(99, 102, 241)"], .rep-legacy-shell button[style*="background: rgb(99, 102, 241)"] { background:linear-gradient(#16806A,#3E0865) !important; border:1px solid #26033F !important; color:#fff !important; border-radius:2px !important; box-shadow:none !important; }
        .rep-legacy-shell [style*="color: rgb(37, 99, 235)"], .rep-legacy-shell [style*="color: rgb(124, 58, 237)"], .rep-legacy-shell [style*="color: rgb(59, 130, 246)"], .rep-legacy-shell [style*="color: rgb(99, 102, 241)"], .rep-legacy-shell [style*="color: rgb(79, 70, 229)"], .rep-legacy-shell [style*="color: rgb(139, 92, 246)"] { color:#3E0865 !important; }
        .rep-legacy-shell [style*="background: rgb(239, 246, 255)"], .rep-legacy-shell [style*="background: rgb(245, 243, 255)"], .rep-legacy-shell [style*="background: rgb(238, 242, 255)"], .rep-legacy-shell [style*="background: rgb(243, 244, 246)"] { background:#F4EFF7 !important; }
        .rep-legacy-shell [style*="border: 1px solid rgb(191, 219, 254)"], .rep-legacy-shell [style*="border: 1.5px solid rgb(191, 219, 254)"] { border-color:#9BBBAD !important; }
        .rep-legacy-shell [style*="border-radius"] { border-radius:2px !important; }
        .rep-legacy-shell .empty-state { background:#FFFEFA !important; border:1px dashed #9BBBAD !important; border-radius:2px !important; }
        .rep-legacy-shell .rep-mobile-nav { display:none; }
        @media (max-width: 799px) { .rep-legacy-shell .rep-legacy-menu { display:none; } .rep-legacy-shell .rep-legacy-toolbar span { display:none; } .rep-legacy-shell .rep-legacy-toolbar { justify-content:center; } .rep-legacy-shell .rep-mobile-nav { position:fixed; display:flex; align-items:stretch; justify-content:space-around; bottom:0; inset-inline:0; height:76px; background:#FFFEFA; border-top:2px solid #3E0865; box-shadow:0 -4px 12px rgba(11,93,74,.14); z-index:220; padding:5px 4px max(5px, env(safe-area-inset-bottom)); } .rep-legacy-shell .rep-mobile-nav button { flex:1; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:4px 2px; border:0 !important; border-radius:2px !important; background:transparent; color:#6B7E75; font-family:inherit; cursor:pointer; } .rep-legacy-shell .rep-mobile-nav .rep-nav-icon { width:31px; height:29px; display:flex; align-items:center; justify-content:center; border:1px solid transparent; } .rep-legacy-shell .rep-mobile-nav .rep-nav-label { font-size:11px; font-weight:800; white-space:nowrap; } .rep-legacy-shell .rep-mobile-nav button.active { color:#3E0865; background:#F4EFF7; border:1px solid #9BBBAD !important; } .rep-legacy-shell .rep-mobile-nav button.active .rep-nav-icon { background:#3E0865; color:#fff; border-color:#26033F; } .rep-legacy-shell main { padding-bottom:94px !important; } }
        @media (min-width: 800px) { .rep-legacy-shell .rep-mobile-nav { display:none !important; } .rep-legacy-shell main { padding-bottom:28px !important; } }
      `}</style>

      {/* ── شريط تنبيه الدخول كمندوب ───────────────────────────── */}
      {isImpersonating && (
                <div style={{
          background: "#F4EFF7", color: "#3E0865",
          borderBottom: "1px solid #C8D0C7", padding: "6px 14px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 11, fontWeight: 700, flexShrink: 0, zIndex: 200,
        }}>
          <span>{ar ? "وضع مراجعة المدير: بيانات المندوب" : "Manager review mode: rep data"}</span>
          <button onClick={handleExitImpersonation} style={{
            background: "#FFFEFA", border: "1px solid #3E0865", borderRadius: 1,
            color: "#3E0865", padding: "3px 9px", cursor: "pointer", fontWeight: 800, fontSize: 11,
          }}>{ar ? "العودة للإدارة" : "Back to Admin"}</button>
        </div>
      )}

      {/* ── Top Bar ────────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "linear-gradient(180deg,#11725D,#3E0865)",
        color: "#fff",
        borderBottom: "1px solid #26033F",
        padding: "0 16px",
        height: 48,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
      }}>
        {/* الاسم */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 31, height: 31, borderRadius: 2,
            background: "#F4EFF7",
            color: "#3E0865", display: "flex", alignItems: "center",
            justifyContent: "center", fontWeight: 800, fontSize: 12,
            flexShrink: 0,
          }}>{initials}</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, lineHeight: 1.2, color: "#fff" }}>
              {(user as any)?.fullName || (ar ? "المندوب" : "Rep")}
            </div>
            <div style={{ fontSize: 10, color: "#D9EEE7" }}>
              {ar ? "مندوب مبيعات" : "Sales Rep"}
            </div>
          </div>
        </div>

        {/* الأكشن الجهة الأخرى */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* تغيير اللغة */}
          <button onClick={switchLocale} style={{
            padding: "5px 9px", border: "1px solid rgba(255,255,255,.4)", borderRadius: 2,
            background: "rgba(255,255,255,.1)", cursor: "pointer", fontSize: 11, fontWeight: 700,
            color: "#fff",
          }}>
            {locale === "ar" ? "EN" : "عربي"}
          </button>

          {/* التنبيهات */}
          <button style={{
            width: 36, height: 36, border: "none", background: "transparent",
            cursor: "pointer", position: "relative", display: "flex",
            alignItems: "center", justifyContent: "center", color: "#fff",
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

      <div className="rep-legacy-menu">
        <Link href={`${base}/reps/me/dashboard`} className={pathname.includes("/dashboard") ? "active" : ""}>{ar ? "الرئيسية" : "Home"}</Link>
        <Link href={`${base}/reps/me/invoices`} className={pathname.includes("/invoices") ? "active" : ""}>{ar ? "الفواتير" : "Invoices"}</Link>
        <Link href={`${base}/reps/me/customers`} className={pathname.includes("/customers") ? "active" : ""}>{ar ? "العملاء" : "Customers"}</Link>
        <Link href={`${base}/reps/me/stock`} className={pathname.includes("/stock") ? "active" : ""}>{ar ? "المخزون" : "Stock"}</Link>
        <Link href={`${base}/reps/me/reports`} className={pathname.includes("/reports") ? "active" : ""}>{ar ? "تقارير المندوب" : "Rep Reports"}</Link>
      </div>
      <div className="rep-legacy-toolbar">
        <Link href={`${base}/reps/me/invoices/new`}>{ar ? "+ فاتورة مبيعات" : "+ Sales Invoice"}</Link>
        <Link href={`${base}/reps/me/payments`}>{ar ? "سند قبض" : "Receipt"}</Link>
        <Link href={`${base}/reps/me/invoices`}>{ar ? "مرتجع مبيعات" : "Sales Return"}</Link>
        <span>{ar ? "اختر الفاتورة الأصلية لبدء المرتجع، وتُرسل الفواتير للاعتماد قبل الترحيل" : "Choose the original invoice to start a return; invoices are submitted for approval before posting"}</span>
      </div>

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

      {/* ── تنقل جوال كامل — Legacy ERP ───────────────────────────── */}
      <nav className="rep-mobile-nav" aria-label={ar ? "تنقل المندوب" : "Rep navigation"}>
        {navItems.map(item => {
          const active = isActive(item.href) || (item.key === "more" && moreOpen);
          return (
            <button key={item.key} className={active ? "active" : ""} onClick={() => {
              if (item.key === "more") setMoreOpen(v => !v);
              else if (item.href) router.push(item.href);
            }}>
              <span className="rep-nav-icon">{item.icon}</span>
              <span className="rep-nav-label">{item.label}</span>
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
