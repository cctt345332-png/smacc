"use client";
import Link from "next/link";

interface PlanGateProps {
  locale: string;
  requiredPlans: string[];
  currentPlan: string;
  moduleNameAr: string;
  moduleNameEn: string;
  children: React.ReactNode;
}

const IcLock    = () => <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
const IcArrow   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

const planLabels: Record<string, { ar: string; en: string }> = {
  trial:        { ar: "تجريبية",  en: "Free Trial" },
  starter:      { ar: "أساسية",   en: "Starter" },
  professional: { ar: "احترافية", en: "Professional" },
  enterprise:   { ar: "مؤسسية",  en: "Enterprise" },
};

export default function PlanGate({ locale, requiredPlans, currentPlan, moduleNameAr, moduleNameEn, children }: PlanGateProps) {
  const ar = locale === "ar";
  const hasAccess = requiredPlans.includes(currentPlan);

  if (hasAccess) return <>{children}</>;

  const minPlan = requiredPlans[0];
  const minPlanLabel = planLabels[minPlan]?.[ar ? "ar" : "en"] ?? minPlan;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: "0 24px" }}>
      <div style={{ width: 80, height: 80, borderRadius: 20, background: "linear-gradient(135deg, #FEF9C3, #FDE68A)", display: "flex", alignItems: "center", justifyContent: "center", color: "#D97706", marginBottom: 24 }}>
        <IcLock />
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: "var(--text-primary)" }}>
        {ar ? `وحدة ${moduleNameAr} غير متاحة` : `${moduleNameEn} Module Unavailable`}
      </h1>

      <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 420, lineHeight: 1.7, marginBottom: 8 }}>
        {ar
          ? `هذه الوحدة متاحة فقط في الباقة ${minPlanLabel} وما فوقها. باقتك الحالية لا تتضمن هذه الميزة.`
          : `This module is available in the ${minPlanLabel} plan and above. Your current plan does not include this feature.`}
      </p>

      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#F1F5F9", borderRadius: 8, padding: "6px 14px", fontSize: 12, color: "var(--text-secondary)", marginBottom: 28 }}>
        <span style={{ fontWeight: 600 }}>{ar ? "باقتك الحالية:" : "Current plan:"}</span>
        <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{planLabels[currentPlan]?.[ar ? "ar" : "en"] ?? currentPlan}</span>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Link href={`/${locale}/settings/company`} className="btn btn-primary" style={{ gap: 8 }}>
          {ar ? `الترقية إلى ${minPlanLabel}` : `Upgrade to ${minPlanLabel}`}
          <IcArrow />
        </Link>
        <Link href={`/${locale}/dashboard`} className="btn btn-secondary">
          {ar ? "العودة للرئيسية" : "Back to Dashboard"}
        </Link>
      </div>
    </div>
  );
}
