"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import adminApi from "@/lib/adminApi";

const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcSave    = () => <svg {...s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcCheck   = () => <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>;
const IcEye     = () => <svg {...s}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcEyeOff  = () => <svg {...s}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcRefresh = () => <svg {...s}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.08-4.43"/></svg>;
const IcUsers   = () => <svg {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcChart   = () => <svg {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>;
const IcInfo    = () => <svg {...s}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;

function AILogo({ size = 36 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 200 200" width={size} height={size}>
      <g clipPath="url(#adm_clip)">
        <mask id="adm_mask" style={{ maskType: "alpha" as const }} width="200" height="200" x="0" y="0" maskUnits="userSpaceOnUse">
          <path fill="#fff" fillRule="evenodd" d="M100 150c27.614 0 50-22.386 50-50s-22.386-50-50-50-50 22.386-50 50 22.386 50 50 50zm0 50c55.228 0 100-44.772 100-100S155.228 0 100 0 0 44.772 0 100s44.772 100 100 100z" clipRule="evenodd"/>
        </mask>
        <g mask="url(#adm_mask)">
          <path fill="#fff" d="M200 0H0v200h200V0z"/>
          <path fill="#5A187E" fillOpacity="0.33" d="M200 0H0v200h200V0z"/>
          <g filter="url(#adm_blur)" style={{ animation: "ai-spin 8s linear infinite", transformOrigin: "center", transformBox: "fill-box" as const }}>
            <path fill="#5A187E" d="M110 32H18v68h92V32z"/>
            <path fill="#3E0865" d="M188-24H15v98h173v-98z"/>
            <path fill="#3B82F6" d="M175 70H5v156h170V70z"/>
            <path fill="#60A5FA" d="M230 51H100v103h130V51z"/>
          </g>
        </g>
      </g>
      <defs>
        <filter id="adm_blur" width="385" height="410" x="-75" y="-104" colorInterpolationFilters="sRGB" filterUnits="userSpaceOnUse">
          <feFlood floodOpacity="0" result="BackgroundImageFix"/>
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/>
          <feGaussianBlur result="effect1" stdDeviation="40"/>
        </filter>
        <clipPath id="adm_clip"><path fill="#fff" d="M0 0H200V200H0z"/></clipPath>
      </defs>
    </svg>
  );
}

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"];
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash", "gemini-2.0-flash-lite"];

const FEATURES = [
  { key: "general",    ar: "عام",           en: "General" },
  { key: "accounting", ar: "المحاسبة",      en: "Accounting" },
  { key: "inventory",  ar: "المخزون",       en: "Inventory" },
  { key: "sales",      ar: "المبيعات",      en: "Sales" },
  { key: "pos",        ar: "نقطة البيع",    en: "POS" },
  { key: "purchases",  ar: "المشتريات",     en: "Purchases" },
  { key: "reports",    ar: "التقارير",      en: "Reports" },
  { key: "treasury",   ar: "الخزينة",       en: "Treasury" },
];

const PLANS = ["trial", "starter", "professional", "enterprise"];
const PLAN_COLORS: Record<string, string> = {
  trial: "#6F4A84", starter: "#5A187E", professional: "#75617F", enterprise: "#0F172A"
};
const PLAN_AR: Record<string, string> = {
  trial: "تجريبية", starter: "أساسية", professional: "احترافية", enterprise: "مؤسسية"
};
const PLAN_LIMITS_DEFAULT: Record<string, number> = {
  trial: 20, starter: 100, professional: 500, enterprise: -1
};

export default function AdminAIPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const [config, setConfig] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validResult, setValidResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [tab, setTab] = useState<"config" | "limits" | "stats">("config");

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string>("");

  function loadData() {
    setLoading(true);
    Promise.all([
      adminApi.get("/admin/ai/system-config"),
      adminApi.get("/admin/ai/usage-stats"),
    ]).then(([cfg, st]) => {
      setConfig(cfg.data);
      setStats(st.data);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload: any = {
        internal_provider: config.internal_provider,
        internal_model: config.internal_model,
        internal_enabled: config.internal_enabled,
        plan_limits: config.plan_limits,
        plan_features: config.plan_features,
      };
      if (newKey.trim()) payload.internal_api_key = newKey.trim();
      await adminApi.put("/admin/ai/system-config", payload);
      setNewKey("");
      // أعد تحميل البيانات لتحديث has_api_key و api_key_masked
      await loadData();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  async function handleValidate() {
    setValidating(true);
    setValidResult(null);
    try {
      const r = await adminApi.post("/admin/ai/system-config/validate-key");
      setValidResult(r.data);
    } catch {
      setValidResult({ valid: false, message: ar ? "فشل التحقق" : "Validation failed" });
    } finally { setValidating(false); }
  }

  function toggleFeatureForPlan(plan: string, feature: string) {
    const current: string[] = config.plan_features?.[plan] || [];
    const updated = current.includes(feature)
      ? current.filter((f: string) => f !== feature)
      : [...current, feature];
    setConfig((c: any) => ({ ...c, plan_features: { ...c.plan_features, [plan]: updated } }));
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult("");
    try {
      const r = await adminApi.post("/admin/ai/sync-plans");
      setSyncResult(r.data.message);
      setTimeout(() => setSyncResult(""), 3000);
    } catch {
      setSyncResult(ar ? "فشلت المزامنة" : "Sync failed");
    } finally { setSyncing(false); }
  }

  if (loading) return (
    <div className="empty-state">
      <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
    </div>
  );

  const models = config?.internal_provider === "gemini" ? GEMINI_MODELS : OPENAI_MODELS;

  const TABS = [
    { key: "config", ar: "الإعداد الأساسي", en: "Basic Config" },
    { key: "limits", ar: "الحدود والميزات",  en: "Limits & Features" },
    { key: "stats",  ar: "الإحصائيات",       en: "Statistics" },
  ] as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <style>{`@keyframes ai-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AILogo size={44} />
          <div>
            <h1 className="page-title">{ar ? "إعدادات الذكاء الاصطناعي" : "AI Settings"}</h1>
            <p className="page-subtitle">
              {ar ? "إدارة مفتاح API الداخلي وحدود الباقات" : "Manage internal API key and plan limits"}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saved && (
            <span style={{ color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <IcCheck /> {ar ? "تم الحفظ" : "Saved"}
            </span>
          )}
          {syncResult && (
            <span style={{ color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <IcCheck /> {syncResult}
            </span>
          )}
          <button className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
            <IcRefresh />
            {syncing ? (ar ? "جاري المزامنة..." : "Syncing...") : (ar ? "مزامنة مع الشركات" : "Sync to Companies")}
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <IcSave />
            {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التغييرات" : "Save Changes")}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div style={{
        padding: "14px 20px", borderRadius: 12,
        background: config?.internal_enabled ? "#F7F2F8" : "#FEF2F2",
        border: `1px solid ${config?.internal_enabled ? "#BBF7D0" : "#FECACA"}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: config?.internal_enabled ? "var(--success)" : "var(--danger)", flexShrink: 0,
          }} />
          <span style={{ fontWeight: 700, fontSize: 14, color: config?.internal_enabled ? "var(--success)" : "var(--danger)" }}>
            {config?.internal_enabled
              ? (ar ? "خدمة AI الداخلية مفعّلة" : "Internal AI Service Active")
              : (ar ? "خدمة AI الداخلية معطّلة" : "Internal AI Service Disabled")}
          </span>
          {config?.internal_enabled && config?.has_api_key && (
            <span className="badge badge-success" style={{ fontSize: 11 }}>
              {config.internal_provider?.toUpperCase()} · {config.internal_model}
            </span>
          )}
        </div>
        <button
          onClick={() => setConfig((c: any) => ({ ...c, internal_enabled: !c.internal_enabled }))}
          style={{
            width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", padding: 0,
            background: config?.internal_enabled ? "var(--success)" : "var(--text-muted)",
            position: "relative", transition: "background 0.2s",
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: "50%", background: "white",
            position: "absolute", top: 3,
            left: config?.internal_enabled ? "calc(100% - 23px)" : 3,
            transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "inline-flex", gap: 4, background: "var(--bg)", borderRadius: 12, padding: 4, border: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "7px 18px", borderRadius: 9, border: "none", cursor: "pointer",
              background: tab === t.key ? "var(--surface)" : "transparent",
              color: tab === t.key ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: tab === t.key ? 700 : 500, fontSize: 13,
              boxShadow: tab === t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
            {ar ? t.ar : t.en}
          </button>
        ))}
      </div>

      {/* ── Tab: Config ─────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">{ar ? "إعداد المفتاح الداخلي" : "Internal Key Configuration"}</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Provider */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "مزود الخدمة" : "Provider"}</label>
              <div style={{ display: "flex", gap: 10 }}>
                {["openai", "gemini"].map(p => (
                  <button key={p} onClick={() => setConfig((c: any) => ({
                    ...c,
                    internal_provider: p,
                    internal_model: p === "openai" ? "gpt-4o-mini" : "gemini-1.5-flash",
                  }))}
                    style={{
                      flex: 1, padding: "12px", borderRadius: 10, cursor: "pointer",
                      border: `2px solid ${config?.internal_provider === p ? "var(--primary)" : "var(--border)"}`,
                      background: config?.internal_provider === p ? "var(--primary-light)" : "var(--surface)",
                      color: config?.internal_provider === p ? "var(--primary)" : "var(--text-secondary)",
                      fontWeight: config?.internal_provider === p ? 700 : 500, fontSize: 14,
                    }}>
                    {p === "openai" ? "OpenAI" : "Google Gemini"}
                  </button>
                ))}
              </div>
            </div>

            {/* Model */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "الموديل" : "Model"}</label>
              <select className="form-input form-select"
                value={config?.internal_model || ""}
                onChange={e => setConfig((c: any) => ({ ...c, internal_model: e.target.value }))}>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>

            {/* API Key */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">
                {ar ? "مفتاح API" : "API Key"}
              </label>

              {/* حالة المفتاح الحالي */}
              {config?.has_api_key && !newKey && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  background: "#F7F2F8", border: "1px solid #BBF7D0", borderRadius: 8, marginBottom: 10,
                }}>
                  <IcCheck />
                  <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                    {ar ? "مفتاح محفوظ:" : "Saved key:"} {config.api_key_masked}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", marginInlineStart: "auto" }}>
                    {ar ? "أدخل مفتاحاً جديداً للتغيير" : "Enter a new key to replace"}
                  </span>
                </div>
              )}

              <div style={{ position: "relative" }}>
                <input
                  type={showKey ? "text" : "password"}
                  className="form-input"
                  value={newKey}
                  onChange={e => setNewKey(e.target.value)}
                  placeholder={
                    config?.has_api_key
                      ? (ar ? "اتركه فارغاً للإبقاء على المفتاح الحالي" : "Leave empty to keep current key")
                      : (ar ? "أدخل مفتاح API..." : "Enter API key...")
                  }
                  style={{ paddingInlineEnd: 44 }}
                />
                <button type="button" onClick={() => setShowKey(v => !v)}
                  style={{
                    position: "absolute", top: "50%", transform: "translateY(-50%)",
                    [ar ? "left" : "right"]: 12,
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-muted)", display: "flex", alignItems: "center",
                  }}>
                  {showKey ? <IcEyeOff /> : <IcEye />}
                </button>
              </div>
              <p className="form-hint">
                {config?.internal_provider === "openai"
                  ? (ar ? "احصل على مفتاحك من platform.openai.com" : "Get your key from platform.openai.com")
                  : (ar ? "احصل على مفتاحك من aistudio.google.com" : "Get your key from aistudio.google.com")}
              </p>
            </div>

            {/* Validate */}
            {config?.has_api_key && (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button className="btn btn-secondary" onClick={handleValidate} disabled={validating}>
                  <IcRefresh />
                  {validating ? (ar ? "جاري التحقق..." : "Validating...") : (ar ? "التحقق من المفتاح المحفوظ" : "Validate Saved Key")}
                </button>
                {validResult && (
                  <span style={{
                    fontSize: 13, fontWeight: 600,
                    color: validResult.valid ? "var(--success)" : "var(--danger)",
                    display: "flex", alignItems: "center", gap: 4,
                  }}>
                    {validResult.valid && <IcCheck />}
                    {validResult.message}
                  </span>
                )}
              </div>
            )}

            {/* Info */}
            <div style={{
              background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10,
              padding: "12px 16px", fontSize: 13, color: "#1E40AF",
              display: "flex", alignItems: "flex-start", gap: 8,
            }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><IcInfo /></span>
              <span>
                {ar
                  ? "هذا المفتاح يُستخدم لجميع الشركات التي تختار الـ AI الداخلي. الشركات التي تستخدم مفاتيحها الخاصة لا تتأثر."
                  : "This key is used for all companies using internal AI. Companies with their own keys are not affected."}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Limits ─────────────────────────────────────────── */}
      {tab === "limits" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10,
            padding: "12px 16px", fontSize: 13, color: "#92400E",
            display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><IcInfo /></span>
            <span>
              {ar
                ? "الحد -1 يعني غير محدود. الميزات المفعّلة هنا تظهر تلقائياً في صفحة AI للشركات التي تستخدم الباقة المقابلة."
                : "Limit -1 means unlimited. Enabled features here appear automatically in the AI page for companies on that plan."}
            </span>
          </div>

          {PLANS.map(plan => {
            const planColor = PLAN_COLORS[plan];
            const limit = config?.plan_limits?.[plan];
            const features: string[] = config?.plan_features?.[plan] || [];
            return (
              <div key={plan} className="card" style={{ borderColor: planColor + "40" }}>
                <div className="card-header" style={{ background: planColor + "08" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="badge" style={{ background: planColor + "20", color: planColor, fontSize: 13, fontWeight: 700 }}>
                      {ar ? PLAN_AR[plan] : plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {features.length} {ar ? "ميزة مفعّلة" : "features enabled"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label className="form-label" style={{ marginBottom: 0, fontSize: 12, whiteSpace: "nowrap" }}>
                      {ar ? "الحد الشهري (رسالة)" : "Monthly Limit"}
                    </label>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 110 }}
                      value={limit === -1 ? "" : (limit ?? "")}
                      placeholder={ar ? "غير محدود" : "Unlimited"}
                      onChange={e => setConfig((c: any) => ({
                        ...c,
                        plan_limits: {
                          ...c.plan_limits,
                          [plan]: e.target.value === "" ? -1 : Number(e.target.value),
                        },
                      }))}
                    />
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                    {ar ? "الميزات المتاحة لهذه الباقة" : "Available Features for this Plan"}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {FEATURES.map(f => {
                      const active = features.includes(f.key);
                      return (
                        <button key={f.key} onClick={() => toggleFeatureForPlan(plan, f.key)}
                          style={{
                            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                            border: `1.5px solid ${active ? planColor : "var(--border)"}`,
                            background: active ? planColor + "15" : "var(--surface)",
                            color: active ? planColor : "var(--text-secondary)",
                            transition: "all 0.15s",
                          }}>
                          {ar ? f.ar : f.en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Stats ──────────────────────────────────────────── */}
      {tab === "stats" && stats && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="grid-4">
            {[
              { label: ar ? "إجمالي الرسائل" : "Total Messages",  value: stats.total_messages,  Icon: IcChart, color: "#5A187E", bg: "#EFF6FF" },
              { label: ar ? "إجمالي الـ Tokens" : "Total Tokens", value: stats.total_tokens,    Icon: IcChart, color: "#75617F", bg: "#F5F3FF" },
              { label: ar ? "شركات نشطة" : "Active Tenants",      value: stats.active_tenants,  Icon: IcUsers, color: "#6F4A84", bg: "#F4EFF7" },
              { label: ar ? "شركات مفعّلة" : "Enabled Tenants",   value: stats.enabled_tenants, Icon: IcUsers, color: "#D97706", bg: "#FFFBEB" },
            ].map((k, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon" style={{ background: k.bg, color: k.color }}><k.Icon /></div>
                <div className="stat-content">
                  <div className="stat-label">{k.label}</div>
                  <div className="stat-value" style={{ color: k.color }}>{(k.value || 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "الاستخدام حسب الميزة" : "Usage by Feature"} — {stats.month}</span>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.keys(stats.by_feature || {}).length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>
                  {ar ? "لا يوجد استخدام هذا الشهر" : "No usage this month"}
                </div>
              ) : Object.entries(stats.by_feature || {})
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([key, count]) => {
                    const total = Math.max(stats.total_messages, 1);
                    const pct = Math.round(((count as number) / total) * 100);
                    const feat = FEATURES.find(f => f.key === key);
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
                          <span style={{ fontWeight: 600 }}>{ar ? feat?.ar : feat?.en || key}</span>
                          <span style={{ color: "var(--text-secondary)" }}>{count as number} ({pct}%)</span>
                        </div>
                        <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "var(--primary)", borderRadius: 3, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
