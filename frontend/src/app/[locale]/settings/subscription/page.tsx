"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import { PLANS, PLANS_LIST, type PlanKey } from "@/lib/activityConfig";
import api from "@/lib/api";

// ─── أيقونات ─────────────────────────────────────────────────────────
const IcCheck    = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcX        = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcUsers    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcWarehouse= () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
const IcBuilding = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/><path d="M3 15h6"/><path d="M15 9h3"/><path d="M15 15h3"/></svg>;
const IcPos      = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>;
const IcFile     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IcCalendar = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcStar     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
const IcArrow    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IcInfo     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
const IcShield   = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;

// ─── مكون شريط التقدم ─────────────────────────────────────────────────
function UsageBar({ used, max, color, label, ar }: {
  used: number; max: number | null; color: string; label: string; ar: boolean;
}) {
  const unlimited = max === null;
  const pct = unlimited ? 0 : Math.min((used / max) * 100, 100);
  const nearLimit = !unlimited && pct >= 80;
  const atLimit   = !unlimited && pct >= 100;

  const barColor = atLimit ? "#DC2626" : nearLimit ? "#D97706" : color;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: atLimit ? "#DC2626" : nearLimit ? "#D97706" : "var(--text-secondary)" }}>
          {unlimited
            ? (ar ? "غير محدود" : "Unlimited")
            : `${used} / ${max}`}
        </span>
      </div>
      {!unlimited && (
        <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 4, transition: "width 0.5s ease" }} />
        </div>
      )}
      {unlimited && (
        <div style={{ height: 8, background: `${color}20`, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ height: "100%", width: "100%", background: `linear-gradient(90deg, ${color}40, ${color}20, ${color}40)`, borderRadius: 4 }} />
        </div>
      )}
      {atLimit && (
        <p style={{ fontSize: 11, color: "#DC2626", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <IcInfo /> {ar ? "وصلت للحد الأقصى" : "Limit reached"}
        </p>
      )}
      {nearLimit && !atLimit && (
        <p style={{ fontSize: 11, color: "#D97706", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
          <IcInfo /> {ar ? "اقتربت من الحد الأقصى" : "Approaching limit"}
        </p>
      )}
    </div>
  );
}

// ─── مكون بطاقة الباقة ────────────────────────────────────────────────
function PlanCard({ plan, currentPlan, ar, locale }: {
  plan: typeof PLANS_LIST[0]; currentPlan: PlanKey; ar: boolean; locale: string;
}) {
  const isCurrent = plan.key === currentPlan;
  const isUpgrade = PLANS_LIST.findIndex(p => p.key === plan.key) > PLANS_LIST.findIndex(p => p.key === currentPlan);

  return (
    <div style={{
      borderRadius: 14,
      border: `2px solid ${isCurrent ? plan.color : "#E2E8F0"}`,
      background: isCurrent ? plan.bg : "white",
      padding: 20,
      position: "relative",
      transition: "all 0.2s",
    }}>
      {plan.popular && !isCurrent && (
        <div style={{ position: "absolute", top: -11, insetInlineStart: "50%", transform: "translateX(-50%)", background: plan.color, color: "white", padding: "2px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
          {ar ? "الأكثر شيوعاً" : "Most Popular"}
        </div>
      )}
      {isCurrent && (
        <div style={{ position: "absolute", top: -11, insetInlineStart: "50%", transform: "translateX(-50%)", background: plan.color, color: "white", padding: "2px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
          <IcShield /> {ar ? "باقتك الحالية" : "Current Plan"}
        </div>
      )}

      <div style={{ fontWeight: 800, fontSize: 16, color: isCurrent ? plan.color : "#0F172A", marginBottom: 4 }}>
        {ar ? plan.label_ar : plan.label_en}
      </div>

      <div style={{ marginBottom: 14 }}>
        {plan.price_monthly === 0 ? (
          <span style={{ fontSize: 26, fontWeight: 800, color: plan.color }}>{ar ? "مجاناً" : "Free"}</span>
        ) : (
          <>
            <span style={{ fontSize: 26, fontWeight: 800, color: plan.color }}>{plan.price_monthly}</span>
            <span style={{ fontSize: 12, color: "#64748B" }}> {ar ? "ر.س/شهر" : "SAR/mo"}</span>
          </>
        )}
      </div>

      {/* الحدود */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
        {[
          { icon: <IcFile />,      label: ar ? "فاتورة/شهر" : "inv/mo",  val: plan.limits.invoices_per_month },
          { icon: <IcUsers />,     label: ar ? "مستخدم" : "users",        val: plan.limits.users },
          { icon: <IcWarehouse />, label: ar ? "مستودع" : "warehouses",   val: plan.limits.warehouses },
          { icon: <IcPos />,       label: ar ? "نقطة بيع" : "POS",        val: plan.limits.pos_terminals },
        ].map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
            <span style={{ color: plan.color }}>{item.icon}</span>
            <span style={{ fontWeight: 700 }}>{item.val === null ? (ar ? "∞" : "∞") : item.val}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {isCurrent ? (
        <div style={{ padding: "8px 0", textAlign: "center", fontSize: 13, fontWeight: 700, color: plan.color }}>
          {ar ? "باقتك الحالية" : "Your Current Plan"}
        </div>
      ) : isUpgrade ? (
        <Link href={`/${locale}/landing/pricing`}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10, background: plan.color, color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
          {ar ? "ترقية" : "Upgrade"} <IcArrow />
        </Link>
      ) : (
        <div style={{ padding: "8px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
          {ar ? "باقة أدنى" : "Lower plan"}
        </div>
      )}
    </div>
  );
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────
export default function SubscriptionPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const { plan: storePlan } = useAuthStore();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState<any>(null);

  useEffect(() => {
    // جلب بيانات الاشتراك الحقيقية من الـ API
    api.get("/settings/subscription")
      .then(({ data }) => {
        setSubData(data);
        setCompany({ plan: data.plan, plan_expires_at: data.plan_expires_at });
        setLoading(false);
      })
      .catch(() => {
        // fallback للبيانات من الـ store
        setCompany({ plan: storePlan });
        setLoading(false);
      });
  }, []);

  // بيانات الاستخدام — من الـ API أو وهمية كـ fallback
  const usage = subData?.usage ? {
    users:               subData.usage.users?.current        ?? 0,
    warehouses:          subData.usage.warehouses?.current   ?? 0,
    branches:            subData.usage.branches?.current     ?? 0,
    pos_terminals:       subData.usage.pos_terminals?.current ?? 0,
    invoices_this_month: subData.usage.invoices_per_month?.current ?? 0,
  } : {
    users: 1, warehouses: 1, branches: 1, pos_terminals: 1, invoices_this_month: 0,
  };

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  const currentPlan = (company?.plan || storePlan || "trial") as PlanKey;
  const planCfg = PLANS[currentPlan] || PLANS.trial;
  const expiresAt = company?.plan_expires_at ? new Date(company.plan_expires_at) : null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const isTrial = currentPlan === "trial";

  const moduleLabels: Record<string, { ar: string; en: string }> = {
    dashboard:   { ar: "لوحة التحكم",      en: "Dashboard" },
    accounting:  { ar: "المحاسبة",          en: "Accounting" },
    sales:       { ar: "المبيعات",          en: "Sales" },
    purchases:   { ar: "المشتريات",         en: "Purchases" },
    inventory:   { ar: "المخزون",           en: "Inventory" },
    pos:         { ar: "نقطة البيع",        en: "POS" },
    treasury:    { ar: "الخزينة",           en: "Treasury" },
    hr:          { ar: "الموارد البشرية",   en: "HR" },
    assets:      { ar: "الأصول الثابتة",   en: "Fixed Assets" },
    reports:     { ar: "التقارير",          en: "Reports" },
  };

  const allModules = ["dashboard","accounting","sales","purchases","inventory","pos","treasury","hr","assets","reports"];

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "اشتراكي" : "My Subscription"}</span>
          </div>
          <h1 className="page-title">{ar ? "اشتراكي" : "My Subscription"}</h1>
          <p className="page-subtitle">{ar ? "تفاصيل باقتك الحالية واستخدامك" : "Your current plan details and usage"}</p>
        </div>
        <Link href={`/${locale}/landing/pricing`} className="btn btn-primary" style={{ gap: 8 }}>
          {ar ? "ترقية الباقة" : "Upgrade Plan"} <IcArrow />
        </Link>
      </div>

      {/* تنبيه انتهاء الصلاحية */}
      {isExpired && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#DC2626", flexShrink: 0 }}><IcInfo /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#991B1B" }}>{ar ? "انتهت صلاحية اشتراكك" : "Your subscription has expired"}</div>
            <div style={{ fontSize: 13, color: "#B91C1C" }}>{ar ? "جدد اشتراكك للاستمرار في استخدام النظام" : "Renew your subscription to continue using the system"}</div>
          </div>
          <Link href={`/${locale}/landing/pricing`} className="btn btn-sm" style={{ background: "#DC2626", color: "white", marginInlineStart: "auto" }}>
            {ar ? "تجديد الآن" : "Renew Now"}
          </Link>
        </div>
      )}

      {/* تنبيه اقتراب الانتهاء */}
      {!isExpired && daysLeft !== null && daysLeft <= 7 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 12, padding: "16px 20px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "#D97706", flexShrink: 0 }}><IcCalendar /></span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#92400E" }}>
              {ar ? `ينتهي اشتراكك خلال ${daysLeft} ${daysLeft === 1 ? "يوم" : "أيام"}` : `Your subscription expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
            </div>
            <div style={{ fontSize: 13, color: "#B45309" }}>{ar ? "جدد اشتراكك قبل الانتهاء لتجنب انقطاع الخدمة" : "Renew before expiry to avoid service interruption"}</div>
          </div>
          <Link href={`/${locale}/landing/pricing`} className="btn btn-sm" style={{ background: "#D97706", color: "white", marginInlineStart: "auto" }}>
            {ar ? "تجديد" : "Renew"}
          </Link>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* العمود الأيسر */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* بطاقة الباقة الحالية */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "باقتك الحالية" : "Current Plan"}</span>
              {expiresAt && (
                <span style={{ fontSize: 12, color: isExpired ? "#DC2626" : daysLeft !== null && daysLeft <= 7 ? "#D97706" : "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                  <IcCalendar />
                  {isExpired
                    ? (ar ? "منتهية" : "Expired")
                    : ar ? `تنتهي ${expiresAt.toLocaleDateString("ar-SA")}` : `Expires ${expiresAt.toLocaleDateString("en-US")}`}
                </span>
              )}
            </div>
            <div className="card-body">
              <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: planCfg.bg, borderRadius: 12, border: `1px solid ${planCfg.color}30`, marginBottom: 20 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: planCfg.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                  <IcStar />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: planCfg.color }}>{ar ? planCfg.label_ar : planCfg.label_en}</div>
                  <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
                    {planCfg.price_monthly === 0
                      ? (ar ? "مجانية" : "Free")
                      : `${planCfg.price_monthly} ${ar ? "ر.س / شهر" : "SAR / month"}`}
                  </div>
                </div>
                {isTrial && daysLeft !== null && (
                  <div style={{ textAlign: "center", padding: "8px 16px", background: "white", borderRadius: 10, border: `1px solid ${planCfg.color}40` }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: planCfg.color, lineHeight: 1 }}>{daysLeft}</div>
                    <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>{ar ? "يوم متبقي" : "days left"}</div>
                  </div>
                )}
              </div>

              {/* الاستخدام */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {ar ? "الاستخدام الحالي" : "Current Usage"}
                </div>
                <UsageBar used={usage.invoices_this_month} max={planCfg.limits.invoices_per_month} color={planCfg.color} label={ar ? "الفواتير هذا الشهر" : "Invoices this month"} ar={ar} />
                <UsageBar used={usage.users}         max={planCfg.limits.users}         color={planCfg.color} label={ar ? "المستخدمون" : "Users"}         ar={ar} />
                <UsageBar used={usage.warehouses}    max={planCfg.limits.warehouses}    color={planCfg.color} label={ar ? "المستودعات" : "Warehouses"}    ar={ar} />
                <UsageBar used={usage.branches}      max={planCfg.limits.branches}      color={planCfg.color} label={ar ? "الفروع" : "Branches"}          ar={ar} />
                <UsageBar used={usage.pos_terminals} max={planCfg.limits.pos_terminals} color={planCfg.color} label={ar ? "نقاط البيع" : "POS Terminals"}  ar={ar} />
              </div>
            </div>
          </div>

          {/* الوحدات المتاحة */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "الوحدات المتاحة في باقتك" : "Modules in Your Plan"}</span>
            </div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {allModules.map((mod) => {
                  const enabled = planCfg.modules.includes(mod as any);
                  const label = moduleLabels[mod];
                  return (
                    <div key={mod} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: enabled ? `${planCfg.color}08` : "#F8FAFC", border: `1px solid ${enabled ? planCfg.color + "30" : "var(--border)"}` }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, background: enabled ? planCfg.color : "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0 }}>
                        {enabled ? <IcCheck /> : <IcX />}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: enabled ? 600 : 400, color: enabled ? "var(--text-primary)" : "var(--text-muted)" }}>
                        {ar ? label.ar : label.en}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* العمود الأيمن — مقارنة الباقات */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {ar ? "مقارنة الباقات" : "Compare Plans"}
          </div>
          {PLANS_LIST.map((plan) => (
            <PlanCard key={plan.key} plan={plan} currentPlan={currentPlan} ar={ar} locale={locale} />
          ))}

          {/* تواصل مع الدعم */}
          <div style={{ padding: "16px", background: "#F8FAFC", borderRadius: 12, border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{ar ? "تحتاج مساعدة؟" : "Need help?"}</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>
              {ar ? "تواصل مع فريق الدعم لمعرفة الباقة المناسبة لنشاطك" : "Contact support to find the right plan for your business"}
            </p>
            <Link href={`/${locale}/landing/contact`} className="btn btn-secondary btn-sm" style={{ width: "100%" }}>
              {ar ? "تواصل معنا" : "Contact Us"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
