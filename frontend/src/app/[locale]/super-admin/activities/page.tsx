"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import adminApi from "@/lib/adminApi";
import { ACTIVITIES, ActivityConfig, ModuleKey } from "@/lib/activityConfig";

const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcClose = () => <svg {...s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcSave  = () => <svg {...s}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const IcEdit  = () => <svg {...s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
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

const INV_FEATURES = [
  { key: "serial",          ar: "تتبع السيريال",   en: "Serial Tracking" },
  { key: "batch",           ar: "تتبع التشغيلة",   en: "Batch Tracking" },
  { key: "variant",         ar: "متغيرات المنتج",  en: "Product Variants" },
  { key: "weight",          ar: "البيع بالوزن",    en: "Weight-based Selling" },
  { key: "expiry",          ar: "تاريخ الانتهاء",  en: "Expiry Dates" },
  { key: "pharmacy_fields", ar: "حقول الصيدلية",   en: "Pharmacy Fields" },
];

export default function ActivitiesPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const [activities, setActivities] = useState<Record<string, ActivityConfig>>({ ...ACTIVITIES });
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ActivityConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminApi.get("/admin/activities-config").then(r => {
      if (r.data.activities && Object.keys(r.data.activities).length > 0)
        setActivities(r.data.activities);
    }).catch(() => {});
  }, []);

  async function saveToBackend(updated: Record<string, any>) {
    setSaving(true);
    try {
      await adminApi.put("/admin/activities-config", updated);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  function openEdit(key: string) {
    setEditKey(key);
    setEditData({ ...activities[key] });
  }

  function saveEdit() {
    if (!editKey) return;
    const updated = { ...activities, [editKey]: { ...activities[editKey], ...editData } };
    setActivities(updated);
    saveToBackend(updated);
    setEditKey(null);
  }

  function toggleMod(key: ModuleKey) {
    const mods = editData.modules || [];
    setEditData(d => ({ ...d, modules: mods.includes(key) ? mods.filter(m => m !== key) : [...mods, key] }));
  }

  function toggleInv(key: string) {
    setEditData(d => ({ ...d, inventoryFeatures: { ...d.inventoryFeatures!, [key]: !((d.inventoryFeatures as any)?.[key]) } }));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "إدارة الأنشطة" : "Manage Activities"}</h1>
          <p className="page-subtitle">{ar ? "تعديل الوحدات وميزات المخزون لكل نشاط" : "Edit modules and inventory features per activity"}</p>
        </div>
        {saved && <span style={{ color: "var(--success)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><IcCheck />{ar ? "تم الحفظ" : "Saved"}</span>}
      </div>

      <div className="grid-4">
        {Object.values(activities).map(act => (
          <div key={act.key} className="card">
            <div className="card-header" style={{ background: act.bg }}>
              <div>
                <div className="card-title" style={{ color: act.color }}>{ar ? act.label_ar : act.label_en}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{act.key} · {act.tracking}</div>
              </div>
            </div>
            <div className="card-body" style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Modules */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                  {ar ? "الوحدات" : "Modules"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {ALL_MODULES.map(m => (
                    <span key={m.key} className="badge"
                      style={{ background: act.modules.includes(m.key) ? act.color + "18" : "var(--bg)", color: act.modules.includes(m.key) ? act.color : "var(--text-muted)", fontSize: 10 }}>
                      {ar ? m.ar : m.en}
                    </span>
                  ))}
                </div>
              </div>
              <div className="divider" style={{ margin: "2px 0" }} />
              {/* Inv Features */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>
                  {ar ? "ميزات المخزون" : "Inventory"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {Object.values(act.inventoryFeatures).some(Boolean)
                    ? INV_FEATURES.map(f => (act.inventoryFeatures as any)[f.key]
                        ? <span key={f.key} className="badge badge-success" style={{ fontSize: 10 }}>{ar ? f.ar : f.en}</span>
                        : null)
                    : <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "كمية فقط" : "Quantity only"}</span>}
                </div>
              </div>
              <div className="divider" style={{ margin: "2px 0" }} />
              <span className={`badge ${act.allowPurchaseFromPOS ? "badge-success" : "badge-gray"}`} style={{ fontSize: 11, width: "fit-content" }}>
                {act.allowPurchaseFromPOS ? (ar ? "شراء من POS" : "POS Purchase") : (ar ? "لا شراء من POS" : "No POS Purchase")}
              </span>
              <div className="divider" style={{ margin: "2px 0" }} />
              <button className="btn btn-secondary btn-sm" style={{ width: "100%" }} onClick={() => openEdit(act.key)}>
                <IcEdit />{ar ? "تعديل الوحدات والميزات" : "Edit Modules & Features"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editKey && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", borderRadius: 16 }}>
            <div className="card-header">
              <h3 className="card-title" style={{ fontSize: 16 }}>{ar ? "تعديل النشاط" : "Edit Activity"} — {ar ? editData.label_ar : editData.label_en}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditKey(null)}><IcClose /></button>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="grid-2" style={{ gap: 12 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "الاسم بالعربي" : "Arabic Name"}</label>
                  <input className="form-input" value={editData.label_ar || ""} onChange={e => setEditData(d => ({ ...d, label_ar: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{ar ? "الاسم بالإنجليزي" : "English Name"}</label>
                  <input className="form-input" value={editData.label_en || ""} onChange={e => setEditData(d => ({ ...d, label_en: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "نوع التتبع" : "Tracking Type"}</label>
                <select className="form-input form-select" value={editData.tracking || "quantity"} onChange={e => setEditData(d => ({ ...d, tracking: e.target.value as any }))}>
                  <option value="serial">{ar ? "سيريال" : "Serial"}</option>
                  <option value="batch">{ar ? "تشغيلة" : "Batch"}</option>
                  <option value="quantity">{ar ? "كمية" : "Quantity"}</option>
                  <option value="variant">{ar ? "متغيرات" : "Variant"}</option>
                  <option value="weight">{ar ? "وزن" : "Weight"}</option>
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" id="pos_p" checked={editData.allowPurchaseFromPOS ?? false}
                  onChange={e => setEditData(d => ({ ...d, allowPurchaseFromPOS: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
                <label htmlFor="pos_p" className="form-label" style={{ marginBottom: 0, cursor: "pointer" }}>
                  {ar ? "السماح بالشراء من نقطة البيع" : "Allow Purchase from POS"}
                </label>
              </div>
              <div className="divider" />
              <div className="card-title" style={{ marginBottom: 10 }}>{ar ? "الوحدات المتاحة" : "Available Modules"}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {ALL_MODULES.map(m => {
                  const active = (editData.modules || []).includes(m.key);
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
              <div className="card-title" style={{ marginBottom: 10 }}>{ar ? "ميزات المخزون" : "Inventory Features"}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {INV_FEATURES.map(f => {
                  const active = (editData.inventoryFeatures as any)?.[f.key] ?? false;
                  return (
                    <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" id={`inv_${f.key}`} checked={active} onChange={() => toggleInv(f.key)} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <label htmlFor={`inv_${f.key}`} className="form-label" style={{ marginBottom: 0, cursor: "pointer" }}>{ar ? f.ar : f.en}</label>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 4 }}>
                <button className="btn btn-secondary" onClick={() => setEditKey(null)}>{ar ? "إلغاء" : "Cancel"}</button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={saving}><IcSave />{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
