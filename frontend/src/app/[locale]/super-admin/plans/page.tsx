"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import adminApi from "@/lib/adminApi";
import { PLANS, PlanConfig, PlanKey, ModuleKey } from "@/lib/activityConfig";

const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcClose = () => <svg {...s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcPlus  = () => <svg {...s}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcSave  = () => <svg {...s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcEdit  = () => <svg {...s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcTrash = () => <svg {...s}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>;
const IcCheck = () => <svg {...s}><polyline points="20 6 9 17 4 12"/></svg>;

const ALL_MODULES: { key: ModuleKey; ar: string; en: string }[] = [
  { key: "dashboard",  ar: "الرئيسية",       en: "Dashboard" },
  { key: "accounting", ar: "المحاسبة",        en: "Accounting" },
  { key: "sales",      ar: "المبيعات",        en: "Sales" },
  { key: "purchases",  ar: "المشتريات",       en: "Purchases" },
  { key: "inventory",  ar: "المخزون",         en: "Inventory" },
  { key: "pos",        ar: "نقطة البيع",      en: "POS" },
  { key: "treasury",   ar: "الخزينة",         en: "Treasury" },
  { key: "hr",         ar: "الموارد البشرية", en: "HR" },
  { key: "assets",     ar: "الأصول الثابتة", en: "Assets" },
  { key: "reports",    ar: "التقارير",        en: "Reports" },
];

const DEFAULT_KEYS: PlanKey[] = ["trial", "starter", "professional", "enterprise"];
const EMPTY_NEW = () => ({
  key: "", label_ar: "", label_en: "", price_monthly: 0, price_yearly: 0,
  color: "#2563EB", bg: "#EFF6FF", popular: false,
  limits: { invoices_per_month: 100, users: 5, warehouses: 1, branches: 1, pos_terminals: 1 },
  modules: ["dashboard", "accounting", "sales", "purchases", "inventory", "treasury", "reports"] as ModuleKey[],
  features_ar: [] as string[], features_en: [] as string[],
});

export default function PlansPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const [plans, setPlans] = useState<Record<string, PlanConfig>>({ ...PLANS });
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<PlanConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [newPlan, setNewPlan] = useState<Partial<Omit<PlanConfig, "key">> & { key: string }>(EMPTY_NEW());

  useEffect(() => {
    adminApi.get("/admin/plans-config").then(r => {
      if (r.data.plans && Object.keys(r.data.plans).length > 0) setPlans(r.data.plans);
    }).catch(() => {});
  }, []);

  async function saveToBackend(updated: Record<string, any>) {
    setSaving(true);
    try {
      await adminApi.put("/admin/plans-config", updated);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  function openEdit(key: string) { setEditKey(key); setEditData({ ...plans[key] }); }

  function saveEdit() {
    if (!editKey) return;
    const updated = { ...plans, [editKey]: { ...plans[editKey], ...editData } };
    setPlans(updated); saveToBackend(updated); setEditKey(null);
  }

  function addPlan() {
    if (!newPlan.key) return;
    const updated = { ...plans, [newPlan.key]: newPlan as PlanConfig };
    setPlans(updated); saveToBackend(updated); setAddModal(false); setNewPlan(EMPTY_NEW() as any);
  }

  function deletePlan(key: string) {
    if (!confirm(ar ? "هل تريد حذف هذه الباقة؟" : "Delete this plan?")) return;
    const updated = { ...plans }; delete updated[key];
    setPlans(updated); saveToBackend(updated);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "إدارة الباقات" : "Manage Plans"}</h1>
          <p className="page-subtitle">{ar ? "تعديل أسعار وميزات الباقات — يؤثر على صفحة الهبوط فوراً" : "Edit plan prices and features — affects landing page instantly"}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {saved && <span style={{ color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IcCheck />{ar ? "تم الحفظ" : "Saved"}</span>}
          <button className="btn btn-primary" onClick={() => setAddModal(true)}><IcPlus />{ar ? "إضافة باقة" : "Add Plan"}</button>
        </div>
      </div>

      <div className="grid-4">
        {Object.values(plans).map(plan => (
          <div key={plan.key} className="card" style={{ borderColor: plan.popular ? plan.color : "var(--border)", borderWidth: plan.popular ? 2 : 1 }}>
            <div className="card-header" style={{ background: plan.bg }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span className="badge" style={{ background: plan.color + "20", color: plan.color, fontSize: 13, fontWeight: 700 }}>
                    {ar ? plan.label_ar : plan.label_en}
                  </span>
                  {plan.popular && <span className="badge" style={{ background: plan.color, color: "white" }}>{ar ? "الأشهر" : "Popular"}</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>{plan.key}</div>
              </div>
              <div style={{ textAlign: "end" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: plan.color, lineHeight: 1 }}>
                  {plan.price_monthly === 0 ? (ar ? "مجاني" : "Free") : plan.price_monthly}
                </div>
                {plan.price_monthly > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "ر.س/شهر" : "SAR/mo"}</div>}
              </div>
            </div>
            <div className="card-body" style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Limits */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{ar ? "الحدود" : "Limits"}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12 }}>
                  {[
                    { l: ar ? "فواتير/شهر" : "Invoices/mo", v: plan.limits.invoices_per_month ?? "∞" },
                    { l: ar ? "مستخدمون" : "Users",         v: plan.limits.users ?? "∞" },
                    { l: ar ? "مستودعات" : "Warehouses",    v: plan.limits.warehouses ?? "∞" },
                    { l: ar ? "نقاط بيع" : "POS",           v: plan.limits.pos_terminals ?? "∞" },
                  ].map((x, i) => (
                    <div key={i}><span style={{ color: "var(--text-muted)" }}>{x.l}: </span><span style={{ fontWeight: 700 }}>{x.v}</span></div>
                  ))}
                </div>
              </div>
              <div className="divider" style={{ margin: "4px 0" }} />
              {/* Modules */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{ar ? "الوحدات" : "Modules"}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {ALL_MODULES.map(m => (
                    <span key={m.key} className="badge"
                      style={{ background: plan.modules.includes(m.key) ? plan.color + "18" : "var(--bg)", color: plan.modules.includes(m.key) ? plan.color : "var(--text-muted)", fontSize: 10 }}>
                      {ar ? m.ar : m.en}
                    </span>
                  ))}
                </div>
              </div>
              <div className="divider" style={{ margin: "4px 0" }} />
              {/* AI Support */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 8px", borderRadius: 8, background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z"/><circle cx="9" cy="10" r="1" fill="#2563EB" stroke="none"/><circle cx="15" cy="10" r="1" fill="#2563EB" stroke="none"/></svg>
                <span style={{ fontSize: 11, color: "#2563EB", fontWeight: 600 }}>
                  {ar ? "دعم AI: " : "AI: "}
                  {(plan.key === "trial" ? 20 : plan.key === "starter" ? 100 : plan.key === "professional" ? 500 : -1) === -1
                    ? (ar ? "غير محدود" : "Unlimited")
                    : `${plan.key === "trial" ? 20 : plan.key === "starter" ? 100 : 500} ${ar ? "رسالة/شهر" : "msg/mo"}`}
                </span>
              </div>
              <div className="divider" style={{ margin: "4px 0" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => openEdit(plan.key)}><IcEdit />{ar ? "تعديل" : "Edit"}</button>
                {!DEFAULT_KEYS.includes(plan.key as PlanKey) && (
                  <button className="btn btn-sm" style={{ background: "#FEE2E2", color: "var(--danger)", border: "none" }} onClick={() => deletePlan(plan.key)}><IcTrash /></button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editKey && <PlanModal ar={ar} plan={editData as PlanConfig} onChange={setEditData} onSave={saveEdit} onClose={() => setEditKey(null)} saving={saving} isNew={false} />}
      {addModal && <PlanModal ar={ar} plan={newPlan as PlanConfig} onChange={setNewPlan} onSave={addPlan} onClose={() => setAddModal(false)} saving={saving} isNew={true} />}
    </div>
  );
}

function PlanModal({ ar, plan, onChange, onSave, onClose, saving, isNew }: {
  ar: boolean; plan: Partial<PlanConfig> & { key?: string };
  onChange: (d: any) => void; onSave: () => void; onClose: () => void;
  saving: boolean; isNew: boolean;
}) {
  const IcClose = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
  const IcSave  = () => <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;

  function toggleMod(key: ModuleKey) {
    const mods: ModuleKey[] = (plan.modules as ModuleKey[]) || [];
    onChange((d: any) => ({ ...d, modules: mods.includes(key) ? mods.filter(m => m !== key) : [...mods, key] }));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card" style={{ width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", borderRadius: 16 }}>
        <div className="card-header">
          <h3 className="card-title" style={{ fontSize: 16 }}>{isNew ? (ar ? "إضافة باقة جديدة" : "Add New Plan") : (ar ? "تعديل الباقة" : "Edit Plan")}</h3>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><IcClose /></button>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {isNew && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{ar ? "مفتاح الباقة (إنجليزي)" : "Plan Key (English)"}</label>
              <input className="form-input" value={(plan as any).key ?? ""} onChange={e => onChange((d: any) => ({ ...d, key: e.target.value }))} placeholder="e.g. premium" />
            </div>
          )}
          <div className="grid-2" style={{ gap: 12 }}>
            {[
              { l: ar ? "الاسم بالعربي" : "Arabic Name", f: "label_ar", t: "text" },
              { l: ar ? "الاسم بالإنجليزي" : "English Name", f: "label_en", t: "text" },
              { l: ar ? "السعر الشهري (ر.س)" : "Monthly Price (SAR)", f: "price_monthly", t: "number" },
              { l: ar ? "السعر السنوي (ر.س)" : "Yearly Price (SAR)", f: "price_yearly", t: "number" },
              { l: ar ? "اللون" : "Color", f: "color", t: "color" },
              { l: ar ? "لون الخلفية" : "Background", f: "bg", t: "color" },
            ].map(({ l, f, t }) => (
              <div key={f} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{l}</label>
                <input className="form-input" type={t} value={(plan as any)[f] ?? ""} style={t === "color" ? { height: 40, padding: "4px 8px", cursor: "pointer" } : {}}
                  onChange={e => onChange((d: any) => ({ ...d, [f]: t === "number" ? Number(e.target.value) : e.target.value }))} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="pop" checked={plan.popular ?? false} onChange={e => onChange((d: any) => ({ ...d, popular: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
            <label htmlFor="pop" className="form-label" style={{ marginBottom: 0, cursor: "pointer" }}>{ar ? "الأكثر شيوعاً" : "Mark as Popular"}</label>
          </div>
          <div className="divider" />
          <div className="card-title" style={{ marginBottom: 10 }}>{ar ? "الحدود (فارغ = غير محدود)" : "Limits (empty = unlimited)"}</div>
          <div className="grid-2" style={{ gap: 10 }}>
            {[
              { l: ar ? "فواتير/شهر" : "Invoices/month", f: "invoices_per_month" },
              { l: ar ? "مستخدمون" : "Users",            f: "users" },
              { l: ar ? "مستودعات" : "Warehouses",       f: "warehouses" },
              { l: ar ? "فروع" : "Branches",             f: "branches" },
              { l: ar ? "نقاط بيع" : "POS Terminals",   f: "pos_terminals" },
            ].map(({ l, f }) => (
              <div key={f} className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{l}</label>
                <input className="form-input" type="number" value={(plan.limits as any)?.[f] ?? ""}
                  placeholder={ar ? "غير محدود" : "Unlimited"}
                  onChange={e => onChange((d: any) => ({ ...d, limits: { ...d.limits, [f]: e.target.value === "" ? null : Number(e.target.value) } }))} />
              </div>
            ))}
          </div>
          <div className="divider" />
          <div className="card-title" style={{ marginBottom: 10 }}>{ar ? "الوحدات المتاحة" : "Available Modules"}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {ALL_MODULES.map(m => {
              const active = (plan.modules || []).includes(m.key);
              return (
                <button key={m.key} type="button" onClick={() => toggleMod(m.key)}
                  style={{ padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                    border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}`,
                    background: active ? "var(--primary-light)" : "var(--surface)",
                    color: active ? "var(--primary)" : "var(--text-secondary)",
                    fontSize: 12, fontWeight: active ? 700 : 400 }}>
                  {ar ? m.ar : m.en}
                </button>
              );
            })}
          </div>
          <div className="divider" />
          {[
            { l: ar ? "الميزات (عربي) — سطر لكل ميزة" : "Features (Arabic) — one per line", f: "features_ar" },
            { l: ar ? "الميزات (إنجليزي) — سطر لكل ميزة" : "Features (English) — one per line", f: "features_en" },
          ].map(({ l, f }) => (
            <div key={f} className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">{l}</label>
              <textarea className="form-input" rows={4} style={{ resize: "vertical" }}
                value={((plan as any)[f] || []).join("\n")}
                onChange={e => onChange((d: any) => ({ ...d, [f]: e.target.value.split("\n") }))} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
            <button className="btn btn-secondary" onClick={onClose}>{ar ? "إلغاء" : "Cancel"}</button>
            <button className="btn btn-primary" onClick={onSave} disabled={saving}><IcSave />{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
