"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ACTIVITIES_LIST, PLANS_LIST, ActivityConfig, PlanConfig } from "@/lib/activityConfig";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";
import { SpaceBackground } from "@/components/landing/SpaceBackground";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// ─── أيقونات الأنشطة ─────────────────────────────────────────────────
const s18 = { width: 28, height: 28, viewBox: "0 0 24 24", fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ActivityIcons: Record<string, JSX.Element> = {
  mobile:       <svg {...s18}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  spareParts:   <svg {...s18}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  pharmacy:     <svg {...s18}><path d="M12 22V12m0 0V2m0 10H2m10 0h10"/></svg>,
  grocery:      <svg {...s18}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  spices:       <svg {...s18}><path d="M12 2a5 5 0 0 1 5 5c0 5-5 13-5 13S7 12 7 7a5 5 0 0 1 5-5z"/><circle cx="12" cy="7" r="2"/></svg>,
  clothing:     <svg {...s18}><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>,
  construction: <svg {...s18}><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M12 6V2"/><path d="M8 6V4"/><path d="M16 6V4"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
  general:      <svg {...s18}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
};

const IcCheck = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcArrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IcStar  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcShield = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcCloud  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>;
const IcChart  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
const IcPos    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const IcBox    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>;
const IcUsers  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;

export default function LandingPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [activeActivity, setActiveActivity] = useState(0);

  // ── إعدادات المدير العام ──────────────────────────────────────────
  const [landingCfg, setLandingCfg] = useState<Record<string, any>>({});
  const [plansList, setPlansList] = useState(PLANS_LIST);
  const [activitiesList, setActivitiesList] = useState(ACTIVITIES_LIST);

  useEffect(() => {
    // جلب إعدادات صفحة الهبوط
    fetch(`${API_BASE}/admin/landing-config/public`)
      .then(r => r.json()).then(d => { if (d && Object.keys(d).length > 0) setLandingCfg(d); })
      .catch(() => {});

    // جلب الباقات (قد تكون معدّلة من المدير العام)
    fetch(`${API_BASE}/admin/plans-config/public`)
      .then(r => r.json()).then(d => {
        if (d.has_override && d.plans && Object.keys(d.plans).length > 0) {
          setPlansList(Object.values(d.plans) as any);
        }
      }).catch(() => {});

    // جلب الأنشطة (قد تكون معدّلة من المدير العام)
    fetch(`${API_BASE}/admin/activities-config/public`)
      .then(r => r.json()).then(d => {
        if (d.has_override && d.activities && Object.keys(d.activities).length > 0) {
          setActivitiesList(Object.values(d.activities) as any);
        }
      }).catch(() => {});
  }, []);

  // دوال مساعدة لجلب النص من الإعدادات أو الافتراضي
  const t = (key: string, fallback: string) => landingCfg[key] || fallback;
  const showSection = (key: string) => landingCfg[key] !== false;

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ fontFamily: "'Alexandria', sans-serif", color: "#0F172A", background: "#fff", minHeight: "100vh" }}>
      <style>{`
        .land-hero-btns { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .land-act-grid  { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .land-act-detail { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
        .land-feat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 20px; }
        .land-plans-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
        .land-mod-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        @media (max-width: 640px) {
          .land-act-grid  { grid-template-columns: repeat(4, 1fr); gap: 6px; }
          .land-act-detail { grid-template-columns: 1fr !important; gap: 20px; }
          .land-feat-grid { grid-template-columns: 1fr; }
          .land-plans-grid { grid-template-columns: 1fr; }
          .land-mod-grid  { grid-template-columns: 1fr 1fr; }
          .land-hero-btns a { width: 100%; justify-content: center; }
        }
      `}</style>

      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <LandingNav locale={locale} />

      {/* ── Hero ───────────────────────────────────────────────────── */}
      <section style={{
        position: "relative",
        padding: "64px 5% 72px",
        textAlign: "center",
        background: "linear-gradient(180deg, #ffffff 0%, #ffffff 70%, #EFF6FF 100%)",
        overflow: "hidden",
      }}>

        {/* جسيمات زرقاء خفيفة على خلفية بيضاء */}
        <SpaceBackground
          particleCount={380}
          particleColor="rgba(37,99,235,0.18)"
          backgroundColor="transparent"
        />

        {/* المحتوى */}
        <div style={{ position: "relative", zIndex: 1, maxWidth: 680, margin: "0 auto" }}>

          {/* Badge زاتكا */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EFF6FF", color: "#2563EB", padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, marginBottom: 24, border: "1px solid #BFDBFE" }}>
            <IcShield />
            {ar
              ? t("hero_badge_ar", "متوافق مع زاتكا — الفوترة الإلكترونية المرحلة الثانية")
              : t("hero_badge_en", "ZATCA Compliant — Phase 2 e-Invoicing")}
          </div>

          {/* الشعار */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
            <img
              src="/logo.png"
              alt="Masar"
              style={{
                height: 110, maxWidth: "90%",
                objectFit: "contain",
                filter: "drop-shadow(0 2px 16px rgba(37,99,235,0.18))",
              }}
            />
          </div>

          {/* الوصف */}
          <p style={{ fontSize: "clamp(14px, 2vw, 17px)", color: "#64748B", lineHeight: 1.75, maxWidth: 520, margin: "0 auto 32px" }}>
            {ar
              ? t("hero_subtitle_ar", "محاسبة، مبيعات، مشتريات، مخزون، نقطة بيع — كل شيء في مكان واحد. يتكيف مع نشاطك ويتوافق مع زاتكا.")
              : t("hero_subtitle_en", "Accounting, sales, purchases, inventory, POS — everything in one place. Adapts to your business and complies with ZATCA.")}
          </p>

          {/* الأزرار */}
          <div className="land-hero-btns">
            <Link href={`/${locale}/register`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 26px", borderRadius: 12,
              background: "#2563EB", color: "white",
              fontWeight: 800, fontSize: 15, textDecoration: "none",
              boxShadow: "0 4px 16px rgba(37,99,235,0.35)",
            }}>
              {ar ? t("hero_cta_ar", "ابدأ تجربتك المجانية 14 يوم") : t("hero_cta_en", "Start your 14-day free trial")}
              <IcArrow />
            </Link>
            <Link href={`/${locale}/login`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "13px 26px", borderRadius: 12,
              background: "white", color: "#0F172A",
              fontWeight: 700, fontSize: 15, textDecoration: "none",
              border: "1.5px solid #E2E8F0",
            }}>
              {ar ? "تسجيل الدخول" : "Sign In"}
            </Link>
          </div>

          {/* النجوم */}
          <div style={{ marginTop: 20, display: "flex", justifyContent: "center", alignItems: "center", gap: 4, color: "#F59E0B", flexWrap: "wrap" }}>
            {[1,2,3,4,5].map(i => <IcStar key={i} />)}
            <span style={{ color: "#94A3B8", fontSize: 12, marginInlineStart: 6 }}>
              {ar ? t("trust_text_ar", "موثوق من أكثر من 500 شركة سعودية") : t("trust_text_en", "Trusted by 500+ Saudi businesses")}
            </span>
          </div>
        </div>

        {/* CSS للدوران */}
        <style>{`
          @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </section>

      {/* ── الأنشطة ────────────────────────────────────────────────── */}
      {showSection("show_activities") && (
      <section style={{ padding: "48px 5%", background: "#fff" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, marginBottom: 10 }}>
              {ar ? "مصمم لنشاطك بالضبط" : "Designed for your exact business"}
            </h2>
            <p style={{ color: "#64748B", fontSize: 14 }}>
              {ar ? "اختر نشاطك — تظهر فقط الميزات التي تحتاجها" : "Choose your activity — only the features you need appear"}
            </p>
          </div>

          {/* Activity tabs */}
          <div className="land-act-grid" style={{ marginBottom: 28 }}>
            {activitiesList.map((act, i) => (
              <button key={act.key} onClick={() => setActiveActivity(i)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  padding: "12px 8px", borderRadius: 10,
                  border: `2px solid ${activeActivity === i ? act.color : "#E2E8F0"}`,
                  background: activeActivity === i ? act.bg : "white",
                  color: activeActivity === i ? act.color : "#64748B",
                  fontWeight: 600, fontSize: 11, cursor: "pointer", transition: "all 0.15s",
                  lineHeight: 1.3, textAlign: "center",
                }}>
                <span style={{ color: activeActivity === i ? act.color : "#94A3B8" }}>
                  {ActivityIcons[act.icon] || ActivityIcons.general}
                </span>
                <span>{ar ? act.label_ar.split(" ")[0] : act.label_en.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          {/* Activity detail */}
          {(() => {
            const act = activitiesList[activeActivity];
            return (
              <div className="land-act-detail">
                {/* Left: info */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 52, height: 52, borderRadius: 14, background: act.bg, display: "flex", alignItems: "center", justifyContent: "center", color: act.color, flexShrink: 0 }}>
                      {ActivityIcons[act.icon] || ActivityIcons.general}
                    </div>
                    <div>
                      <h3 style={{ fontSize: "clamp(18px, 3vw, 22px)", fontWeight: 800, lineHeight: 1.2 }}>{ar ? act.label_ar : act.label_en}</h3>
                      <p style={{ color: "#64748B", fontSize: 13, marginTop: 2 }}>{ar ? act.desc_ar : act.desc_en}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                    {[
                      act.inventoryFeatures.serial    && (ar ? "تتبع السيريال لكل وحدة" : "Per-unit serial tracking"),
                      act.inventoryFeatures.batch     && (ar ? "تتبع التشغيلة وتاريخ الانتهاء" : "Batch & expiry tracking"),
                      act.inventoryFeatures.variant   && (ar ? "متغيرات المنتج (مقاس، لون)" : "Product variants (size, color)"),
                      act.inventoryFeatures.weight    && (ar ? "البيع بالوزن" : "Sell by weight"),
                      act.allowPurchaseFromPOS        && (ar ? "شراء مباشر من نقطة البيع" : "Direct purchase from POS"),
                      act.modules.includes("pos")     && (ar ? "نقطة بيع متكاملة" : "Full POS system"),
                      ar ? "محاسبة متوافقة مع زاتكا" : "ZATCA-compliant accounting",
                    ].filter(Boolean).map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <span style={{ color: act.color, flexShrink: 0 }}><IcCheck /></span>
                        <span>{f as string}</span>
                      </div>
                    ))}
                  </div>
                  <Link href={`/${locale}/register?activity=${act.key}`}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 20, padding: "11px 20px", borderRadius: 10, background: act.color, color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                    {ar ? `ابدأ بـ ${act.label_ar}` : `Start with ${act.label_en}`}
                    <IcArrow />
                  </Link>
                </div>

                {/* Right: modules */}
                <div style={{ background: act.bg, borderRadius: 14, padding: 20, border: `1px solid ${act.color}20` }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: act.color, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 14 }}>
                    {ar ? "الوحدات المتاحة" : "Available Modules"}
                  </div>
                  <div className="land-mod-grid">
                    {[
                      { key: "accounting", ar: "المحاسبة",       en: "Accounting", icon: <IcChart /> },
                      { key: "sales",      ar: "المبيعات",       en: "Sales",      icon: <IcArrow /> },
                      { key: "purchases",  ar: "المشتريات",      en: "Purchases",  icon: <IcBox /> },
                      { key: "inventory",  ar: "المخزون",        en: "Inventory",  icon: <IcBox /> },
                      { key: "pos",        ar: "نقطة البيع",     en: "POS",        icon: <IcPos /> },
                      { key: "treasury",   ar: "الخزينة",        en: "Treasury",   icon: <IcChart /> },
                      { key: "hr",         ar: "الموارد البشرية",en: "HR",         icon: <IcUsers /> },
                    ].map(m => {
                      const enabled = act.modules.includes(m.key as any);
                      return (
                        <div key={m.key} style={{
                          display: "flex", alignItems: "center", gap: 7,
                          padding: "8px 10px", borderRadius: 8,
                          background: enabled ? "white" : "transparent",
                          opacity: enabled ? 1 : 0.3,
                          fontSize: 12, fontWeight: enabled ? 600 : 400,
                        }}>
                          <span style={{ color: enabled ? act.color : "#94A3B8", flexShrink: 0 }}>{m.icon}</span>
                          {ar ? m.ar : m.en}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>
      )}

      {/* ── الميزات ────────────────────────────────────────────────── */}
      {showSection("show_features") && (
      <section style={{ padding: "48px 5%", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, marginBottom: 10 }}>
              {ar ? t("features_title_ar", "كل ما تحتاجه في مكان واحد") : t("features_title_en", "Everything you need in one place")}
            </h2>
          </div>
          <div className="land-feat-grid">
            {[
              { icon: <IcShield />, color: "#2563EB", bg: "#EFF6FF", title: ar ? "متوافق مع زاتكا" : "ZATCA Compliant",    desc: ar ? "فوترة إلكترونية المرحلة الثانية، QR Code، UUID" : "Phase 2 e-invoicing, QR Code, UUID" },
              { icon: <IcPos />,    color: "#059669", bg: "#ECFDF5", title: ar ? "نقطة بيع متكاملة" : "Full POS System",   desc: ar ? "كاشير سريع، فاتورة حرارية، مدى وSTC Pay" : "Fast cashier, thermal receipt, Mada & STC Pay" },
              { icon: <IcBox />,    color: "#7C3AED", bg: "#F5F3FF", title: ar ? "مخزون ذكي" : "Smart Inventory",          desc: ar ? "سيريال، تشغيلة، متغيرات، وزن — حسب نشاطك" : "Serial, batch, variants, weight — per your activity" },
              { icon: <IcChart />,  color: "#D97706", bg: "#FFFBEB", title: ar ? "تقارير متقدمة" : "Advanced Reports",     desc: ar ? "ميزانية، دخل، تدفقات نقدية، ضريبة القيمة المضافة" : "Balance sheet, income, cash flow, VAT" },
              { icon: <IcCloud />,  color: "#0891B2", bg: "#ECFEFF", title: ar ? "سحابي 100%" : "100% Cloud",              desc: ar ? "وصول من أي مكان، نسخ احتياطي تلقائي" : "Access from anywhere, automatic backup" },
              { icon: <IcUsers />,  color: "#EC4899", bg: "#FDF2F8", title: ar ? "متعدد المستخدمين" : "Multi-user",        desc: ar ? "صلاحيات مرنة، فروع متعددة، مستودعات" : "Flexible permissions, multiple branches, warehouses" },
            ].map((f, i) => (
              <div key={i} style={{ background: "white", borderRadius: 14, padding: 20, border: "1px solid #E2E8F0" }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", color: f.color, marginBottom: 12 }}>
                  {f.icon}
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 5 }}>{f.title}</div>
                <div style={{ color: "#64748B", fontSize: 12, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── الأسعار ────────────────────────────────────────────────── */}
      {showSection("show_pricing") && (
      <section style={{ padding: "48px 5%", background: "#fff" }} id="pricing">
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, marginBottom: 10 }}>
              {ar ? t("pricing_title_ar", "خطط واضحة بدون مفاجآت") : t("pricing_title_en", "Clear plans, no surprises")}
            </h2>
            <p style={{ color: "#64748B", fontSize: 14, marginBottom: 20 }}>
              {ar ? t("pricing_subtitle_ar", "ابدأ مجاناً 14 يوم — لا يلزم بطاقة ائتمان") : t("pricing_subtitle_en", "Start free for 14 days — no credit card required")}
            </p>
            <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 10, padding: 4, gap: 4 }}>
              {(["monthly", "yearly"] as const).map(b => (
                <button key={b} onClick={() => setBilling(b)}
                  style={{ padding: "7px 16px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", background: billing === b ? "white" : "transparent", color: billing === b ? "#0F172A" : "#64748B", boxShadow: billing === b ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                  {b === "monthly" ? (ar ? "شهري" : "Monthly") : (ar ? "سنوي (وفر 17%)" : "Yearly (save 17%)")}
                </button>
              ))}
            </div>
          </div>

          <div className="land-plans-grid">
            {plansList.map(plan => (
              <div key={plan.key} style={{
                borderRadius: 16, padding: 24, border: `2px solid ${plan.popular ? plan.color : "#E2E8F0"}`,
                background: plan.popular ? plan.bg : "white", position: "relative",
              }}>
                {plan.popular && (
                  <div style={{ position: "absolute", top: -11, insetInlineStart: "50%", transform: "translateX(-50%)", background: plan.color, color: "white", padding: "3px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {ar ? "الأكثر شيوعاً" : "Most Popular"}
                  </div>
                )}
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4 }}>{ar ? plan.label_ar : plan.label_en}</div>
                <div style={{ marginBottom: 16 }}>
                  {plan.price_monthly === 0 ? (
                    <div style={{ fontSize: 28, fontWeight: 800, color: plan.color }}>
                      {ar ? "مجاناً" : "Free"}
                      <span style={{ fontSize: 12, fontWeight: 400, color: "#64748B", marginInlineStart: 6 }}>
                        {ar ? `${plan.limits.trial_days} يوم` : `${plan.limits.trial_days} days`}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 28, fontWeight: 800, color: plan.color }}>
                        {billing === "monthly" ? plan.price_monthly : Math.round(plan.price_yearly / 12)}
                      </span>
                      <span style={{ fontSize: 13, color: "#64748B" }}> {ar ? "ر.س / شهر" : "SAR / mo"}</span>
                      {billing === "yearly" && (
                        <div style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>
                          {ar ? `${plan.price_yearly} ر.س / سنة` : `${plan.price_yearly} SAR / year`}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 20 }}>
                  {(ar ? plan.features_ar : plan.features_en).map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                      <span style={{ color: plan.color, flexShrink: 0 }}><IcCheck /></span>
                      {f}
                    </div>
                  ))}
                </div>
                <Link href={`/${locale}/register?plan=${plan.key}`}
                  style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "10px 0", borderRadius: 10, background: plan.popular ? plan.color : "transparent", color: plan.popular ? "white" : plan.color, fontWeight: 700, fontSize: 13, textDecoration: "none", border: `1.5px solid ${plan.color}` }}>
                  {plan.key === "trial" ? (ar ? "ابدأ مجاناً" : "Start Free") : (ar ? "اشترك الآن" : "Subscribe Now")}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <LandingFooter locale={locale} />
    </div>
  );
}