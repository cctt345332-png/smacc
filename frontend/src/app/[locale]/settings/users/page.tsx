"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PLANS, type PlanKey } from "@/lib/activityConfig";

// ─── أيقونات ─────────────────────────────────────────────────────────
const IcPlus   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcEdit   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const IcClose  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcUsers  = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcEye    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IcEyeOff = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
const IcInfo   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;

// ─── الأدوار المتاحة ──────────────────────────────────────────────────
const ROLES: { key: string; ar: string; en: string; color: string; bg: string; desc_ar: string; desc_en: string }[] = [
  { key: "admin",      ar: "مدير عام",        en: "Admin",       color: "#DC2626", bg: "#FEF2F2", desc_ar: "وصول كامل لكل شيء",                    desc_en: "Full access to everything" },
  { key: "manager",    ar: "مدير",            en: "Manager",     color: "#7C3AED", bg: "#F5F3FF", desc_ar: "كل الوحدات بدون حذف",                  desc_en: "All modules without delete" },
  { key: "accountant", ar: "محاسب",           en: "Accountant",  color: "#2563EB", bg: "#EFF6FF", desc_ar: "محاسبة، مبيعات، مشتريات، خزينة",       desc_en: "Accounting, sales, purchases, treasury" },
  { key: "sales",      ar: "مبيعات",          en: "Sales",       color: "#059669", bg: "#ECFDF5", desc_ar: "مبيعات وعملاء ومخزون (قراءة)",          desc_en: "Sales, customers, inventory (read)" },
  { key: "purchaser",  ar: "مشتريات",         en: "Purchaser",   color: "#D97706", bg: "#FFFBEB", desc_ar: "مشتريات وموردين ومخزون (قراءة)",        desc_en: "Purchases, vendors, inventory (read)" },
  { key: "cashier",    ar: "كاشير",           en: "Cashier",     color: "#0891B2", bg: "#ECFEFF", desc_ar: "نقطة البيع فقط",                        desc_en: "POS only" },
  { key: "warehouse",  ar: "مستودع",          en: "Warehouse",   color: "#64748B", bg: "#F1F5F9", desc_ar: "إدارة المخزون والمستودعات",             desc_en: "Inventory and warehouse management" },
  { key: "hr",         ar: "موارد بشرية",     en: "HR",          color: "#EC4899", bg: "#FDF2F8", desc_ar: "الموارد البشرية والرواتب",              desc_en: "HR and payroll" },
  { key: "viewer",     ar: "مشاهد",           en: "Viewer",      color: "#94A3B8", bg: "#F8FAFC", desc_ar: "قراءة فقط لكل شيء",                    desc_en: "Read-only access to everything" },
];

const getRoleConfig = (key: string) => ROLES.find(r => r.key === key) || ROLES[ROLES.length - 1];

export default function UsersPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const { plan: storePlan } = useAuthStore();

  const [users, setUsers]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser]  = useState<any>(null);
  const [saving, setSaving]      = useState(false);
  const [error, setError]        = useState("");
  const [showPwd, setShowPwd]    = useState(false);

  // حدود الباقة
  const planCfg = PLANS[storePlan as PlanKey] || PLANS.trial;
  const userLimit = planCfg.limits.users;
  const atLimit = userLimit !== null && users.filter(u => u.is_active).length >= userLimit;

  const [form, setForm] = useState({ full_name: "", email: "", password: "", role: "sales" });
  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const load = async () => {
    try {
      const { data } = await api.get("/auth/users");
      setUsers(data);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditUser(null);
    setForm({ full_name: "", email: "", password: "", role: "sales" });
    setError("");
    setShowModal(true);
  };

  const openEdit = (u: any) => {
    setEditUser(u);
    setForm({ full_name: u.full_name, email: u.email, password: "", role: u.role });
    setError("");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editUser) {
        // تعديل
        await api.patch(`/auth/users/${editUser.id}`, {
          full_name: form.full_name,
          role: form.role,
        });
      } else {
        // إضافة
        await api.post("/auth/users", {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          role: form.role,
        });
      }
      setShowModal(false);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "object" && detail?.error === "plan_limit_exceeded") {
        setError(ar ? detail.message_ar : detail.message_en);
      } else {
        setError(typeof detail === "string" ? detail : (ar ? "حدث خطأ" : "An error occurred"));
      }
    } finally { setSaving(false); }
  };

  const toggleActive = async (u: any) => {
    try {
      await api.patch(`/auth/users/${u.id}`, { is_active: !u.is_active });
      await load();
    } catch {}
  };

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  const activeCount = users.filter(u => u.is_active).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/settings`}>{ar ? "الإعدادات" : "Settings"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "المستخدمون" : "Users"}</span>
          </div>
          <h1 className="page-title">{ar ? "إدارة المستخدمين" : "User Management"}</h1>
          <p className="page-subtitle">
            {ar
              ? `${activeCount} مستخدم نشط${userLimit !== null ? ` من أصل ${userLimit}` : ""}`
              : `${activeCount} active user${userLimit !== null ? ` of ${userLimit}` : ""}`}
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={openAdd}
          disabled={atLimit}
          title={atLimit ? (ar ? "وصلت للحد الأقصى في باقتك" : "Plan limit reached") : ""}
        >
          <IcPlus />
          {ar ? "إضافة مستخدم" : "Add User"}
        </button>
      </div>

      {/* تنبيه حد الباقة */}
      {atLimit && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#D97706", flexShrink: 0 }}><IcInfo /></span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#92400E" }}>
              {ar ? `وصلت للحد الأقصى (${userLimit} مستخدمين) في باقتك الحالية` : `You've reached the limit (${userLimit} users) in your current plan`}
            </span>
          </div>
          <Link href={`/${locale}/settings/subscription`} className="btn btn-sm" style={{ background: "#D97706", color: "white" }}>
            {ar ? "ترقية الباقة" : "Upgrade Plan"}
          </Link>
        </div>
      )}

      {/* شريط الاستخدام */}
      {userLimit !== null && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#2563EB" }}><IcUsers /></span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{ar ? "استخدام المستخدمين" : "User Usage"}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: atLimit ? "#DC2626" : "var(--text-secondary)" }}>
                {activeCount} / {userLimit}
              </span>
            </div>
            <div style={{ height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${Math.min((activeCount / userLimit) * 100, 100)}%`,
                background: atLimit ? "#DC2626" : activeCount / userLimit >= 0.8 ? "#D97706" : "#2563EB",
                borderRadius: 4,
                transition: "width 0.4s ease",
              }} />
            </div>
          </div>
        </div>
      )}

      {/* جدول المستخدمين */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "المستخدم" : "User"}</th>
                <th>{ar ? "البريد الإلكتروني" : "Email"}</th>
                <th>{ar ? "الدور" : "Role"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
                <th>{ar ? "تاريخ الإنشاء" : "Created"}</th>
                <th>{ar ? "إجراء" : "Action"}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
                  {ar ? "لا يوجد مستخدمون" : "No users found"}
                </td></tr>
              ) : users.map((u) => {
                const role = getRoleConfig(u.role);
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg, ${role.color}, ${role.color}99)`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                          {u.full_name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{u.full_name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{u.email}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 6, background: role.bg, color: role.color, fontSize: 12, fontWeight: 600 }}>
                        {ar ? role.ar : role.en}
                      </span>
                    </td>
                    <td>
                      <span className={u.is_active ? "badge badge-success" : "badge badge-gray"}>
                        {u.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString(ar ? "ar-SA" : "en-US") : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-secondary btn-sm" style={{ gap: 4 }} onClick={() => openEdit(u)}>
                          <IcEdit />{ar ? "تعديل" : "Edit"}
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: u.is_active ? "#FEF2F2" : "#ECFDF5", color: u.is_active ? "#DC2626" : "#059669" }}
                          onClick={() => toggleActive(u)}
                        >
                          {u.is_active ? (ar ? "إيقاف" : "Disable") : (ar ? "تفعيل" : "Enable")}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal إضافة/تعديل */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 500, borderRadius: 16 }}>
            <div className="card-header">
              <span className="card-title">
                {editUser ? (ar ? "تعديل المستخدم" : "Edit User") : (ar ? "إضافة مستخدم جديد" : "Add New User")}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><IcClose /></button>
            </div>
            <div className="card-body">
              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم الكامل" : "Full Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.full_name} onChange={e => upd("full_name", e.target.value)} required placeholder={ar ? "محمد أحمد" : "John Smith"} />
                </div>

                {!editUser && (
                  <>
                    <div className="form-group">
                      <label className="form-label">{ar ? "البريد الإلكتروني" : "Email"} <span className="required">*</span></label>
                      <input type="email" className="form-input" value={form.email} onChange={e => upd("email", e.target.value)} required placeholder="user@company.com" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">{ar ? "كلمة المرور" : "Password"} <span className="required">*</span></label>
                      <div style={{ position: "relative" }}>
                        <input type={showPwd ? "text" : "password"} className="form-input" value={form.password} onChange={e => upd("password", e.target.value)} required minLength={8} placeholder="••••••••" style={{ paddingInlineEnd: 40 }} />
                        <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: "absolute", top: "50%", transform: "translateY(-50%)", insetInlineEnd: 12, background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}>
                          {showPwd ? <IcEyeOff /> : <IcEye />}
                        </button>
                      </div>
                      <p className="form-hint">{ar ? "8 أحرف على الأقل" : "At least 8 characters"}</p>
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">{ar ? "الدور" : "Role"} <span className="required">*</span></label>
                  <select className="form-input form-select" value={form.role} onChange={e => upd("role", e.target.value)}>
                    {ROLES.map(r => (
                      <option key={r.key} value={r.key}>{ar ? r.ar : r.en} — {ar ? r.desc_ar : r.desc_en}</option>
                    ))}
                  </select>
                  {form.role && (
                    <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: getRoleConfig(form.role).bg, border: `1px solid ${getRoleConfig(form.role).color}30`, fontSize: 12, color: getRoleConfig(form.role).color, fontWeight: 500 }}>
                      {ar ? getRoleConfig(form.role).desc_ar : getRoleConfig(form.role).desc_en}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
