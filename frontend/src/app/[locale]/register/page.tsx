"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { ACTIVITIES_LIST, PLANS_LIST, type BusinessType, type PlanKey } from "@/lib/activityConfig";

// ─── أيقونات الأنشطة ─────────────────────────────────────────────────
const s = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none" as const, stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const ActivityIcons: Record<string, JSX.Element> = {
  mobile:       <svg {...s}><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  spareParts:   <svg {...s}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  pharmacy:     <svg {...s}><path d="M12 22V12m0 0V2m0 10H2m10 0h10"/></svg>,
  grocery:      <svg {...s}><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  spices:       <svg {...s}><path d="M12 2a5 5 0 0 1 5 5c0 5-5 13-5 13S7 12 7 7a5 5 0 0 1 5-5z"/><circle cx="12" cy="7" r="2"/></svg>,
  clothing:     <svg {...s}><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>,
  construction: <svg {...s}><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M12 6V2"/><path d="M8 6V4"/><path d="M16 6V4"/><line x1="2" y1="12" x2="22" y2="12"/></svg>,
  general:      <svg {...s}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
};

const IcCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcArrow = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IcBack  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>;

// ─── خطوات التسجيل ───────────────────────────────────────────────────
type Step = "activity" | "plan" | "account";

export default function RegisterPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep]               = useState<Step>("activity");
  const [selectedActivity, setSelectedActivity] = useState<BusinessType>("general");
  const [selectedPlan, setSelectedPlan]         = useState<PlanKey>("trial");
  const [billing, setBilling]         = useState<"monthly" | "yearly">("monthly");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);

  const [form, setForm] = useState({
    company_name: "", full_name: "", email: "",
    password: "", vat_number: "", cr_number: "",
  });

  // قراءة params من URL (من صفحة الهبوط)
  useEffect(() => {
    const act  = searchParams?.get("activity") as BusinessType;
    const plan = searchParams?.get("plan") as PlanKey;
    if (act  && ACTIVITIES_LIST.find(a => a.key === act))  { setSelectedActivity(act);  setStep("plan"); }
    if (plan && PLANS_LIST.find(p => p.key === plan))      { setSelectedPlan(plan); }
  }, []);

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const actCfg  = ACTIVITIES_LIST.find(a => a.key === selectedActivity)!;
  const planCfg = PLANS_LIST.find(p => p.key === selectedPlan)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name || !form.email || !form.password || !form.full_name) {
      setError(ar ? "يرجى تعبئة جميع الحقول المطلوبة" : "Please fill all required fields");
      return;
    }
    setLoading(true); setError("");
    try {
      await api.post("/auth/register", {
        ...form,
        business_type: selectedActivity,
        plan: selectedPlan,
        vat_number: form.vat_number || null,
        cr_number:  form.cr_number  || null,
      });
      router.push(`/${locale}/login?registered=1`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "حدث خطأ، حاول مرة أخرى" : "Registration failed"));
    } finally { setLoading(false); }
  };

  // ── Step indicator ────────────────────────────────────────────────
  const steps = [
    { key: "activity", label: ar ? "النشاط" : "Activity" },
    { key: "plan",     label: ar ? "الخطة"  : "Plan" },
    { key: "account",  label: ar ? "الحساب" : "Account" },
  ];

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", flexDirection: "column", fontFamily: "'Alexandria', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ padding: "16px 24px", background: "white", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href={`/${locale}/landing`} style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
          <img src="/logo-ha.png" alt="Logo" style={{ height: 52, maxWidth: 200, objectFit: "contain" }} />
        </Link>
        <Link href={`/${locale}/login`} style={{ fontSize: 13, color: "#64748B", textDecoration: "none", fontWeight: 600 }}>
          {ar ? "لديك حساب؟ سجّل دخولك" : "Have an account? Sign in"}
        </Link>
      </div>

      {/* ── Progress ── */}
      <div style={{ padding: "20px 24px 0", maxWidth: 680, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
          {steps.map((s, i) => {
            const idx = steps.findIndex(x => x.key === step);
            const done = i < idx;
            const active = i === idx;
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: done ? "#059669" : active ? "#2563EB" : "#E2E8F0",
                    color: done || active ? "white" : "#94A3B8",
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {done ? <IcCheck /> : i + 1}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? "#0F172A" : "#94A3B8", whiteSpace: "nowrap" }}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: done ? "#059669" : "#E2E8F0", margin: "0 12px" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, padding: "24px", display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 680 }}>

          {/* ── Step 1: اختيار النشاط ── */}
          {step === "activity" && (
            <div>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
                {ar ? "ما هو نشاطك التجاري؟" : "What is your business activity?"}
              </h2>
              <p style={{ color: "#64748B", fontSize: 14, marginBottom: 28 }}>
                {ar ? "سيتكيف النظام تلقائياً مع نشاطك — تظهر فقط الميزات التي تحتاجها" : "The system adapts automatically — only the features you need will appear"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
                {ACTIVITIES_LIST.map(act => (
                  <button key={act.key} onClick={() => setSelectedActivity(act.key)}
                    style={{
                      padding: "16px", borderRadius: 12, textAlign: ar ? "right" : "left",
                      border: `2px solid ${selectedActivity === act.key ? act.color : "#E2E8F0"}`,
                      background: selectedActivity === act.key ? act.bg : "white",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    <div style={{ color: selectedActivity === act.key ? act.color : "#94A3B8", marginBottom: 10 }}>
                      {ActivityIcons[act.icon] || ActivityIcons.general}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: selectedActivity === act.key ? act.color : "#0F172A", marginBottom: 4 }}>
                      {ar ? act.label_ar : act.label_en}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.4 }}>
                      {ar ? act.desc_ar : act.desc_en}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 28, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setStep("plan")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 10, background: actCfg.color, color: "white", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
                  {ar ? "التالي" : "Next"}
                  <IcArrow />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: اختيار الخطة ── */}
          {step === "plan" && (
            <div>
              <button onClick={() => setStep("activity")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                <IcBack />{ar ? "رجوع" : "Back"}
              </button>
              <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>
                {ar ? "اختر خطة الاشتراك" : "Choose your plan"}
              </h2>
              <p style={{ color: "#64748B", fontSize: 14, marginBottom: 20 }}>
                {ar ? "ابدأ مجاناً 14 يوم — لا يلزم بطاقة ائتمان" : "Start free for 14 days — no credit card required"}
              </p>

              {/* Toggle شهري/سنوي */}
              <div style={{ display: "inline-flex", background: "#F1F5F9", borderRadius: 8, padding: 3, gap: 3, marginBottom: 20 }}>
                {(["monthly", "yearly"] as const).map(b => (
                  <button key={b} onClick={() => setBilling(b)}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "none", fontWeight: 600, fontSize: 12, cursor: "pointer", background: billing === b ? "white" : "transparent", color: billing === b ? "#0F172A" : "#64748B" }}>
                    {b === "monthly" ? (ar ? "شهري" : "Monthly") : (ar ? "سنوي (وفر 17%)" : "Yearly (save 17%)")}
                  </button>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {PLANS_LIST.map(plan => (
                  <button key={plan.key} onClick={() => setSelectedPlan(plan.key)}
                    style={{
                      padding: "18px", borderRadius: 12, textAlign: ar ? "right" : "left",
                      border: `2px solid ${selectedPlan === plan.key ? plan.color : "#E2E8F0"}`,
                      background: selectedPlan === plan.key ? plan.bg : "white",
                      cursor: "pointer", transition: "all 0.15s", position: "relative",
                    }}>
                    {plan.popular && (
                      <div style={{ position: "absolute", top: -10, insetInlineStart: 16, background: plan.color, color: "white", padding: "2px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                        {ar ? "الأكثر شيوعاً" : "Popular"}
                      </div>
                    )}
                    <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6, color: selectedPlan === plan.key ? plan.color : "#0F172A" }}>
                      {ar ? plan.label_ar : plan.label_en}
                    </div>
                    <div style={{ marginBottom: 12 }}>
                      {plan.price_monthly === 0 ? (
                        <span style={{ fontSize: 22, fontWeight: 800, color: plan.color }}>{ar ? "مجاناً" : "Free"}</span>
                      ) : (
                        <span style={{ fontSize: 22, fontWeight: 800, color: plan.color }}>
                          {billing === "monthly" ? plan.price_monthly : Math.round(plan.price_yearly / 12)}
                          <span style={{ fontSize: 12, fontWeight: 400, color: "#64748B" }}> {ar ? "ر.س/شهر" : "SAR/mo"}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {(ar ? plan.features_ar : plan.features_en).slice(0, 4).map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          <span style={{ color: plan.color, flexShrink: 0 }}><IcCheck /></span>
                          {f}
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <button onClick={() => setStep("account")}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 10, background: planCfg.color, color: "white", fontWeight: 700, fontSize: 14, border: "none", cursor: "pointer" }}>
                  {ar ? "التالي" : "Next"}
                  <IcArrow />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: بيانات الحساب ── */}
          {step === "account" && (
            <div>
              <button onClick={() => setStep("plan")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
                <IcBack />{ar ? "رجوع" : "Back"}
              </button>

              {/* ملخص الاختيارات */}
              <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: actCfg.bg, border: `1px solid ${actCfg.color}30` }}>
                  <span style={{ color: actCfg.color }}>{ActivityIcons[actCfg.icon] || ActivityIcons.general}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: actCfg.color }}>{ar ? actCfg.label_ar : actCfg.label_en}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: planCfg.bg, border: `1px solid ${planCfg.color}30` }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: planCfg.color }}>{ar ? planCfg.label_ar : planCfg.label_en}</span>
                  {planCfg.price_monthly > 0 && (
                    <span style={{ fontSize: 11, color: "#64748B" }}>
                      {billing === "monthly" ? planCfg.price_monthly : Math.round(planCfg.price_yearly / 12)} {ar ? "ر.س/شهر" : "SAR/mo"}
                    </span>
                  )}
                </div>
              </div>

              <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>
                {ar ? "بيانات الحساب" : "Account Details"}
              </h2>

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">{ar ? "اسم الشركة" : "Company Name"} <span className="required">*</span></label>
                  <input type="text" className="form-input"
                    placeholder={ar ? "شركة المثال للتجارة" : "Example Trading Co."}
                    value={form.company_name} onChange={e => upd("company_name", e.target.value)} required />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">{ar ? "الرقم الضريبي" : "VAT Number"}</label>
                    <input type="text" className="form-input" placeholder="300XXXXXXXXX1003"
                      value={form.vat_number} onChange={e => upd("vat_number", e.target.value)} maxLength={15} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "السجل التجاري" : "CR Number"}</label>
                    <input type="text" className="form-input" placeholder="1010XXXXXX"
                      value={form.cr_number} onChange={e => upd("cr_number", e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم الكامل" : "Full Name"} <span className="required">*</span></label>
                  <input type="text" className="form-input"
                    placeholder={ar ? "محمد أحمد العمري" : "John Smith"}
                    value={form.full_name} onChange={e => upd("full_name", e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">{ar ? "البريد الإلكتروني" : "Email"} <span className="required">*</span></label>
                  <input type="email" className="form-input" placeholder="admin@company.com"
                    value={form.email} onChange={e => upd("email", e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">{ar ? "كلمة المرور" : "Password"} <span className="required">*</span></label>
                  <input type="password" className="form-input" placeholder="••••••••"
                    value={form.password} onChange={e => upd("password", e.target.value)} required minLength={8} />
                  <p className="form-hint">{ar ? "8 أحرف على الأقل" : "At least 8 characters"}</p>
                </div>

                <button type="submit" disabled={loading}
                  style={{ width: "100%", padding: "13px", borderRadius: 10, background: "#2563EB", color: "white", fontWeight: 700, fontSize: 15, border: "none", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  {loading ? (ar ? "جاري إنشاء الحساب..." : "Creating account...") : (ar ? "إنشاء الحساب" : "Create Account")}
                  {!loading && <IcArrow />}
                </button>
              </form>

              <p style={{ textAlign: "center", fontSize: 12, color: "#94A3B8", marginTop: 16 }}>
                {ar ? "بالتسجيل توافق على شروط الاستخدام وسياسة الخصوصية" : "By registering you agree to our Terms of Service and Privacy Policy"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
