"use client";
import Link from "next/link";

interface Feature {
  icon: React.ReactNode;
  ar: string;
  en: string;
}

interface ComingSoonProps {
  locale: string;
  titleAr: string;
  titleEn: string;
  descAr: string;
  descEn: string;
  iconColor: string;
  iconBg: string;
  icon: React.ReactNode;
  features: Feature[];
  backHref?: string;
}

export default function ComingSoon({
  locale, titleAr, titleEn, descAr, descEn,
  iconColor, iconBg, icon, features, backHref,
}: ComingSoonProps) {
  const ar = locale === "ar";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "70vh", gap: 24, textAlign: "center", padding: "0 24px" }}>
      {/* Icon */}
      <div style={{ width: 72, height: 72, borderRadius: 18, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", color: iconColor }}>
        {icon}
      </div>

      {/* Title + Description */}
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>
          {ar ? titleAr : titleEn}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 480, lineHeight: 1.7, margin: "0 auto" }}>
          {ar ? descAr : descEn}
        </p>
      </div>

      {/* Badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: "#FEF9C3", border: "1px solid #FDE68A",
        borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#92400E", fontWeight: 600,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        {ar ? "قيد التطوير — قريباً" : "Under Development — Coming Soon"}
      </div>

      {/* Features Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, maxWidth: 520, width: "100%" }}>
        {features.map((f, i) => (
          <div key={i} style={{
            background: "#F8FAFC", borderRadius: 10, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 10, textAlign: "start",
            border: "1px solid var(--border)",
          }}>
            <div style={{ color: iconColor, flexShrink: 0 }}>{f.icon}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
              {ar ? f.ar : f.en}
            </span>
          </div>
        ))}
      </div>

      {/* Back Button */}
      <Link href={backHref || `/${locale}/dashboard`} className="btn btn-secondary btn-sm">
        {ar ? "العودة للرئيسية" : "Back to Dashboard"}
      </Link>
    </div>
  );
}
