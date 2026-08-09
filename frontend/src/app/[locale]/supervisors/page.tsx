"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupervisors, createSupervisor, assignRepsToSupervisor, getReps } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function SupervisorsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [reps, setReps]               = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [showAssign, setShowAssign]   = useState<any>(null);
  const [saving, setSaving]           = useState(false);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([getSupervisors(), getReps()]);
      setSupervisors(Array.isArray(sRes.data) ? sRes.data : []);
      setReps(Array.isArray(rRes.data) ? rRes.data : []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      setError(ar ? "يرجى ملء جميع الحقول المطلوبة" : "Fill required fields"); return;
    }
    setSaving(true); setError("");
    try {
      await createSupervisor(form);
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", phone: "" });
      load();
    } catch (e: any) { setError(e?.response?.data?.detail || "Error"); }
    finally { setSaving(false); }
  };

  const handleAssign = async () => {
    if (!showAssign) return;
    setSaving(true);
    try {
      await assignRepsToSupervisor(showAssign.id, selectedReps);
      setShowAssign(null);
      load();
    } catch {} finally { setSaving(false); }
  };

  const openAssign = (sup: any) => {
    setShowAssign(sup);
    setSelectedReps(sup.reps?.map((r: any) => r.id) || []);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "المشرفون" : "Supervisors"}</span>
          </div>
          <h1 className="page-title">{ar ? "إدارة المشرفين" : "Supervisors"}</h1>
          <p className="page-subtitle">{ar ? "تعيين المشرفين ومناديبهم" : "Manage supervisors and their reps"}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setError(""); }}>
          + {ar ? "مشرف جديد" : "New Supervisor"}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : supervisors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">{ar ? "لا يوجد مشرفون بعد" : "No supervisors yet"}</div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + {ar ? "أضف مشرفاً" : "Add Supervisor"}
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
          {supervisors.map((sup: any) => (
            <div key={sup.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{sup.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{sup.email}</div>
                  {sup.phone && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{sup.phone}</div>}
                </div>
                <span className={`badge ${sup.is_active ? "badge-success" : "badge-danger"}`}>
                  {sup.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                </span>
              </div>

              {/* المناديب المعيّنون */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, fontWeight: 600 }}>
                  {ar ? "المناديب" : "Assigned Reps"} ({sup.rep_count || 0})
                </div>
                {sup.reps && sup.reps.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {sup.reps.map((r: any) => (
                      <span key={r.id} style={{ background: "#EFF6FF", color: "#2563EB",
                        padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {r.rep_code}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {ar ? "لم يُعيَّن مناديب بعد" : "No reps assigned"}
                  </div>
                )}
              </div>

              <button className="btn btn-secondary btn-sm" onClick={() => openAssign(sup)}>
                {ar ? "تعيين المناديب" : "Assign Reps"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal إنشاء مشرف */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 460, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              {ar ? "مشرف جديد" : "New Supervisor"}
            </h3>
            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
                padding: "10px 14px", marginBottom: 14, color: "#DC2626", fontSize: 13 }}>{error}</div>
            )}
            {[
              { key: "name", label: ar ? "الاسم *" : "Name *", type: "text" },
              { key: "email", label: ar ? "البريد الإلكتروني *" : "Email *", type: "email" },
              { key: "password", label: ar ? "كلمة المرور *" : "Password *", type: "password" },
              { key: "phone", label: ar ? "الجوال" : "Phone", type: "text" },
            ].map(f => (
              <div key={f.key} className="form-group">
                <label className="form-label">{f.label}</label>
                <input type={f.type} className="form-input"
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? "..." : (ar ? "إنشاء المشرف" : "Create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal تعيين المناديب */}
      {showAssign && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 500,
            padding: 24, maxHeight: "80vh", overflowY: "auto" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
              {ar ? "تعيين المناديب" : "Assign Reps"} — {showAssign.name}
            </h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              {ar ? "اختر المناديب الذين سيشرف عليهم هذا المشرف" : "Select reps for this supervisor"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {reps.map((rep: any) => (
                <label key={rep.id} style={{ display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 8, border: "1px solid var(--border)",
                  cursor: "pointer", background: selectedReps.includes(rep.id) ? "#EFF6FF" : "white" }}>
                  <input type="checkbox"
                    checked={selectedReps.includes(rep.id)}
                    onChange={e => {
                      if (e.target.checked) setSelectedReps(p => [...p, rep.id]);
                      else setSelectedReps(p => p.filter(id => id !== rep.id));
                    }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{rep.full_name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {rep.rep_code} {rep.zone ? `· ${rep.zone}` : ""}
                    </div>
                  </div>
                  <span style={{ marginInlineStart: "auto", fontSize: 11, fontWeight: 600,
                    color: rep.is_active ? "#059669" : "#DC2626" }}>
                    {rep.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowAssign(null)}>
                {ar ? "إلغاء" : "Cancel"}
              </button>
              <button className="btn btn-primary" onClick={handleAssign} disabled={saving}>
                {saving ? "..." : `${ar ? "حفظ" : "Save"} (${selectedReps.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
