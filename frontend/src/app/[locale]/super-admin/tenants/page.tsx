"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import adminApi from "@/lib/adminApi";

interface Tenant {
  id: string; name: string; name_en: string; email: string; phone: string;
  business_type: string; plan: string; plan_expires_at: string | null;
  is_active: boolean; admin_notes: string | null; vat_number: string | null;
  cr_number: string | null; created_at: string; users_count: number;
}

const s = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcSearch  = () => <svg {...s}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
const IcEdit    = () => <svg {...s}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcClose   = () => <svg {...s}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcCalendar= () => <svg {...s}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcChevronL= () => <svg {...s}><polyline points="15 18 9 12 15 6"/></svg>;
const IcChevronR= () => <svg {...s}><polyline points="9 18 15 12 9 6"/></svg>;

const PLAN_CFG: Record<string, { ar: string; en: string; color: string; bg: string }> = {
  trial:        { ar: "تجريبية",  en: "Trial",        color: "#059669", bg: "#DCFCE7" },
  starter:      { ar: "أساسية",   en: "Starter",      color: "#2563EB", bg: "#DBEAFE" },
  professional: { ar: "احترافية", en: "Professional", color: "#7C3AED", bg: "#EDE9FE" },
  enterprise:   { ar: "مؤسسية",  en: "Enterprise",   color: "#0F172A", bg: "#F1F5F9" },
};
const ACT_AR: Record<string, string> = {
  mobile_phones: "جوالات", spare_parts: "قطع غيار", pharmacy: "صيدلية",
  grocery: "بقالة", spices: "عطارة", clothing: "ملابس",
  construction: "مواد بناء", general: "عام",
};

const LIMIT = 20;

export default function TenantsPage() {
  const params = useParams();
  const locale = (params?.locale as string) || "ar";
  const ar = locale === "ar";

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [editData, setEditData] = useState<Partial<Tenant & { plan_expires_at: string }>>({});
  const [saving, setSaving] = useState(false);
  const [extendDays, setExtendDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p: any = { skip: page * LIMIT, limit: LIMIT };
      if (search) p.search = search;
      if (planFilter) p.plan = planFilter;
      if (activeFilter !== "") p.is_active = activeFilter === "true";
      const r = await adminApi.get("/admin/tenants", { params: p });
      setTenants(r.data.items);
      setTotal(r.data.total);
    } finally { setLoading(false); }
  }, [search, planFilter, activeFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    try {
      await adminApi.put(`/admin/tenants/${selected.id}`, editData);
      setSelected(null);
      load();
    } finally { setSaving(false); }
  }

  async function handleToggle(t: Tenant) {
    await adminApi.put(`/admin/tenants/${t.id}`, { is_active: !t.is_active });
    load();
  }

  async function handleExtend() {
    if (!selected) return;
    await adminApi.post(`/admin/tenants/${selected.id}/extend-plan?days=${extendDays}`);
    setSelected(null);
    load();
  }

  function openEdit(t: Tenant) {
    setSelected(t);
    setEditData({
      plan: t.plan,
      business_type: t.business_type,
      is_active: t.is_active,
      admin_notes: t.admin_notes || "",
      plan_expires_at: t.plan_expires_at ? t.plan_expires_at.split("T")[0] : "",
    });
  }

  const isExpired = (t: Tenant) => t.plan_expires_at && new Date(t.plan_expires_at) < new Date();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "إدارة الشركات" : "Manage Companies"}</h1>
          <p className="page-subtitle">{ar ? `${total} شركة مسجلة` : `${total} registered companies`}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-body" style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
              <span style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", [ar ? "right" : "left"]: 10, color: "var(--text-muted)", pointerEvents: "none" }}>
                <IcSearch />
              </span>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder={ar ? "بحث بالاسم أو البريد..." : "Search by name or email..."}
                className="form-input"
                style={{ [ar ? "paddingRight" : "paddingLeft"]: 34 }}
              />
            </div>
            <select value={planFilter} onChange={e => { setPlanFilter(e.target.value); setPage(0); }}
              className="form-input form-select" style={{ width: 150 }}>
              <option value="">{ar ? "كل الباقات" : "All Plans"}</option>
              <option value="trial">{ar ? "تجريبية" : "Trial"}</option>
              <option value="starter">{ar ? "أساسية" : "Starter"}</option>
              <option value="professional">{ar ? "احترافية" : "Professional"}</option>
              <option value="enterprise">{ar ? "مؤسسية" : "Enterprise"}</option>
            </select>
            <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value as any); setPage(0); }}
              className="form-input form-select" style={{ width: 130 }}>
              <option value="">{ar ? "الكل" : "All"}</option>
              <option value="true">{ar ? "نشطة" : "Active"}</option>
              <option value="false">{ar ? "موقوفة" : "Inactive"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {loading ? (
          <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
        ) : tenants.length === 0 ? (
          <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد شركات" : "No companies found"}</div></div>
        ) : (
          <table>
            <thead>
              <tr>
                {[ar?"الشركة":"Company", ar?"النشاط":"Activity", ar?"الباقة":"Plan", ar?"الانتهاء":"Expiry", ar?"المستخدمون":"Users", ar?"الحالة":"Status", ar?"إجراءات":"Actions"].map((h,i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => {
                const planCfg = PLAN_CFG[t.plan] || PLAN_CFG.trial;
                const expired = isExpired(t);
                return (
                  <tr key={t.id} style={{ opacity: t.is_active ? 1 : 0.55 }}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{t.email}</div>
                    </td>
                    <td style={{ color: "var(--text-secondary)" }}>
                      {ar ? ACT_AR[t.business_type] : t.business_type}
                    </td>
                    <td>
                      <span className="badge" style={{ background: planCfg.bg, color: planCfg.color }}>
                        {ar ? planCfg.ar : planCfg.en}
                      </span>
                    </td>
                    <td>
                      {t.plan_expires_at ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: expired ? "var(--danger)" : "var(--success)" }}>
                          {expired && <span style={{ marginInlineEnd: 4 }}>⚠</span>}
                          {new Date(t.plan_expires_at).toLocaleDateString(ar ? "ar-SA" : "en-US")}
                        </span>
                      ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 700 }}>{t.users_count}</td>
                    <td>
                      <span className={`badge ${t.is_active ? "badge-success" : "badge-danger"}`}>
                        {t.is_active ? (ar ? "نشطة" : "Active") : (ar ? "موقوفة" : "Inactive")}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => openEdit(t)} className="btn btn-secondary btn-sm">
                          <IcEdit /> {ar ? "تعديل" : "Edit"}
                        </button>
                        <button onClick={() => handleToggle(t)}
                          className="btn btn-sm"
                          style={{ background: t.is_active ? "#FEE2E2" : "#DCFCE7", color: t.is_active ? "var(--danger)" : "var(--success)", border: "none" }}>
                          {t.is_active ? (ar ? "إيقاف" : "Disable") : (ar ? "تفعيل" : "Enable")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {total > LIMIT && (
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn btn-secondary btn-sm">
              <IcChevronL />
            </button>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {page + 1} / {Math.ceil(total / LIMIT)}
            </span>
            <button disabled={(page + 1) * LIMIT >= total} onClick={() => setPage(p => p + 1)} className="btn btn-secondary btn-sm">
              <IcChevronR />
            </button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", borderRadius: 16 }}>
            <div className="card-header">
              <span className="card-title">{ar ? "تعديل الشركة" : "Edit Company"}: {selected.name}</span>
              <button onClick={() => setSelected(null)} className="btn btn-ghost btn-icon"><IcClose /></button>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Plan */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "الباقة" : "Plan"}</label>
                <select value={editData.plan || ""} onChange={e => setEditData(d => ({ ...d, plan: e.target.value }))}
                  className="form-input form-select">
                  <option value="trial">{ar ? "تجريبية" : "Trial"}</option>
                  <option value="starter">{ar ? "أساسية" : "Starter"}</option>
                  <option value="professional">{ar ? "احترافية" : "Professional"}</option>
                  <option value="enterprise">{ar ? "مؤسسية" : "Enterprise"}</option>
                </select>
              </div>

              {/* Expiry */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "تاريخ انتهاء الباقة" : "Plan Expiry Date"}</label>
                <input type="date" value={editData.plan_expires_at || ""}
                  onChange={e => setEditData(d => ({ ...d, plan_expires_at: e.target.value }))}
                  className="form-input" />
              </div>

              {/* Extend */}
              <div style={{ background: "var(--bg)", borderRadius: 10, padding: 14, border: "1px solid var(--border)" }}>
                <label className="form-label" style={{ marginBottom: 8 }}>
                  <IcCalendar /> {ar ? "  تمديد الباقة" : "  Extend Plan"}
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={extendDays} onChange={e => setExtendDays(Number(e.target.value))}
                    className="form-input form-select" style={{ flex: 1 }}>
                    <option value={7}>{ar ? "7 أيام" : "7 days"}</option>
                    <option value={14}>{ar ? "14 يوم" : "14 days"}</option>
                    <option value={30}>{ar ? "30 يوم" : "30 days"}</option>
                    <option value={90}>{ar ? "90 يوم" : "90 days"}</option>
                    <option value={365}>{ar ? "سنة كاملة" : "1 year"}</option>
                  </select>
                  <button onClick={handleExtend} className="btn btn-primary">
                    {ar ? "تمديد" : "Extend"}
                  </button>
                </div>
              </div>

              {/* Business Type */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "النشاط التجاري" : "Business Type"}</label>
                <select value={editData.business_type || ""} onChange={e => setEditData(d => ({ ...d, business_type: e.target.value }))}
                  className="form-input form-select">
                  {Object.entries(ACT_AR).map(([k, v]) => (
                    <option key={k} value={k}>{ar ? v : k}</option>
                  ))}
                </select>
              </div>

              {/* Active */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" id="is_active" checked={editData.is_active ?? true}
                  onChange={e => setEditData(d => ({ ...d, is_active: e.target.checked }))}
                  style={{ width: 16, height: 16, cursor: "pointer" }} />
                <label htmlFor="is_active" className="form-label" style={{ marginBottom: 0, cursor: "pointer" }}>
                  {ar ? "الشركة نشطة" : "Company is active"}
                </label>
              </div>

              {/* Notes */}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{ar ? "ملاحظات المدير العام" : "Admin Notes"}</label>
                <textarea value={editData.admin_notes || ""} onChange={e => setEditData(d => ({ ...d, admin_notes: e.target.value }))}
                  rows={3} className="form-input"
                  placeholder={ar ? "ملاحظات داخلية..." : "Internal notes..."}
                  style={{ resize: "vertical" }} />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
                <button onClick={() => setSelected(null)} className="btn btn-secondary">
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ التغييرات" : "Save Changes")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
