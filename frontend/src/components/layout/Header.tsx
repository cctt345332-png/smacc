"use client";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { getUnreadCount, getNotifications, markRead, markAllRead } from "@/lib/notifications";

const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconUser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const IconLogout = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);
const IconSettings = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/>
  </svg>
);
const IconGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export default function Header({ locale, collapsed, onMobileMenuClick }: {
  locale: string; collapsed: boolean; onMobileMenuClick: () => void;
}) {
  const t = useTranslations("common");
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // جلب عدد التنبيهات
  useEffect(() => {
    const fetchCount = async () => {
      try { const { data } = await getUnreadCount(); setUnreadCount(data.count); } catch {}
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000); // كل دقيقة
    return () => clearInterval(interval);
  }, []);

  const openNotifications = async () => {
    setNotifOpen(v => !v);
    if (!notifOpen) {
      try { const { data } = await getNotifications(); setNotifications(data.slice(0, 10)); } catch {}
    }
  };

  const handleMarkRead = async (id: string) => {
    await markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAll = async () => {
    await markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleLogout = () => {
    logout();
    router.push(`/${locale}/login`);
  };

  const switchLocale = () => {
    const newLocale = locale === "ar" ? "en" : "ar";
    const path = window.location.pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(path);
  };

  const initials = user
    ? (user as any).fullName?.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase() || "U"
    : "U";

  return (
    <header className={`header${collapsed ? " collapsed" : ""}`}>
      {/* Mobile menu button */}
      <button className="mobile-menu-btn" onClick={onMobileMenuClick}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      {/* Search */}
      <div className="header-search">
        <span className="header-search-icon"><IconSearch /></span>
        <input type="text" placeholder={t("search")} />
      </div>

      <div className="header-spacer" />

      <div className="header-actions">
        {/* Language */}
        <button className="lang-switcher" onClick={switchLocale}>
          <IconGlobe />
          {locale === "ar" ? "EN" : "عربي"}
        </button>

        <div className="header-divider" />

        {/* Help */}
        <button className="header-icon-btn">
          <IconHelp />
        </button>

        {/* Notifications */}
        <div style={{ position: "relative" }} ref={notifRef}>
          <button className="header-icon-btn" onClick={openNotifications}>
            <IconBell />
            {unreadCount > 0 && (
              <span style={{
                position: "absolute", top: 4, right: 4,
                background: "var(--danger)", color: "white",
                fontSize: 9, fontWeight: 700, borderRadius: 10,
                padding: "1px 4px", minWidth: 16, textAlign: "center",
                border: "2px solid white", lineHeight: 1.4,
              }}>{unreadCount > 99 ? "99+" : unreadCount}</span>
            )}
          </button>

          {notifOpen && (
            <div className="dropdown" style={{ minWidth: 320, maxHeight: 420, overflow: "auto" }}>
              <div className="dropdown-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>
                  {locale === "ar" ? "التنبيهات" : "Notifications"}
                  {unreadCount > 0 && <span className="badge badge-danger" style={{ marginInlineStart: 6 }}>{unreadCount}</span>}
                </span>
                {unreadCount > 0 && (
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={handleMarkAll}>
                    {locale === "ar" ? "تحديد الكل" : "Mark all read"}
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  {locale === "ar" ? "لا توجد تنبيهات" : "No notifications"}
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} style={{
                    padding: "10px 16px", borderBottom: "1px solid var(--border)",
                    background: n.is_read ? "transparent" : "#F8FAFF",
                    cursor: "pointer",
                  }} onClick={() => handleMarkRead(n.id)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ fontWeight: n.is_read ? 400 : 600, fontSize: 12, flex: 1 }}>
                        {locale === "ar" ? n.title_ar : n.title_en}
                      </div>
                      <span className={`badge badge-${n.severity === "critical" ? "danger" : n.severity === "warning" ? "warning" : "info"}`} style={{ fontSize: 10, flexShrink: 0 }}>
                        {n.severity}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                      {new Date(n.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA")}
                    </div>
                  </div>
                ))
              )}
              <div style={{ padding: "10px 16px", textAlign: "center" }}>
                <Link href={`/${locale}/settings/alerts`} style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none", fontWeight: 600 }}
                  onClick={() => setNotifOpen(false)}>
                  {locale === "ar" ? "إعدادات التنبيهات" : "Alert Settings"}
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="header-divider" />

        {/* Profile */}
        <div style={{ position: "relative" }} ref={profileRef}>
          <button className="profile-btn" onClick={() => setProfileOpen(v => !v)}>
            <div className="profile-avatar">{initials}</div>
            <div className="profile-info">
              <div className="profile-name">{(user as any)?.fullName || "Admin"}</div>
              <div className="profile-role">{locale === "ar" ? "مدير النظام" : "System Admin"}</div>
            </div>
            <IconChevronDown />
          </button>

          {profileOpen && (
            <div className="dropdown" style={{ minWidth: 220 }}>
              <div className="dropdown-header">
                <div style={{ fontSize: 13, fontWeight: 600 }}>{(user as any)?.fullName || "Admin"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                  {(user as any)?.email || ""}
                </div>
              </div>
              <Link href={`/${locale}/settings/profile`} className="dropdown-item" onClick={() => setProfileOpen(false)}>
                <IconUser /> {t("profile")}
              </Link>
              <Link href={`/${locale}/settings`} className="dropdown-item" onClick={() => setProfileOpen(false)}>
                <IconSettings /> {t("settings")}
              </Link>
              <div className="dropdown-divider" />
              <div className="dropdown-item danger" onClick={handleLogout}>
                <IconLogout /> {t("logout")}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
