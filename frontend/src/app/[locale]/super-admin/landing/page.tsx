"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import adminApi from "@/lib/adminApi";

const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcSave    = () => <svg {...s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcRefresh = () => <svg {...s}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.43"/></svg>;
const IcLink    = () => <svg {...s}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>;
const IcCheck   = () => <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>;
const IcEye     = () => <svg {...s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcEyeOff  = () => <svg {...s}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcInfo    = () => <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

interface LandingConfig {
  hero_title_ar: string; hero_title_en: string;
  hero_subtitle_ar: string; hero_subtitle_en: string;
  hero_badge_ar: string; hero_badge_en: string;
  hero_cta_ar: string; hero_cta_en: string;
  trust_text_ar: string; trust_text_en: string;
  features_title_ar: string; features_title_en: string;
  pricing_title_ar: string; pricing_title_en: string;
  pricing_subtitle_ar: string; pricing_subtitle_en: string;
  show_activities: boolean; show_features: boolean; show_pricing: boolean;
}

const DEFAULTS: LandingConfig = {
  hero_title_ar: "نظام ERP سحابي مصمم لكل نشاط تجاري سعودي",
  hero_title_en: "Cloud ERP designed for every Saudi business",
  hero_subtitle_ar: "محاسبة، مبيعات، مشتريات، مخزون، نقطة بيع — كل شيء في مكان واحد.",
  hero_subtitle_en: "Accounting, sales, purchases, inventory, POS — everything in one place.",
  hero_badge_ar: "متوافق مع زاتكا — الفوترة الإلكترونية المرحلة الثانية",
  hero_badge_en: "ZATCA Compliant — Phase 2 e-Invoicing",
  hero_cta_ar: "ابدأ تجربتك المجانية 14 يوم",
  hero_cta_en: "Start your 14-day free trial",
  trust_text_ar: "موثوق من أكثر من 500 شركة سعودية",
  trust_text_en: "Trusted by 500+ Saudi businesses",
  features_title_ar: "كل ما تحتاجه في مكان واحد",
  features_title_en: "Everything you need in one place",
  pricing_title_ar: "خطط واضحة بدون مفاجآت",
  pricing_title_en: "Clear plans, no surprises",
  pricing_subtitle_ar: "ابدأ مجاناً 14 يوم — لا يلزم بطاقة ائتمان",
  pricing_subtitle_en: "Start free for 14 days — no credit card required",
  show_activities: true, show_features: true, show_pricing: true,
};

type Tab = "hero" | "sections" | "preview";

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} role="switch" aria-checked={on}
      style={{ width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
        background: on ? "var(--success)" : "var(--text-muted)", position: "relative", transition: "background 0.2s" }}>
      <div style={{ width: 20, height: 20, borderRadius: "50%", background: "white",
        position: "absolute", top: 3, left: on ? "calc(100% - 23px)" : 3,
        transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
    </button>
  );
}

export default function LandingConfigPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";
  const [config, setConfig] = useState<LandingConfig>({ ...DEFAULTS });
  const [tab, setTab] = useState<Tab>("hero");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.get("/admin/landing-config").then(r => {
      if (r.data && Object.keys(r.data).length > 0) setConfig(c => ({ ...c, ...r.data }));
    }).catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await adminApi.put("/admin/landing-config", config);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  function reset() {
    if (!confirm(ar ? "إعادة تعيين كل الإعدادات؟" : "Reset all settings to defaults?")) return;
    setConfig({ ...DEFAULTS });
  }

  const set = (k: keyof LandingConfig, v: string) => setConfig(c => ({ ...c, [k]: v }));
  const tog = (k: keyof LandingConfig) => setConfig(c => ({ ...c, [k]: !c[k] }));

  const inp = (labelAr: string, labelEn: string, k: keyof LandingConfig, multi = false) => (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{ar ? labelAr : labelEn}</label>
      {multi
        ? <textarea className="form-input" rows={3} value={config[k] as string}
            onChange={e => set(k, e.target.value)} style={{ resize: "vertical" }} />
        : <input className="form-input" type="text" value={config[k] as string}
            onChange={e => set(k, e.target.value)} />}
    </div>
  );

  const TABS: { key: Tab; ar: string; en: string }[] = [
    { key: "hero",     ar: "قسم الهيرو", en: "Hero Section" },
    { key: "sections", ar: "الأقسام",    en: "Sections" },
    { key: "preview",  ar: "معاينة",     en: "Preview" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "التحكم في صفحة الهبوط" : "Landing Page Control"}</h1>
          <p className="page-subtitle">{ar ? "تعديل النصوص والأقسام — يؤثر فوراً على الموقع" : "Edit texts and sections — affects the site instantly"}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {saved && <span style={{ color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IcCheck />{ar ? "تم الحفظ" : "Saved"}</span>}
          <button className="btn btn-secondary" onClick={reset}><IcRefresh />{ar ? "إعادة تعيين" : "Reset"}</button>
          <a className="btn btn-secondary" href={`/${locale}/landing`} target="_blank" rel="noopener noreferrer"><IcLink />{ar ? "فتح الصفحة" : "Open Page"}</a>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}><IcSave />{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التغييرات" : "Save Changes")}</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "inline-flex", gap: 4, background: "var(--bg)", borderRadius: 12, padding: 4, border: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            style={{ padding: "7px 18px", borderRadius: 9, border: "none", cursor: "pointer",
              background: tab === t.key ? "var(--surface)" : "transparent",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: tab === t.key ? 700 : 500, fontSize: 13,
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {ar ? t.ar : t.en}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-body" style={{ padding: 28 }}>

          {/* ── Hero ── */}
          {tab === "hero" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div className="card-title" style={{ marginBottom: 12 }}>{ar ? "الشارة العلوية" : "Top Badge"}</div>
                <div className="grid-2" style={{ gap: 12 }}>
                  {inp("نص الشارة (عربي)", "Badge Text (Arabic)", "hero_badge_ar")}
                  {inp("نص الشارة (إنجليزي)", "Badge Text (English)", "hero_badge_en")}
                </div>
              </div>
              <div className="divider" />
              <div className="card-title">{ar ? "العنوان الرئيسي" : "Main Title"}</div>
              <div className="grid-2" style={{ gap: 12 }}>
                {inp("العنوان (عربي)", "Title (Arabic)", "hero_title_ar", true)}
                {inp("العنوان (إنجليزي)", "Title (English)", "hero_title_en", true)}
              </div>
              <div className="divider" />
              <div className="card-title">{ar ? "النص التوضيحي" : "Subtitle"}</div>
              <div className="grid-2" style={{ gap: 12 }}>
                {inp("النص (عربي)", "Subtitle (Arabic)", "hero_subtitle_ar", true)}
                {inp("النص (إنجليزي)", "Subtitle (English)", "hero_subtitle_en", true)}
              </div>
              <div className="divider" />
              <div className="card-title">{ar ? "زر التسجيل" : "CTA Button"}</div>
              <div className="grid-2" style={{ gap: 12 }}>
                {inp("نص الزر (عربي)", "Button Text (Arabic)", "hero_cta_ar")}
                {inp("نص الزر (إنجليزي)", "Button Text (English)", "hero_cta_en")}
              </div>
              <div className="divider" />
              <div className="card-title">{ar ? "نص الثقة" : "Trust Text"}</div>
              <div className="grid-2" style={{ gap: 12 }}>
                {inp("نص الثقة (عربي)", "Trust Text (Arabic)", "trust_text_ar")}
                {inp("نص الثقة (إنجليزي)", "Trust Text (English)", "trust_text_en")}
              </div>
              <div className="divider" />
              <div className="card-title">{ar ? "عناوين الأقسام" : "Section Titles"}</div>
              <div className="grid-2" style={{ gap: 12 }}>
                {inp("عنوان الميزات (عربي)", "Features Title (Arabic)", "features_title_ar")}
                {inp("عنوان الميزات (إنجليزي)", "Features Title (English)", "features_title_en")}
                {inp("عنوان الأسعار (عربي)", "Pricing Title (Arabic)", "pricing_title_ar")}
                {inp("عنوان الأسعار (إنجليزي)", "Pricing Title (English)", "pricing_title_en")}
                {inp("نص الأسعار (عربي)", "Pricing Subtitle (Arabic)", "pricing_subtitle_ar")}
                {inp("نص الأسعار (إنجليزي)", "Pricing Subtitle (English)", "pricing_subtitle_en")}
              </div>
            </div>
          )}

          {/* ── Sections ── */}
          {tab === "sections" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {ar ? "تحكم في إظهار وإخفاء أقسام صفحة الهبوط" : "Control visibility of landing page sections"}
              </p>
              {([
                { k: "show_activities" as keyof LandingConfig, ar: "قسم الأنشطة التجارية", en: "Business Activities Section", dAr: "يعرض الأنشطة الـ 8 مع الوحدات المتاحة", dEn: "Shows 8 business types with available modules" },
                { k: "show_features"   as keyof LandingConfig, ar: "قسم الميزات",           en: "Features Section",           dAr: "يعرض الميزات الرئيسية للنظام",           dEn: "Shows main system features" },
                { k: "show_pricing"    as keyof LandingConfig, ar: "قسم الأسعار والباقات", en: "Pricing & Plans Section",     dAr: "يعرض الباقات والأسعار مع زر التسجيل",   dEn: "Shows plans and prices" },
              ] as const).map(sec => {
                const on = config[sec.k] as boolean;
                return (
                  <div key={sec.k} className="card"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", gap: 16,
                      background: on ? "#F0FDF4" : "var(--surface)", borderColor: on ? "#BBF7D0" : "var(--border)" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{ar ? sec.ar : sec.en}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>{ar ? sec.dAr : sec.dEn}</div>
                    </div>
                    <Toggle on={on} onToggle={() => tog(sec.k)} />
                  </div>
                );
              })}
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "#92400E", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ flexShrink: 0, marginTop: 1 }}><IcInfo /></span>
                <span>{ar ? "التغييرات تؤثر على صفحة الهبوط فور الحفظ." : "Changes affect the landing page immediately after saving."}</span>
              </div>
            </div>
          )}

          {/* ── Preview ── */}
          {tab === "preview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Mini Hero */}
              <div style={{ background: "linear-gradient(180deg, var(--bg) 0%, var(--surface) 100%)", borderRadius: 14, padding: "32px 24px", textAlign: "center", border: "1px solid var(--border)" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", color: "var(--primary)", padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, marginBottom: 16, border: "1px solid #BFDBFE" }}>
                  {ar ? config.hero_badge_ar : config.hero_badge_en}
                </div>
                <h2 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, marginBottom: 12, color: "var(--text-primary)" }}>
                  {ar ? config.hero_title_ar : config.hero_title_en}
                </h2>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 20, maxWidth: 480, margin: "0 auto 20px" }}>
                  {ar ? config.hero_subtitle_ar : config.hero_subtitle_en}
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <span className="btn btn-primary">{ar ? config.hero_cta_ar : config.hero_cta_en}</span>
                  <span className="btn btn-secondary">{ar ? "تسجيل الدخول" : "Sign In"}</span>
                </div>
                <div style={{ marginTop: 14, fontSize: 12, color: "var(--warning)", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  {[1,2,3,4,5].map(i => <svg key={i} width={11} height={11} viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
                  <span style={{ color: "var(--text-secondary)", marginInlineStart: 4 }}>{ar ? config.trust_text_ar : config.trust_text_en}</span>
                </div>
              </div>

              {/* Section Status */}
              <div className="grid-3">
                {([
                  { k: "show_activities", ar: "قسم الأنشطة", en: "Activities" },
                  { k: "show_features",   ar: "قسم الميزات", en: "Features" },
                  { k: "show_pricing",    ar: "قسم الأسعار", en: "Pricing" },
                ] as const).map(sec => {
                  const on = (config as any)[sec.k] as boolean;
                  return (
                    <div key={sec.k} className="stat-card"
                      style={{ flexDirection: "column", alignItems: "center", textAlign: "center", gap: 8, padding: 16,
                        background: on ? "#F0FDF4" : "#FEF2F2", borderColor: on ? "#BBF7D0" : "#FECACA" }}>
                      <div className="stat-icon" style={{ background: on ? "#DCFCE7" : "#FEE2E2", color: on ? "var(--success)" : "var(--danger)", width: 36, height: 36, borderRadius: 8 }}>
                        {on ? <IcEye /> : <IcEyeOff />}
                      </div>
                      <div className="stat-label">{ar ? sec.ar : sec.en}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: on ? "var(--success)" : "var(--danger)" }}>
                        {on ? (ar ? "ظاهر" : "Visible") : (ar ? "مخفي" : "Hidden")}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ textAlign: "center" }}>
                <a className="btn btn-primary" href={`/${locale}/landing`} target="_blank" rel="noopener noreferrer">
                  <IcLink />{ar ? "فتح صفحة الهبوط في تبويب جديد" : "Open Landing Page in New Tab"}
                </a>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
