"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { getAISettings, updateAISettings, validateAPIKey, getAIModels } from "@/lib/ai";

const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcSave    = () => <svg {...s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcCheck   = () => <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>;
const IcEye     = () => <svg {...s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcEyeOff  = () => <svg {...s}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcRefresh = () => <svg {...s}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.43"/></svg>;
const IcInfo    = () => <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

function AILogo({ size = 32 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 200 200" width={size} height={size}>
      <g clipPath="url(#s_clip)">
        <mask id="s_mask" style={{ maskType: "alpha" as const }} width="200" height="200" x="0" y="0" maskUnits="userSpaceOnUse">
          <path fill="#fff" fillRule="evenodd" d="M100 150c27.614 0 50-22.386 50-50s-22.386-50-50-50-50 22.386-50 50 22.386 50 50 50zm0 50c55.228 0 100-44.772 100-100S155.228 0 100 0 0 44.772 0 100s44.772 100 100 100z" clipRule="evenodd"/>
        </mask>
        <g mask="url(#s_mask)">
          <path fill="#fff" d="M200 0H0v200h200V0z"/>
          <path fill="#2563EB" fillOpacity="0.33" d="M200 0H0v200h200V0z"/>
          <g filter="url(#s_blur)" style={{ animation: "ai-spin 8s linear infinite", transformOrigin: "center", transformBox: "fill-box" as const }}>
            <path fill="#2563EB" d="M110 32H18v68h92V32z"/>
            <path fill="#1D4ED8" d="M188-24H15v98h173v-98z"/>
            <path fill="#3B82F6" d="M175 70H5v156h170V70z"/>
            <path fill="#60A5FA" d="M230 51H100v103h130V51z"/>
          </g>
        </g>
      </g>
      <defs>
        <filter id="s_blur" width="385" height="410" x="-75" y="-104" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur result="effect1" stdDeviation="40"/>
        </filter>
        <clipPath id="s_clip"><path fill="#fff" d="M0 0H200V200H0z"/></clipPath>
      </defs>
    </svg>
  );
}

export default function AISettingsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const [info, setInfo] = useState<any>(null);
  const [models, setModels] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validResult, setValidResult] = useState<any>(null);

  const [provider, setProvider] = useState("internal");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    Promise.all([getAISettings(), getAIModels()]).then(([s, m]) => {
      setInfo(s.data);
      setModels(m.data);
      setProvider(s.data.provider || "internal");
      setModel(s.data.model || "gpt-4o-mini");
    }).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = { provider, model };
      if (apiKey.trim()) payload.api_key = apiKey.trim();
      await updateAISettings(payload);
      const r = await getAISettings();
      setInfo(r.data);
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  async function handleValidate() {
    if (!apiKey.trim() && !info?.has_api_key) return;
    setValidating(true);
    setValidResult(null);
    try {
      const keyToTest = apiKey.trim() || "saved";
      if (apiKey.trim()) {
        const r = await validateAPIKey(provider, apiKey.trim(), model);
        setValidResult(r.data);
      } else {
        setValidResult({ valid: true, message: ar ? "استخدم التحقق من لوحة المدير العام" : "Use admin panel to validate saved key" });
      }
    } finally { setValidating(false); }
  }

  const availableModels = provider === "openai"
    ? (models.openai || [])
    : provider === "gemini"
    ? (models.gemini || [])
    : [];

  if (loading) return (
    <AppLayout locale={locale}>
      <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
    </AppLayout>
  );

  return (
    <AppLayout locale={locale}>
      <style>{`@keyframes ai-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "إعدادات AI" : "AI Settings"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <AILogo size={36} />
            <div>
              <h1 className="page-title">{ar ? "إعدادات المساعد الذكي" : "AI Assistant Settings"}</h1>
              <p className="page-subtitle">{ar ? "اختر مزود الخدمة وأضف مفتاحك الخاص للاستخدام غير المحدود" : "Choose provider and add your own key for unlimited usage"}</p>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && <span style={{ color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IcCheck />{ar ? "تم الحفظ" : "Saved"}</span>}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <IcSave />{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Status */}
          <div style={{
            padding: "14px 20px", borderRadius: 12,
            background: info?.is_enabled ? "#F0FDF4" : "#FEF2F2",
            border: `1px solid ${info?.is_enabled ? "#BBF7D0" : "#FECACA"}`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: info?.is_enabled ? "var(--success)" : "var(--danger)", flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: info?.is_enabled ? "var(--success)" : "var(--danger)" }}>
                {info?.is_enabled
                  ? (ar ? "المساعد الذكي متاح لحسابك" : "AI Assistant is available for your account")
                  : (ar ? "المساعد الذكي غير متاح حالياً" : "AI Assistant is not available")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {info?.plan_info?.internal_available
                  ? (ar ? `الخدمة الداخلية مفعّلة · باقتك: ${info.plan_info.plan} · الحد: ${info.plan_info.monthly_limit === -1 ? "غير محدود" : info.plan_info.monthly_limit + " رسالة/شهر"}` : `Internal service active · Plan: ${info.plan_info.plan} · Limit: ${info.plan_info.monthly_limit === -1 ? "Unlimited" : info.plan_info.monthly_limit + " msg/mo"}`)
                  : (ar ? "أضف مفتاحك الخاص للاستخدام" : "Add your own key to use AI")}
              </div>
            </div>
          </div>

          {/* Provider Selection */}
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "مزود الخدمة" : "AI Provider"}</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { key: "internal", label: ar ? "الخدمة الداخلية" : "Internal Service", desc: ar ? "مفتاح المنصة — محدود بالباقة" : "Platform key — limited by plan", available: info?.plan_info?.internal_available },
                  { key: "openai",   label: "OpenAI",           desc: ar ? "مفتاحك الخاص — غير محدود" : "Your own key — unlimited", available: true },
                  { key: "gemini",   label: "Google Gemini",    desc: ar ? "مفتاحك الخاص — غير محدود" : "Your own key — unlimited", available: true },
                ].map(p => (
                  <button key={p.key} onClick={() => { setProvider(p.key); setModel(p.key === "openai" ? "gpt-4o-mini" : p.key === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini"); }}
                    style={{
                      padding: "14px 12px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                      border: `2px solid ${provider === p.key ? "var(--primary)" : "var(--border)"}`,
                      background: provider === p.key ? "var(--primary-light)" : "var(--surface)",
                      opacity: !p.available && p.key === "internal" ? 0.5 : 1,
                    }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: provider === p.key ? "var(--primary)" : "var(--text-primary)", marginBottom: 4 }}>{p.label}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{p.desc}</div>
                    {p.key === "internal" && !p.available && (
                      <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 4 }}>{ar ? "غير متاح" : "Unavailable"}</div>
                    )}
                  </button>
                ))}
              </div>

              {/* Model */}
              {provider !== "internal" && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "الموديل" : "Model"}</label>
                  <select className="form-input form-select" value={model} onChange={e => setModel(e.target.value)}>
                    {availableModels.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* API Key */}
              {provider !== "internal" && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">
                    {ar ? "مفتاح API" : "API Key"}
                    {info?.has_external_key && !apiKey && (
                      <span className="badge badge-success" style={{ marginInlineStart: 8, fontSize: 10 }}>
                        {ar ? "محفوظ:" : "Saved:"} {info.api_key_masked}
                      </span>
                    )}
                  </label>
                  <div style={{ position: "relative" }}>
                    <input type={showKey ? "text" : "password"} className="form-input"
                      value={apiKey} onChange={e => setApiKey(e.target.value)}
                      placeholder={info?.has_external_key ? (ar ? "اتركه فارغاً للإبقاء على المفتاح الحالي" : "Leave empty to keep current key") : (ar ? "أدخل مفتاح API..." : "Enter API key...")}
                      style={{ paddingInlineEnd: 44 }} />
                    <button type="button" onClick={() => setShowKey(v => !v)}
                      style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", [ar ? "left" : "right"]: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                      {showKey ? <IcEyeOff /> : <IcEye />}
                    </button>
                  </div>
                  <p className="form-hint">
                    {provider === "openai" ? "platform.openai.com → API Keys" : "aistudio.google.com → Get API Key"}
                  </p>
                  {apiKey.trim() && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <button className="btn btn-secondary btn-sm" onClick={handleValidate} disabled={validating}>
                        <IcRefresh />{validating ? (ar ? "جاري التحقق..." : "Validating...") : (ar ? "تحقق من المفتاح" : "Validate Key")}
                      </button>
                      {validResult && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: validResult.valid ? "var(--success)" : "var(--danger)", display: "flex", alignItems: "center", gap: 4 }}>
                          {validResult.valid && <IcCheck />}{validResult.message}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Usage Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">{ar ? "الاستخدام هذا الشهر" : "Usage This Month"}</span></div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <div style={{ fontSize: 36, fontWeight: 800, color: "var(--primary)" }}>
                  {info?.usage?.total_messages || 0}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "رسالة" : "messages"}</div>
              </div>
              {info?.plan_info?.monthly_limit !== -1 && provider === "internal" && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{ar ? "الحد الشهري" : "Monthly limit"}</span>
                    <span style={{ fontWeight: 700 }}>{info?.plan_info?.monthly_limit}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${Math.min(((info?.usage?.total_messages || 0) / (info?.plan_info?.monthly_limit || 1)) * 100, 100)}%`,
                      background: "var(--primary)", transition: "width 0.5s",
                    }} />
                  </div>
                </div>
              )}
              {provider !== "internal" && (
                <div style={{ background: "#F0FDF4", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "var(--success)", fontWeight: 600, textAlign: "center" }}>
                  {ar ? "مفتاحك الخاص — غير محدود" : "Your own key — unlimited"}
                </div>
              )}
              <div className="divider" />
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{ar ? "الميزات المتاحة" : "Available Features"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {(info?.plan_info?.allowed_features || []).map((f: string) => (
                    <span key={f} className="badge badge-info" style={{ fontSize: 10 }}>{f}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#1E40AF", display: "flex", gap: 8 }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><IcInfo /></span>
            <span>
              {ar
                ? "مفتاحك الخاص يعطيك استخداماً غير محدود ويُشفَّر بأمان. لا يُشارَك مع أحد."
                : "Your own key gives unlimited usage and is securely encrypted. Never shared."}
            </span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
