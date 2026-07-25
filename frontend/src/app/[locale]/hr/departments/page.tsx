"use client";
import { useEffect, useState } from "react";
import { getDepartments, createDepartment, getEmployees } from "@/lib/hr";

const IcPlus     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
const IcBuilding = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="M3 9h6"/><path d="M3 15h6"/><path d="M15 9h3"/><path d="M15 15h3"/></svg>;
const IcUsers    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcClose    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

export default function DepartmentsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [departments, setDepartments] = useState<any[]>([]);
  const [employees, setEmployees]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [form, setForm] = useState({ name_ar: "", name_en: "", manager_id: "", budget: "" });

  const load = async () => {
    try {
      const [d, e] = await Promise.all([getDepartments(), getEmployees()]);
      setDepartments(d.data || []);
      setEmployees(e.data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await createDepartment({ ...form, budget: parseFloat(form.budget) || 0 });
      setShowModal(false);
      setLoading(true);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "حدث خطأ" : "An error occurred"));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  const totalEmployees = employees.length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "الأقسام" : "Departments"}</h1>
          <p className="page-subtitle">{ar ? `${departments.length} أقسام — ${totalEmployees} موظف` : `${departments.length} departments — ${totalEmployees} employees`}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ name_ar: "", name_en: "", manager_id: "", budget: "" }); setError(""); setShowModal(true); }}>
          <IcPlus />{ar ? "إضافة قسم" : "Add Department"}
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#EFF6FF", color: "#2563EB" }}><IcBuilding /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "عدد الأقسام" : "Departments"}</div>
            <div className="stat-value">{departments.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ECFDF5", color: "#059669" }}><IcUsers /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الموظفين" : "Total Employees"}</div>
            <div className="stat-value">{totalEmployees}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FEF2F2", color: "#DC2626" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الميزانية" : "Total Budget"}</div>
            <div className="stat-value">{departments.reduce((s: number, d: any) => s + Number(d.budget || 0), 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ar ? "ر.س / شهر" : "SAR / month"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{ar ? "قائمة الأقسام" : "Departments List"}</span></div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "القسم" : "Department"}</th>
                <th>{ar ? "المدير" : "Manager"}</th>
                <th>{ar ? "الميزانية الشهرية" : "Monthly Budget"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>{ar ? "لا توجد أقسام بعد" : "No departments yet"}</td></tr>
              ) : departments.map((dept: any) => (
                <tr key={dept.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#2563EB", flexShrink: 0 }}><IcBuilding /></div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{dept.name_ar}</div>
                        {dept.name_en && <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{dept.name_en}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{employees.find((e: any) => e.id === dept.manager_id)?.full_name_ar || "—"}</td>
                  <td><span style={{ fontWeight: 600 }}>{Number(dept.budget || 0).toLocaleString()}</span> <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "ر.س" : "SAR"}</span></td>
                  <td><span className={dept.is_active ? "badge badge-success" : "badge badge-gray"}>{dept.is_active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 480, borderRadius: 16 }}>
            <div className="card-header">
              <span className="card-title">{ar ? "إضافة قسم جديد" : "Add New Department"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><IcClose /></button>
            </div>
            <div className="card-body">
              {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">{ar ? "اسم القسم" : "Department Name"} <span className="required">*</span></label>
                  <input className="form-input" value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} required placeholder={ar ? "مثال: المحاسبة" : "e.g. Accounting"} />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "المدير المسؤول" : "Manager"}</label>
                  <select className="form-input form-select" value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}>
                    <option value="">{ar ? "بدون مدير" : "No Manager"}</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.full_name_ar}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "الميزانية الشهرية (ر.س)" : "Monthly Budget (SAR)"}</label>
                  <input type="number" className="form-input" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: e.target.value }))} min="0" placeholder="0" />
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ" : "Save")}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
