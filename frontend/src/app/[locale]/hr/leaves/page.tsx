"use client";
import { useEffect, useState, use } from "react";
import { getLeaves, approveLeave, rejectLeave, createLeave, getEmployees } from "@/lib/hr";

const IcCheck    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcX        = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcCalendar = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcClose    = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

type TabKey = "pending" | "approved" | "rejected";

const leaveTypeLabels: Record<string, { ar: string; en: string }> = {
  annual:    { ar: "سنوية",  en: "Annual" },
  sick:      { ar: "مرضية",  en: "Sick" },
  emergency: { ar: "طارئة",  en: "Emergency" },
  maternity: { ar: "أمومة",  en: "Maternity" },
  unpaid:    { ar: "بدون راتب", en: "Unpaid" },
};

export default function LeavesPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [leaves, setLeaves]       = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [form, setForm] = useState({ employee_id: "", leave_type: "annual", from_date: "", to_date: "", days: "1", reason: "" });

  const load = async () => {
    setLoading(true);
    try {
      const [l, e] = await Promise.all([getLeaves(), getEmployees()]);
      setLeaves(l.data || []);
      setEmployees(e.data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = leaves.filter(l => l.status === activeTab);
  const counts = { pending: leaves.filter(l => l.status === "pending").length, approved: leaves.filter(l => l.status === "approved").length, rejected: leaves.filter(l => l.status === "rejected").length };

  const handleApprove = async (id: string) => {
    try { await approveLeave(id); await load(); } catch {}
  };
  const handleReject = async (id: string) => {
    try { await rejectLeave(id); await load(); } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      await createLeave({ ...form, days: parseInt(form.days) || 1 });
      setShowModal(false);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "حدث خطأ" : "An error occurred"));
    } finally { setSaving(false); }
  };

  const tabs = [
    { key: "pending"  as TabKey, ar: "معلقة",   en: "Pending" },
    { key: "approved" as TabKey, ar: "مقبولة",  en: "Approved" },
    { key: "rejected" as TabKey, ar: "مرفوضة", en: "Rejected" },
  ];

  if (loading) return <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "إدارة الإجازات" : "Leave Management"}</h1>
          <p className="page-subtitle">{ar ? "مراجعة وإدارة طلبات الإجازة" : "Review and manage leave requests"}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ employee_id: "", leave_type: "annual", from_date: "", to_date: "", days: "1", reason: "" }); setError(""); setShowModal(true); }}>
          <IcCalendar />{ar ? "طلب إجازة" : "Request Leave"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{ padding: "10px 20px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: activeTab === tab.key ? "var(--primary)" : "var(--text-secondary)", borderBottom: activeTab === tab.key ? "2px solid var(--primary)" : "2px solid transparent", marginBottom: -1, display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
            {ar ? tab.ar : tab.en}
            <span style={{ background: activeTab === tab.key ? "var(--primary)" : "var(--border)", color: activeTab === tab.key ? "white" : "var(--text-secondary)", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{counts[tab.key]}</span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "الموظف" : "Employee"}</th>
                <th>{ar ? "نوع الإجازة" : "Type"}</th>
                <th>{ar ? "من" : "From"}</th>
                <th>{ar ? "إلى" : "To"}</th>
                <th>{ar ? "الأيام" : "Days"}</th>
                <th>{ar ? "السبب" : "Reason"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
                {activeTab === "pending" && <th>{ar ? "إجراء" : "Action"}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>{ar ? "لا توجد طلبات" : "No requests"}</td></tr>
              ) : filtered.map((req: any) => {
                const emp = employees.find(e => e.id === req.employee_id);
                const typeLabel = leaveTypeLabels[req.leave_type] || { ar: req.leave_type, en: req.leave_type };
                return (
                  <tr key={req.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #5A187E, #75617F)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                          {emp?.full_name_ar?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{emp?.full_name_ar || req.employee_id}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{emp?.job_title_ar || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-info">{ar ? typeLabel.ar : typeLabel.en}</span></td>
                    <td style={{ fontSize: 12 }}>{req.from_date}</td>
                    <td style={{ fontSize: 12 }}>{req.to_date}</td>
                    <td style={{ fontWeight: 600 }}>{req.days} {ar ? "أيام" : "days"}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{req.reason || "—"}</td>
                    <td>
                      {req.status === "pending"  && <span className="badge badge-warning">{ar ? "معلق" : "Pending"}</span>}
                      {req.status === "approved" && <span className="badge badge-success">{ar ? "مقبول" : "Approved"}</span>}
                      {req.status === "rejected" && <span className="badge badge-danger">{ar ? "مرفوض" : "Rejected"}</span>}
                    </td>
                    {activeTab === "pending" && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm" style={{ background: "#F0E7F4", color: "#3E0865", gap: 4 }} onClick={() => handleApprove(req.id)}><IcCheck />{ar ? "قبول" : "Approve"}</button>
                          <button className="btn btn-sm" style={{ background: "#FEE2E2", color: "#991B1B", gap: 4 }} onClick={() => handleReject(req.id)}><IcX />{ar ? "رفض" : "Reject"}</button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card" style={{ width: "100%", maxWidth: 480, borderRadius: 16 }}>
            <div className="card-header">
              <span className="card-title">{ar ? "طلب إجازة" : "Leave Request"}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><IcClose /></button>
            </div>
            <div className="card-body">
              {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">{ar ? "الموظف" : "Employee"} <span className="required">*</span></label>
                  <select className="form-input form-select" value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))} required>
                    <option value="">{ar ? "اختر موظفاً" : "Select Employee"}</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.full_name_ar}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "نوع الإجازة" : "Leave Type"}</label>
                  <select className="form-input form-select" value={form.leave_type} onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}>
                    {Object.entries(leaveTypeLabels).map(([k, v]) => <option key={k} value={k}>{ar ? v.ar : v.en}</option>)}
                  </select>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">{ar ? "من" : "From"} <span className="required">*</span></label>
                    <input type="date" className="form-input" value={form.from_date} onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{ar ? "إلى" : "To"} <span className="required">*</span></label>
                    <input type="date" className="form-input" value={form.to_date} onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))} required />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "عدد الأيام" : "Days"} <span className="required">*</span></label>
                  <input type="number" className="form-input" value={form.days} onChange={e => setForm(f => ({ ...f, days: e.target.value }))} required min="1" />
                </div>
                <div className="form-group">
                  <label className="form-label">{ar ? "السبب" : "Reason"}</label>
                  <textarea className="form-input" rows={3} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} style={{ resize: "vertical" }} />
                </div>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{ar ? "إلغاء" : "Cancel"}</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "إرسال" : "Submit")}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
