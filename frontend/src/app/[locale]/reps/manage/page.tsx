"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getReps, createRep, updateRep, getRepSummary, getRepImpersonationToken } from "@/lib/reps";
import { useAuthStore } from "@/store/authStore";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtNum = (n: any) => Number(n || 0).toLocaleString("en-US");

const EMPTY_FORM = {
  // بيانات الحساب
  full_name: "", email: "", password: "",
  // بيانات التواصل
  phone: "", zone: "", notes: "",
  // بيانات الهوية
  id_number: "", id_expiry: "", license_expiry: "",
  // بيانات السيارة
  vehicle_plate: "", vehicle_type: "", vehicle_color: "",
  // الأهداف والعمولة
  target_monthly: "", commission_pct: "",
};

export default function ManageRepsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const router = useRouter();
  const { token: currentToken, user: currentUser, setAuth } = useAuthStore();
  const [reps, setReps] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editRep, setEditRep] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");

  const load = async () => {
    setLoading(true);
    try {
      const res = await getReps();
      const list = Array.isArray(res.data) ? res.data : [];
      setReps(list);
      const sumResults = await Promise.allSettled(list.map((r: any) => getRepSummary(r.id)));
      const map: Record<string, any> = {};
      sumResults.forEach((result, i) => {
        if (result.status === "fulfilled") map[list[i].id] = result.value.data;
      });
      setSummaries(map);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  /* الدخول كمندوب — يحفظ التوكن الحالي ويُبدّله بتوكن المندوب */
  const handleViewAsRep = async (rep: any) => {
    try {
      const res = await getRepImpersonationToken(rep.id);
      const { access_token, full_name } = res.data;
      // حفظ بيانات المدير للرجوع لاحقاً
      if (typeof window !== "undefined") {
        sessionStorage.setItem("prev_token", currentToken || "");
        sessionStorage.setItem("prev_user", JSON.stringify(currentUser));
        sessionStorage.setItem("prev_path", `/${locale}/reps/manage`);
      }
      // تبديل التوكن لتوكن المندوب
      setAuth(access_token, {
        id: rep.user_id,
        tenantId: rep.tenant_id || currentUser?.tenantId || "",
        role: "sales_rep",
        fullName: full_name,
      });
      router.push(`/${locale}/reps/me/dashboard`);
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "فشل الدخول كمندوب" : "Failed to view as rep"));
    }
  };

  const openAdd = () => { setForm({ ...EMPTY_FORM }); setEditRep(null); setShowAdd(true); setError(""); };
  const openEdit = (rep: any) => {
    setForm({
      full_name: rep.full_name || "", email: rep.email || "", password: "",
      phone: rep.phone || "", zone: rep.zone || "", notes: rep.notes || "",
      id_number: rep.id_number || "", id_expiry: rep.id_expiry || "", license_expiry: rep.license_expiry || "",
      vehicle_plate: rep.vehicle_plate || "", vehicle_type: rep.vehicle_type || "", vehicle_color: rep.vehicle_color || "",
      target_monthly: rep.target_monthly || "", commission_pct: rep.commission_pct || "",
    });
    setEditRep(rep);
    setShowAdd(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.full_name || !form.email || (!editRep && !form.password))
      return setError(ar ? "الاسم والبريد وكلمة المرور مطلوبة" : "Name, email and password required");
    setSaving(true); setError("");
    try {
      const payload: any = {
        full_name: form.full_name, email: form.email,
        phone: form.phone || undefined, zone: form.zone || undefined, notes: form.notes || undefined,
        id_number: form.id_number || undefined, id_expiry: form.id_expiry || undefined,
        license_expiry: form.license_expiry || undefined,
        vehicle_plate: form.vehicle_plate || undefined, vehicle_type: form.vehicle_type || undefined,
        vehicle_color: form.vehicle_color || undefined,
        target_monthly: form.target_monthly ? Number(form.target_monthly) : 0,
        commission_pct: form.commission_pct ? Number(form.commission_pct) : 0,
      };
      if (!editRep) payload.password = form.password;

      if (editRep) {
        await updateRep(editRep.id, payload);
        setSuccess(ar ? "تم تحديث بيانات المندوب" : "Rep updated");
      } else {
        const res = await createRep(payload);
        const data = res.data;
        if (!data?.rep_code) throw new Error(data?.detail || "خطأ");
        setSuccess(ar ? `تم إنشاء المندوب ${data.rep_code}` : `Rep ${data.rep_code} created`);
      }
      setShowAdd(false); load();
    } catch (e: any) { setError(e.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (rep: any) => {
    await updateRep(rep.id, { is_active: !rep.is_active });
    load();
  };

  const filtered = reps.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.full_name?.toLowerCase().includes(q) || r.rep_code?.toLowerCase().includes(q) || r.zone?.toLowerCase().includes(q) || r.vehicle_plate?.toLowerCase().includes(q);
    const matchActive = filterActive === "all" || (filterActive === "active" ? r.is_active : !r.is_active);
    return matchSearch && matchActive;
  });

  const totalSales = Object.values(summaries).reduce((s, m) => s + Number(m?.total_sales || 0), 0);
  const totalCollected = Object.values(summaries).reduce((s, m) => s + Number(m?.total_collected || 0), 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <span>{ar ? "المناديب" : "Sales Reps"}</span>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "إدارة المناديب" : "Manage"}</span>
          </div>
          <h1 className="page-title">{ar ? "إدارة المناديب" : "Sales Reps"}</h1>
          <p className="page-subtitle">{ar ? "إدارة فريق المبيعات الميداني — البيانات الشخصية والسيارات والأهداف" : "Manage field sales team — personal data, vehicles and targets"}</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          + {ar ? "مندوب جديد" : "New Rep"}
        </button>
      </div>

      {/* ملخص سريع */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي المناديب" : "Total Reps", value: fmtNum(reps.length), color: "#587795" },
          { label: ar ? "المناديب النشطين" : "Active", value: fmtNum(reps.filter(r => r.is_active).length), color: "#059669" },
          { label: ar ? "إجمالي المبيعات" : "Total Sales", value: fmt(totalSales) + " SAR", color: "#5D7E9F" },
          { label: ar ? "إجمالي المحصّل" : "Collected", value: fmt(totalCollected) + " SAR", color: "#D97706" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* رسائل */}
      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#DC2626", fontSize: 13 }}>{error}</div>}
      {success && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#059669", fontSize: 13 }}>{success}</div>}

      {/* أدوات البحث */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <input className="form-input" style={{ width: 260 }}
            placeholder={ar ? "بحث بالاسم أو الكود أو المنطقة أو اللوحة..." : "Search by name, code, zone or plate..."}
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="form-input form-select" style={{ width: 140 }} value={filterActive} onChange={e => setFilterActive(e.target.value as any)}>
            <option value="all">{ar ? "الكل" : "All"}</option>
            <option value="active">{ar ? "نشط" : "Active"}</option>
            <option value="inactive">{ar ? "موقوف" : "Inactive"}</option>
          </select>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
            {filtered.length} {ar ? "مندوب" : "reps"}
          </span>
        </div>
      </div>

      {/* جدول المناديب */}
      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{ar ? "لا يوجد مناديب" : "No reps found"}</div>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={openAdd}>
                {ar ? "+ مندوب جديد" : "+ New Rep"}
              </button>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "المندوب" : "Rep"}</th>
                  <th>{ar ? "المنطقة" : "Zone"}</th>
                  <th>{ar ? "السيارة / اللوحة" : "Vehicle / Plate"}</th>
                  <th>{ar ? "الهدف الشهري" : "Monthly Target"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المبيعات" : "Sales"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المحصّل" : "Collected"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المستحق" : "Outstanding"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th>{ar ? "الإجراءات" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(rep => {
                  const sum = summaries[rep.id];
                  const pct = rep.target_monthly > 0 ? Math.min(100, Math.round((Number(sum?.total_sales || 0) / Number(rep.target_monthly)) * 100)) : null;
                  return (
                    <tr key={rep.id}>
                      <td>
                        <Link href={`/${locale}/reps/${rep.id}`} style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                          {rep.full_name}
                        </Link>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {rep.rep_code}
                          {rep.phone ? ` · ${rep.phone}` : ""}
                        </div>
                        {rep.id_number && (
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{ar ? "هوية:" : "ID:"} {rep.id_number}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{rep.zone || "—"}</td>
                      <td>
                        {rep.vehicle_plate ? (
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{rep.vehicle_plate}</div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {[rep.vehicle_type, rep.vehicle_color].filter(Boolean).join(" · ") || "—"}
                            </div>
                          </div>
                        ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                      </td>
                      <td>
                        {rep.target_monthly > 0 ? (
                          <div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmt(rep.target_monthly)} SAR</div>
                            {pct !== null && (
                              <div style={{ marginTop: 4 }}>
                                <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#587795", borderRadius: 2 }} />
                                </div>
                                <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{pct}%</div>
                              </div>
                            )}
                          </div>
                        ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(sum?.total_sales || 0)}</td>
                      <td style={{ textAlign: "end", color: "#059669", fontWeight: 600 }}>{fmt(sum?.total_collected || 0)}</td>
                      <td style={{ textAlign: "end", color: Number(sum?.outstanding || 0) > 0 ? "#DC2626" : "var(--text-secondary)", fontWeight: 600 }}>
                        {fmt(sum?.outstanding || 0)}
                      </td>
                      <td>
                        <span className={`badge ${rep.is_active ? "badge-success" : "badge-gray"}`}>
                          {rep.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <Link href={`/${locale}/reps/${rep.id}`} className="btn btn-ghost btn-sm btn-icon" title={ar ? "تفاصيل" : "Details"}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </Link>
                          <button
                            className="btn btn-ghost btn-sm btn-icon"
                            title={ar ? "الدخول كمندوب" : "View as Rep"}
                            onClick={() => handleViewAsRep(rep)}
                            style={{ color: "#5D7E9F" }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                              <polyline points="10 17 15 12 10 7"/>
                              <line x1="15" y1="12" x2="3" y2="12"/>
                            </svg>
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" title={ar ? "تعديل" : "Edit"} onClick={() => openEdit(rep)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          </button>
                          <button className="btn btn-ghost btn-sm btn-icon" title={rep.is_active ? (ar ? "إيقاف" : "Deactivate") : (ar ? "تفعيل" : "Activate")}
                            onClick={() => toggleActive(rep)}
                            style={{ color: rep.is_active ? "#DC2626" : "#059669" }}>
                            {rep.is_active
                              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/></svg>
                              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11 14 15 10"/></svg>
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal إضافة / تعديل */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            {/* رأس النافذة */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700 }}>
                {editRep ? (ar ? "تعديل بيانات المندوب" : "Edit Rep") : (ar ? "إضافة مندوب جديد" : "Add New Rep")}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAdd(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div style={{ overflowY: "auto", flex: 1, padding: 24 }}>
              {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#DC2626", fontSize: 13 }}>{error}</div>}

              {/* بيانات الحساب */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {ar ? "بيانات الحساب" : "Account"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">{ar ? "الاسم الكامل" : "Full Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "البريد الإلكتروني" : "Email"} <span className="required">*</span></label>
                  <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} disabled={!!editRep} />
                </div>
                {!editRep && (
                  <div className="form-group">
                    <label className="form-label">{ar ? "كلمة المرور" : "Password"} <span className="required">*</span></label>
                    <input className="form-input" type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">{ar ? "الجوال" : "Phone"}</label>
                  <input className="form-input" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "المنطقة / المسار" : "Zone / Route"}</label>
                  <input className="form-input" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))} />
                </div>
              </div>

              {/* بيانات الهوية */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {ar ? "بيانات الهوية" : "Identity"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">{ar ? "رقم الهوية" : "ID Number"}</label>
                  <input className="form-input" value={form.id_number} onChange={e => setForm(p => ({ ...p, id_number: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "انتهاء الهوية" : "ID Expiry"}</label>
                  <input className="form-input" type="date" value={form.id_expiry} onChange={e => setForm(p => ({ ...p, id_expiry: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "انتهاء رخصة القيادة" : "License Expiry"}</label>
                  <input className="form-input" type="date" value={form.license_expiry} onChange={e => setForm(p => ({ ...p, license_expiry: e.target.value }))} />
                </div>
              </div>

              {/* بيانات السيارة */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {ar ? "بيانات السيارة" : "Vehicle"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">{ar ? "لوحة السيارة" : "Plate Number"}</label>
                  <input className="form-input" style={{ fontFamily: "monospace" }} value={form.vehicle_plate} onChange={e => setForm(p => ({ ...p, vehicle_plate: e.target.value }))} placeholder="ABC-1234" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "نوع السيارة" : "Vehicle Type"}</label>
                  <input className="form-input" value={form.vehicle_type} onChange={e => setForm(p => ({ ...p, vehicle_type: e.target.value }))} placeholder={ar ? "هايلكس، هيلوكس..." : "Hilux, Hiace..."} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "لون السيارة" : "Color"}</label>
                  <input className="form-input" value={form.vehicle_color} onChange={e => setForm(p => ({ ...p, vehicle_color: e.target.value }))} placeholder={ar ? "أبيض، فضي..." : "White, Silver..."} />
                </div>
              </div>

              {/* الأهداف والعمولة */}
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {ar ? "الأهداف والعمولة" : "Targets & Commission"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
                <div className="form-group">
                  <label className="form-label">{ar ? "الهدف الشهري (SAR)" : "Monthly Target (SAR)"}</label>
                  <input className="form-input" type="number" min="0" value={form.target_monthly} onChange={e => setForm(p => ({ ...p, target_monthly: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "نسبة العمولة %" : "Commission %"}</label>
                  <input className="form-input" type="number" min="0" max="100" step="0.5" value={form.commission_pct} onChange={e => setForm(p => ({ ...p, commission_pct: e.target.value }))} />
                </div>
              </div>

              {/* ملاحظات */}
              <div className="form-group">
                <label className="form-label">{ar ? "ملاحظات" : "Notes"}</label>
                <textarea className="form-input" rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            {/* أزرار الحفظ */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>{ar ? "إلغاء" : "Cancel"}</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? (ar ? "جاري الحفظ..." : "Saving...") : editRep ? (ar ? "حفظ التعديلات" : "Save Changes") : (ar ? "إضافة المندوب" : "Add Rep")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
