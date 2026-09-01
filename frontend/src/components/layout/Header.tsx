"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
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

type QuickAction = {
  id: string;
  href: string;
  icon: string;
  ar: string;
  en: string;
  section: "sales" | "purchases" | "treasury" | "accounting" | "inventory" | "reports" | "reps";
};

const QUICK_ACTION_CATALOG: QuickAction[] = [
  { id: "sales-invoice", href: "/sales/invoices/new", icon: "invoice", ar: "فاتورة مبيعات", en: "Sales invoice", section: "sales" },
  { id: "sales-invoices", href: "/sales/invoices", icon: "invoice", ar: "فواتير المبيعات", en: "Sales invoices", section: "sales" },
  { id: "sales-customers", href: "/sales/customers", icon: "users", ar: "العملاء", en: "Customers", section: "sales" },
  { id: "purchase-bill", href: "/purchases/bills/new", icon: "purchase", ar: "فاتورة مشتريات", en: "Purchase bill", section: "purchases" },
  { id: "purchase-return", href: "/purchases/debit-notes/new", icon: "reverse", ar: "مرتجع مشتريات", en: "Purchase return", section: "purchases" },
  { id: "sales-return", href: "/sales/credit-notes/new", icon: "refund", ar: "مرتجع مبيعات", en: "Sales return", section: "sales" },
  { id: "receipt", href: "/treasury/receipts/new", icon: "cash", ar: "سند قبض", en: "Receipt", section: "treasury" },
  { id: "payment", href: "/treasury/payments/new", icon: "wallet", ar: "سند صرف", en: "Payment", section: "treasury" },
  { id: "journal", href: "/accounting/journal/new", icon: "journal", ar: "قيد يومي", en: "Journal entry", section: "accounting" },
  { id: "inventory", href: "/inventory/items", icon: "inventory", ar: "المخزون", en: "Inventory", section: "inventory" },
  { id: "serial-report", href: "/reports/inventory/serial-profit", icon: "serial", ar: "تقرير السيريالات", en: "Serial report", section: "reports" },
  { id: "reports", href: "/reports", icon: "chart", ar: "التقارير", en: "Reports", section: "reports" },
  { id: "reps", href: "/reps/manage", icon: "users", ar: "إدارة المناديب", en: "Sales reps", section: "reps" },
];

const DEFAULT_QUICK_ACTION_IDS = ["sales-invoice", "purchase-bill", "sales-return", "purchase-return", "receipt", "payment", "journal"];
const QUICK_ACTIONS_STORAGE_KEY = "smacc.admin.quick-actions.v1";
const SECTION_LABELS = {
  sales: { ar: "المبيعات", en: "Sales" },
  purchases: { ar: "المشتريات", en: "Purchases" },
  treasury: { ar: "الخزينة", en: "Treasury" },
  accounting: { ar: "المحاسبة", en: "Accounting" },
  inventory: { ar: "المخزون", en: "Inventory" },
  reports: { ar: "التقارير", en: "Reports" },
  reps: { ar: "المناديب", en: "Sales reps" },
} as const;

export default function Header({ locale, collapsed, onMobileMenuClick }: { locale: string; collapsed: boolean; onMobileMenuClick: () => void }) {
  const t = useTranslations("common");
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [quickActionIds, setQuickActionIds] = useState<string[]>(DEFAULT_QUICK_ACTION_IDS);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const quickSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) setNotifOpen(false);
      if (quickSettingsRef.current && !quickSettingsRef.current.contains(event.target as Node)) setQuickSettingsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const validIds = parsed.filter((id): id is string => typeof id === "string" && QUICK_ACTION_CATALOG.some(action => action.id === id));
          if (validIds.length > 0) setQuickActionIds(validIds);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(quickActionIds)); } catch {}
  }, [quickActionIds]);

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
  const quickActions = quickActionIds.map(id => QUICK_ACTION_CATALOG.find(action => action.id === id)).filter((action): action is QuickAction => Boolean(action));
  const activeHref = [...quickActions].sort((a, b) => b.href.length - a.href.length).find(action => pathname === `${base}${action.href}` || pathname.startsWith(`${base}${action.href}/`))?.href;

  const toggleQuickAction = (id: string) => {
    setQuickActionIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };
  const resetQuickActions = () => setQuickActionIds(DEFAULT_QUICK_ACTION_IDS);

  return (
    <header className={`header legacy-global-header${collapsed ? " collapsed" : ""}`}>
      <div className="legacy-global-titlebar">
        <button className="mobile-menu-btn" onClick={onMobileMenuClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>
        <div className="legacy-global-appname"><span>م</span><strong>مسار ERP</strong><small>{locale === "ar" ? "نظام المحاسبة وإدارة الأعمال" : "Accounting & business management"}</small></div>
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
        <div className="legacy-quickbar-items">
          {quickActions.map(action => <Link key={action.id} className={`legacy-quick-action${activeHref === action.href ? " active" : ""}`} href={`${base}${action.href}`}><Icon name={action.icon as any} size={17} /><span>{locale === "ar" ? action.ar : action.en}</span></Link>)}
          <PageBackButton locale={locale} fallbackPath={`${base}/dashboard`} className="legacy-quick-back" />
        </div>
        <div className="legacy-quickbar-config-wrap" ref={quickSettingsRef}>
          <button type="button" className={`legacy-quickbar-config${quickSettingsOpen ? " open" : ""}`} onClick={() => setQuickSettingsOpen(value => !value)} aria-expanded={quickSettingsOpen}>
            <Icon name="settings" size={17} /><span>{locale === "ar" ? "إعداد اللوحة" : "Customize"}</span>
          </button>
          {quickSettingsOpen && <div className="legacy-quickbar-settings-panel">
            <div className="legacy-quickbar-settings-head"><strong>{locale === "ar" ? "اختصارات الشريط" : "Quick shortcuts"}</strong><button type="button" onClick={resetQuickActions}>{locale === "ar" ? "إعادة الافتراضي" : "Reset"}</button></div>
            <p>{locale === "ar" ? "اختر الاختصارات التي تريد ظهورها في الشريط." : "Choose the shortcuts shown in the bar."}</p>
            {(Object.keys(SECTION_LABELS) as QuickAction["section"][]).map(section => <div key={section} className="legacy-quickbar-settings-section"><div className="legacy-quickbar-section-title">{locale === "ar" ? SECTION_LABELS[section].ar : SECTION_LABELS[section].en}</div>{QUICK_ACTION_CATALOG.filter(action => action.section === section).map(action => <label key={action.id} className="legacy-quickbar-option"><input type="checkbox" checked={quickActionIds.includes(action.id)} onChange={() => toggleQuickAction(action.id)} /><span>{locale === "ar" ? action.ar : action.en}</span></label>)}</div>)}
          </div>}
        </div>
      </nav>
    </header>
  );
}
