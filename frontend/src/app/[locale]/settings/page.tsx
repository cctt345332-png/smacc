"use client";;
import { use } from "react";
import Link from "next/link";

const IcBuilding  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/><path d="M3 15h6"/><path d="M15 9h3"/><path d="M15 15h3"/></svg>;
const IcUsers     = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcShield    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcBranch    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcTax       = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IcStore     = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcCurrency  = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcBackup    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IcStar      = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcUser      = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const IcAI        = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/></svg>;
const IcBell      = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;

interface SettingCard {
  href: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  title_ar: string;
  title_en: string;
  desc_ar: string;
  desc_en: string;
}

export default function SettingsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";

  const cards: SettingCard[] = [
    {
      href: `/${locale}/settings/company`,
      icon: <IcBuilding />,
      color: "#5A187E", bg: "#EFF6FF",
      title_ar: "بيانات الشركة",
      title_en: "Company Info",
      desc_ar: "الاسم، الشعار، العنوان، الرقم الضريبي",
      desc_en: "Name, logo, address, VAT number",
    },
    {
      href: `/${locale}/settings/subscription`,
      icon: <IcStar />,
      color: "#75617F", bg: "#F5F3FF",
      title_ar: "اشتراكي",
      title_en: "My Subscription",
      desc_ar: "الباقة الحالية، الاستخدام، الترقية",
      desc_en: "Current plan, usage, upgrade",
    },
    {
      href: `/${locale}/settings/users`,
      icon: <IcUsers />,
      color: "#059669", bg: "#ECFDF5",
      title_ar: "المستخدمون",
      title_en: "Users",
      desc_ar: "إضافة وإدارة مستخدمي الشركة",
      desc_en: "Add and manage company users",
    },
    {
      href: `/${locale}/settings/roles`,
      icon: <IcShield />,
      color: "#DC2626", bg: "#FEF2F2",
      title_ar: "الأدوار والصلاحيات",
      title_en: "Roles & Permissions",
      desc_ar: "مصفوفة صلاحيات كل دور",
      desc_en: "Permissions matrix for each role",
    },
    {
      href: `/${locale}/settings/profile`,
      icon: <IcUser />,
      color: "#0891B2", bg: "#ECFEFF",
      title_ar: "الملف الشخصي",
      title_en: "My Profile",
      desc_ar: "بياناتك الشخصية وكلمة المرور",
      desc_en: "Your personal info and password",
    },
    {
      href: `/${locale}/settings/tax`,
      icon: <IcTax />,
      color: "#D97706", bg: "#FFFBEB",
      title_ar: "الضريبة وزاتكا",
      title_en: "Tax & ZATCA",
      desc_ar: "إعدادات ضريبة القيمة المضافة 15%",
      desc_en: "VAT 15% and ZATCA settings",
    },
    {
      href: `/${locale}/settings/branches`,
      icon: <IcBranch />,
      color: "#64748B", bg: "#F1F5F9",
      title_ar: "الفروع",
      title_en: "Branches",
      desc_ar: "إدارة فروع الشركة والمستودعات",
      desc_en: "Manage company branches and warehouses",
    },
    {
      href: `/${locale}/settings/currencies`,
      icon: <IcCurrency />,
      color: "#B45309", bg: "#FEF3C7",
      title_ar: "العملات",
      title_en: "Currencies",
      desc_ar: "العملات المستخدمة وأسعار الصرف",
      desc_en: "Currencies and exchange rates",
    },
    {
      href: `/${locale}/settings/store`,
      icon: <IcStore />,
      color: "#EC4899", bg: "#FDF2F8",
      title_ar: "المتجر الإلكتروني",
      title_en: "Online Store",
      desc_ar: "إعدادات المتجر والشحن",
      desc_en: "Store settings and shipping",
    },
    {
      href: `/${locale}/settings/ai`,
      icon: <IcAI />,
      color: "#5A187E", bg: "#EFF6FF",
      title_ar: "المساعد الذكي",
      title_en: "AI Assistant",
      desc_ar: "إعدادات الذكاء الاصطناعي ومزود الخدمة",
      desc_en: "AI settings and provider configuration",
    },
    {
      href: `/${locale}/settings/alerts`,
      icon: <IcBell />,
      color: "#DC2626", bg: "#FEF2F2",
      title_ar: "إعدادات التنبيهات",
      title_en: "Alert Settings",
      desc_ar: "تنبيهات المخزون والمبيعات والأصول والموارد البشرية",
      desc_en: "Alerts for inventory, sales, assets and HR",
    },
    {
      href: `/${locale}/settings/backup`,
      icon: <IcBackup />,
      color: "#059669", bg: "#ECFDF5",
      title_ar: "النسخ الاحتياطي",
      title_en: "Backup",
      desc_ar: "نسخ احتياطية تلقائية ويدوية",
      desc_en: "Automatic and manual backups",
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "الإعدادات" : "Settings"}</h1>
          <p className="page-subtitle">{ar ? "إدارة إعدادات النظام والشركة" : "Manage system and company settings"}</p>
        </div>
      </div>

      <div className="grid-3">
        {cards.map(card => (
          <Link key={card.href} href={card.href} style={{ textDecoration: "none" }}>
            <div
              className="card"
              style={{ padding: 20, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = card.color; (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 20px ${card.color}18`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", color: card.color, marginBottom: 14 }}>
                {card.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "var(--text-primary)" }}>
                {ar ? card.title_ar : card.title_en}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {ar ? card.desc_ar : card.desc_en}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
