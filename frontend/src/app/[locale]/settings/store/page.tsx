"use client";
import { useState, use } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";

const IcStore        = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcPackage      = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>;
const IcShoppingCart = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>;
const IcTag          = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
const IcTruck        = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
const IcGlobe        = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>;
const IcChevron      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>;
const IcSave         = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcCheck        = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcLock         = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      style={{ width: 44, height: 24, borderRadius: 12, background: checked ? "var(--primary)" : "#CBD5E1", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 3, left: checked ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
    </button>
  );
}

export default function StoreSettingsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const { plan } = useAuthStore();
  const hasStore = plan === "professional" || plan === "enterprise";

  const [storeEnabled,          setStoreEnabled]          = useState(true);
  const [storeName,             setStoreName]             = useState(ar ? "متجر الشركة السعودية" : "Saudi Company Store");
  const [storeDesc,             setStoreDesc]             = useState(ar ? "متجر إلكتروني متكامل لمنتجاتنا" : "Full-featured online store for our products");
  const [storeSlug,             setStoreSlug]             = useState("saudi-company-store");
  const [shippingEnabled,       setShippingEnabled]       = useState(true);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("200");
  const [defaultShippingCost,   setDefaultShippingCost]   = useState("25");
  const [saved,                 setSaved]                 = useState(false);

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const quickLinks = [
    { href: `/${locale}/inventory/items`,      labelAr: "إدارة المنتجات", labelEn: "Manage Products", icon: <IcPackage />,      color: "#5A187E", bg: "#EFF6FF" },
    { href: `/${locale}/sales/orders`,         labelAr: "الطلبات",         labelEn: "Orders",           icon: <IcShoppingCart />, color: "#059669", bg: "#ECFDF5" },
    { href: `/${locale}/inventory/categories`, labelAr: "التصنيفات",       labelEn: "Categories",       icon: <IcTag />,          color: "#75617F", bg: "#F5F3FF" },
  ];

  // ── الباقة لا تدعم المتجر ─────────────────────────────────────────
  if (!hasStore) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: "0 24px" }}>
        <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #FEF9C3, #FDE68A)", display: "flex", alignItems: "center", justifyContent: "center", color: "#D97706", marginBottom: 24 }}>
          <IcLock />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>
          {ar ? "المتجر الإلكتروني غير متاح" : "Online Store Unavailable"}
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 400, lineHeight: 1.7, marginBottom: 24 }}>
          {ar ? "هذه الوحدة متاحة في الباقة الاحترافية والمؤسسية فقط." : "This module is available in Professional and Enterprise plans only."}
        </p>
        <Link href={`/${locale}/settings/company`} className="btn btn-primary">
          {ar ? "ترقية الباقة" : "Upgrade Plan"}
        </Link>
      </div>
    );
  }

  // ── الصفحة الكاملة ────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "إعدادات المتجر الإلكتروني" : "Online Store Settings"}</h1>
          <p className="page-subtitle">{ar ? "إدارة وتخصيص متجرك الإلكتروني" : "Manage and customize your online store"}</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave}>
          {saved ? <IcCheck /> : <IcSave />}
          {saved ? (ar ? "تم الحفظ" : "Saved!") : (ar ? "حفظ الإعدادات" : "Save Settings")}
        </button>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>

        {/* العمود الأيسر */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* حالة المتجر */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IcStore />{ar ? "حالة المتجر" : "Store Status"}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ar ? "تفعيل المتجر" : "Enable Store"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {ar ? "عند التفعيل يصبح المتجر متاحاً للعملاء" : "When enabled, the store is accessible to customers"}
                  </div>
                </div>
                <Toggle checked={storeEnabled} onChange={setStoreEnabled} />
              </div>
              <div style={{ marginTop: 12, padding: "10px 14px", background: storeEnabled ? "#ECFDF5" : "#F1F5F9", borderRadius: 8, border: `1px solid ${storeEnabled ? "#A7F3D0" : "var(--border)"}`, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: storeEnabled ? "#059669" : "#94A3B8", flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: storeEnabled ? "#065F46" : "var(--text-secondary)", fontWeight: 500 }}>
                  {storeEnabled ? (ar ? "المتجر نشط ومتاح للعملاء" : "Store is active and accessible") : (ar ? "المتجر معطّل حالياً" : "Store is currently disabled")}
                </span>
              </div>
            </div>
          </div>

          {/* بيانات المتجر */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IcGlobe />{ar ? "بيانات المتجر" : "Store Information"}
              </span>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">{ar ? "اسم المتجر" : "Store Name"} <span className="required">*</span></label>
                <input className="form-input" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder={ar ? "اسم متجرك" : "Your store name"} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "وصف المتجر" : "Store Description"}</label>
                <textarea className="form-input" rows={3} value={storeDesc} onChange={(e) => setStoreDesc(e.target.value)} placeholder={ar ? "وصف مختصر عن متجرك..." : "Brief description..."} style={{ resize: "vertical" }} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "رابط المتجر (Slug)" : "Store URL Slug"}</label>
                <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  <span style={{ padding: "9px 12px", background: "var(--bg)", color: "var(--text-muted)", fontSize: 12, borderInlineEnd: "1px solid var(--border)", whiteSpace: "nowrap" }}>
                    smacc.sa/store/
                  </span>
                  <input style={{ flex: 1, padding: "9px 12px", border: "none", outline: "none", fontSize: 13, fontFamily: "monospace", background: "var(--surface)" }}
                    value={storeSlug} onChange={(e) => setStoreSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="my-store" />
                </div>
                <p className="form-hint">{ar ? "أحرف إنجليزية وشرطات فقط" : "Lowercase letters and hyphens only"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* العمود الأيمن */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* إعدادات الشحن */}
          <div className="card">
            <div className="card-header">
              <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IcTruck />{ar ? "إعدادات الشحن" : "Shipping Settings"}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{ar ? "تفعيل الشحن" : "Enable Shipping"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {ar ? "السماح بشحن الطلبات للعملاء" : "Allow order shipping to customers"}
                  </div>
                </div>
                <Toggle checked={shippingEnabled} onChange={setShippingEnabled} />
              </div>
              <div className="form-group">
                <label className="form-label">{ar ? "حد الشحن المجاني (ر.س)" : "Free Shipping Threshold (SAR)"}</label>
                <input className="form-input" type="number" value={freeShippingThreshold} onChange={(e) => setFreeShippingThreshold(e.target.value)} disabled={!shippingEnabled} placeholder="200" />
                <p className="form-hint">{ar ? "الطلبات التي تتجاوز هذا المبلغ تحصل على شحن مجاني" : "Orders above this amount get free shipping"}</p>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "تكلفة الشحن الافتراضية (ر.س)" : "Default Shipping Cost (SAR)"}</label>
                <input className="form-input" type="number" value={defaultShippingCost} onChange={(e) => setDefaultShippingCost(e.target.value)} disabled={!shippingEnabled} placeholder="25" />
              </div>
            </div>
          </div>

          {/* روابط سريعة */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "روابط سريعة" : "Quick Links"}</span>
            </div>
            <div className="card-body" style={{ padding: "12px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {quickLinks.map((link) => (
                  <Link key={link.href} href={link.href}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border)", textDecoration: "none", color: "var(--text-primary)", transition: "all 0.15s" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = link.color; (e.currentTarget as HTMLElement).style.background = link.bg; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: link.bg, display: "flex", alignItems: "center", justifyContent: "center", color: link.color, flexShrink: 0 }}>
                      {link.icon}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: 13, flex: 1 }}>{ar ? link.labelAr : link.labelEn}</span>
                    <span style={{ color: "var(--text-muted)" }}><IcChevron /></span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* رابط المتجر */}
          {storeEnabled && (
            <div style={{ padding: "14px 18px", background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)", borderRadius: 12, border: "1px solid #BFDBFE", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#5A187E" }}><IcGlobe /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: "#1E40AF" }}>{ar ? "رابط المتجر" : "Store URL"}</div>
                <div style={{ fontSize: 12, color: "#3B82F6", fontFamily: "monospace", marginTop: 2 }}>smacc.sa/store/{storeSlug}</div>
              </div>
              <a href={`https://smacc.sa/store/${storeSlug}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ background: "#5A187E", color: "white" }}>
                {ar ? "فتح" : "Open"}
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
