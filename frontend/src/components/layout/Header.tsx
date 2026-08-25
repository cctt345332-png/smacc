"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { getUnreadCount, getNotifications, markRead, markAllRead } from "@/lib/notifications";
import { Icon } from "@/components/ui/Icons";
import PageBackButton from "./PageBackButton";

const IconSearch = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IconBell = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IconHelp = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const IconUser = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IconLogout = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
const IconSettings = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>;
const IconGlobe = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IconChevronDown = () => <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>;

export default function Header({ locale, collapsed, onMobileMenuClick }: { locale: string; collapsed: boolean; onMobileMenuClick: () => void }) {
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
    const handler = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const fetchCount = async () => { try { const { data } = await getUnreadCount(); setUnreadCount(data.count); } catch {} };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const openNotifications = async () => {
    setNotifOpen(value => !value);
    if (!notifOpen) { try { const { data } = await getNotifications(); setNotifications(data.slice(0, 10)); } catch {} }
  };
  const handleMarkRead = async (id: string) => { await markRead(id); setNotifications(previous => previous.map(item => item.id === id ? { ...item, is_read: true } : item)); setUnreadCount(previous => Math.max(0, previous - 1)); };
  const handleMarkAll = async () => { await markAllRead(); setNotifications(previous => previous.map(item => ({ ...item, is_read: true }))); setUnreadCount(0); };
  const handleLogout = () => { logout(); router.push(`/${locale}/login`); };
  const switchLocale = () => { const target = locale === "ar" ? "en" : "ar"; router.push(window.location.pathname.replace(`/${locale}`, `/${target}`)); };
  const initials = user ? (user as any).fullName?.split(" ").map((word: string) => word[0]).join("").slice(0, 2).toUpperCase() || "U" : "U";
  const base = `/${locale}`;

  return (
    <header className={`header legacy-global-header${collapsed ? " collapsed" : ""}`}>
      <div className="legacy-global-titlebar">
        <button className="mobile-menu-btn" onClick={onMobileMenuClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <div className="legacy-global-appname"><span>م</span><strong>{locale === "ar" ? "مسار ERP" : "Masar ERP"}</strong><small>{locale === "ar" ? "نظام المحاسبة وإدارة الأعمال" : "Accounting & business management"}</small></div>
        <div className="header-search"><span className="header-search-icon"><IconSearch /></span><input type="text" placeholder={t("search")} /></div>
        <div className="header-spacer" />
        <div className="header-actions">
          <button className="lang-switcher" onClick={switchLocale}><IconGlobe />{locale === "ar" ? "EN" : "عربي"}</button>
          <button className="header-icon-btn"><IconHelp /></button>
          <div className="legacy-header-popup" ref={notifRef}>
            <button className="header-icon-btn" onClick={openNotifications}><IconBell />{unreadCount > 0 && <span className="legacy-notification-count">{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
            {notifOpen && <div className="dropdown legacy-dropdown" style={{ minWidth: 300, maxHeight: 400, overflow: "auto" }}>
              <div className="dropdown-header legacy-dropdown-header"><span>{locale === "ar" ? "التنبيهات" : "Notifications"}</span>{unreadCount > 0 && <button className="btn btn-ghost btn-sm" onClick={handleMarkAll}>{locale === "ar" ? "تحديد الكل" : "Mark all"}</button>}</div>
              {notifications.length === 0 ? <div className="legacy-dropdown-empty">{locale === "ar" ? "لا توجد تنبيهات" : "No notifications"}</div> : notifications.map(item => <div key={item.id} className={`legacy-notification-row${item.is_read ? "" : " unread"}`} onClick={() => handleMarkRead(item.id)}><strong>{locale === "ar" ? item.title_ar : item.title_en}</strong><span>{new Date(item.created_at).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-SA")}</span></div>)}
              <Link href={`${base}/settings/alerts`} className="legacy-dropdown-footer" onClick={() => setNotifOpen(false)}>{locale === "ar" ? "سجل التنبيهات" : "Alert register"}</Link>
            </div>}
          </div>
          <div className="legacy-header-popup" ref={profileRef}>
            <button className="profile-btn" onClick={() => setProfileOpen(value => !value)}><div className="profile-avatar">{initials}</div><div className="profile-info"><div className="profile-name">{(user as any)?.fullName || "Admin"}</div><div className="profile-role">{locale === "ar" ? "مدير النظام" : "System Admin"}</div></div><IconChevronDown /></button>
            {profileOpen && <div className="dropdown legacy-dropdown" style={{ minWidth: 210 }}><div className="dropdown-header legacy-dropdown-header"><strong>{(user as any)?.fullName || "Admin"}</strong><span>{(user as any)?.email || ""}</span></div><Link href={`${base}/settings/profile`} className="dropdown-item" onClick={() => setProfileOpen(false)}><IconUser /> {t("profile")}</Link><Link href={`${base}/settings`} className="dropdown-item" onClick={() => setProfileOpen(false)}><IconSettings /> {t("settings")}</Link><div className="dropdown-divider" /><button className="dropdown-item danger" onClick={handleLogout}><IconLogout /> {t("logout")}</button></div>}
          </div>
        </div>
      </div>
      <div className="legacy-global-menubar">
        <nav><Link href={`${base}/dashboard`}>{locale === "ar" ? "الرئيسية" : "Home"}</Link><Link href={`${base}/accounting/journal`}>{locale === "ar" ? "العمليات" : "Operations"}</Link><Link href={`${base}/reports`}>{locale === "ar" ? "التقارير" : "Reports"}</Link><Link href={`${base}/settings`}>{locale === "ar" ? "الإعدادات" : "Settings"}</Link></nav>
      </div>
      <nav className="legacy-quickbar" aria-label={locale === "ar" ? "العمليات السريعة" : "Quick operations"}>
        <Link className="legacy-quick-action legacy-quick-action-main" href={`${base}/sales/invoices/new`}><Icon name="invoice" size={17} /><span>{locale === "ar" ? "فاتورة مبيعات" : "Sales invoice"}</span></Link>
        <Link className="legacy-quick-action" href={`${base}/purchases/bills/new`}><Icon name="purchase" size={17} /><span>{locale === "ar" ? "فاتورة مشتريات" : "Purchase bill"}</span></Link>
        <Link className="legacy-quick-action" href={`${base}/sales/credit-notes/new`}><Icon name="refund" size={17} /><span>{locale === "ar" ? "مرتجع مبيعات" : "Sales return"}</span></Link>
        <Link className="legacy-quick-action" href={`${base}/purchases/debit-notes/new`}><Icon name="reverse" size={17} /><span>{locale === "ar" ? "مرتجع مشتريات" : "Purchase return"}</span></Link>
        <Link className="legacy-quick-action" href={`${base}/treasury/receipts/new`}><Icon name="cash" size={17} /><span>{locale === "ar" ? "سند قبض" : "Receipt"}</span></Link>
        <Link className="legacy-quick-action" href={`${base}/treasury/payments/new`}><Icon name="wallet" size={17} /><span>{locale === "ar" ? "سند صرف" : "Payment"}</span></Link>
        <Link className="legacy-quick-action" href={`${base}/accounting/journal/new`}><Icon name="journal" size={17} /><span>{locale === "ar" ? "قيد يومي" : "Journal entry"}</span></Link>
        <PageBackButton locale={locale} fallbackPath={`${base}/dashboard`} className="legacy-quick-back" />
      </nav>
    </header>
  );
}
