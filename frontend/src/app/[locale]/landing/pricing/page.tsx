"use client";
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PLANS_LIST } from "@/lib/activityConfig";
import LandingNav from "@/components/landing/LandingNav";
import LandingFooter from "@/components/landing/LandingFooter";

const IcCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcX     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function PricingPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";
  const [billing, setBilling] = useState<"monthly"|"yearly">("monthly");

  const compare = [
    { feature: ar ? "فواتير شهرياً"       : "Invoices/month",      trial: "50",          starter: "300",         pro: "2,000",         ent: ar ? "غير محدود" : "Unlimited" },
    { feature: ar ? "مستخدمون"            : "Users",               trial: "2",           starter: "3",           pro: "10",            ent: ar ? "غير محدود" : "Unlimited" },
    { feature: ar ? "مستودعات"            : "Warehouses",          trial: "1",           starter: "1",           pro: "3",             ent: ar ? "غير محدود" : "Unlimited" },
    { feature: ar ? "فروع"                : "Branches",            trial: "1",           starter: "1",           pro: "3",             ent: ar ? "غير محدود" : "Unlimited" },
    { feature: ar ? "نقاط بيع"            : "POS Terminals",       trial: "1",           starter: "1",           pro: "3",             ent: ar ? "غير محدود" : "Unlimited" },
    { feature: ar ? "محاسبة وزاتكا"       : "Accounting & ZATCA",  trial: true,          starter: true,          pro: true,            ent: true },
    { feature: ar ? "مبيعات ومشتريات"     : "Sales & Purchases",   trial: true,          starter: true,          pro: true,            ent: true },
    { feature: ar ? "مخزون"               : "Inventory",           trial: true,          starter: true,          pro: true,            ent: true },
    { feature: ar ? "نقطة البيع"          : "POS",                 trial: true,          starter: true,          pro: true,            ent: true },
    { feature: ar ? "موارد بشرية"         : "HR Module",           trial: false,         starter: false,         pro: true,            ent: true },
    { feature: ar ? "أصول ثابتة"          : "Fixed Assets",        trial: false,         starter: false,         pro: true,            ent: true },
    { feature: ar ? "متجر إلكتروني"       : "Online Store",        trial: false,         starter: false,         pro: true,            ent: true },
    { feature: ar ? "تقارير متقدمة"       : "Advanced Reports",    trial: false,         starter: ar ? "أساسية" : "Basic", pro: true, ent: true },
    { feature: ar ? "API مخصص"            : "Custom API",          trial: false,         starter: false,         pro: false,           ent: true },
    { feature: ar ? "دعم فني"             : "Support",             trial: ar ? "مجتمع" : "Community", starter: ar ? "بريد" : "Email", pro: ar ? "أولوية" : "Priority", ent: ar ? "مخصص 24/7" : "Dedicated 24/7" },
  ];

  const renderCell = (val: any) => {
    if (val === true)  return <span style={{ color: "#6F4A84" }}><IcCheck /></span>;
    if (val === false) return <span style={{ color: "#CBD5E1" }}><IcX /></span>;
    return <span style={{ fontSize: 12, fontWeight: 600 }}>{val}</span>;
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ fontFamily: "'Alexandria', sans-serif", color: "#0F172A", background: "#fff", minHeight: "100vh" }}>
      <LandingNav locale={locale} />

      {/* Hero */}
      <section style={{ padding: "48px 5% 32px", textAlign: "center", background: "#F8FAFC" }}>
        <h1 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, marginBottom: 12 }}>
          {ar ? "خطط واضحة بدون مفاجآت" : "Clear plans, no surprises"}
        </h1>
        <p style={{ color: "#64748B", fontSize: 15, marginBottom: 24 }}>
          {ar ? "ابدأ مجاناً 14 يوم — لا يلزم بطاقة ائتمان" : "Start free for 14 days — no credit card required"}
        </p>
        <div style={{ display: "inline-flex", background: "#E2E8F0", borderRadius: 10, padding: 4, gap: 4 }}>
          {(["monthly","yearly"] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)}
              style={{ padding: "7px 18px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", background: billing === b ? "white" : "transparent", color: billing === b ? "#0F172A" : "#64748B" }}>
              {b === "monthly" ? (ar ? "شهري" : "Monthly") : (ar ? "سنوي — وفر 17%" : "Yearly — save 17%")}
            </button>
          ))}
        </div>
      </section>

      {/* Plans cards */}
      <section style={{ padding: "32px 5%", background: "#fff" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
          {PLANS_LIST.map(plan => (
            <div key={plan.key} style={{ borderRadius: 16, padding: 24, border: `2px solid ${plan.popular ? plan.color : "#E2E8F0"}`, background: plan.popular ? plan.bg : "white", position: "relative" }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: -11, insetInlineStart: "50%", transform: "translateX(-50%)", background: plan.color, color: "white", padding: "3px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {ar ? "الأكثر شيوعاً" : "Most Popular"}
                </div>
              )}
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, color: plan.popular ? plan.color : "#0F172A" }}>{ar ? plan.label_ar : plan.label_en}</div>
              <div style={{ marginBottom: 16 }}>
                {plan.price_monthly === 0 ? (
                  <span style={{ fontSize: 28, fontWeight: 800, color: plan.color }}>{ar ? "مجاناً" : "Free"}</span>
                ) : (
                  <>
                    <span style={{ fontSize: 28, fontWeight: 800, color: plan.color }}>
                      {billing === "monthly" ? plan.price_monthly : Math.round(plan.price_yearly / 12)}
                    </span>
                    <span style={{ fontSize: 12, color: "#64748B" }}> {ar ? "ر.س/شهر" : "SAR/mo"}</span>
                  </>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                {(ar ? plan.features_ar : plan.features_en).map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                    <span style={{ color: plan.color, flexShrink: 0 }}><IcCheck /></span>{f}
                  </div>
                ))}
              </div>
              <Link href={`/${locale}/register?plan=${plan.key}`}
                style={{ display: "flex", justifyContent: "center", padding: "10px 0", borderRadius: 10, background: plan.popular ? plan.color : "transparent", color: plan.popular ? "white" : plan.color, fontWeight: 700, fontSize: 13, textDecoration: "none", border: `1.5px solid ${plan.color}` }}>
                {plan.key === "trial" ? (ar ? "ابدأ مجاناً" : "Start Free") : (ar ? "اشترك الآن" : "Subscribe")}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section style={{ padding: "32px 5% 48px", background: "#F8FAFC" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24, textAlign: "center" }}>
            {ar ? "مقارنة تفصيلية" : "Detailed Comparison"}
          </h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E2E8F0" }}>
                  <th style={{ padding: "10px 12px", textAlign: ar ? "right" : "left", fontWeight: 700, color: "#64748B", width: "30%" }}>{ar ? "الميزة" : "Feature"}</th>
                  {PLANS_LIST.map(p => (
                    <th key={p.key} style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, color: p.popular ? p.color : "#0F172A" }}>
                      {ar ? p.label_ar : p.label_en}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compare.map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "white" : "#F8FAFC" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{row.feature}</td>
                    {[row.trial, row.starter, row.pro, row.ent].map((val, j) => (
                      <td key={j} style={{ padding: "10px 12px", textAlign: "center" }}>{renderCell(val)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <LandingFooter locale={locale} />
    </div>
  );
}
