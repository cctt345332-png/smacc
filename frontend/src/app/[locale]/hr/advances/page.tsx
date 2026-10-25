"use client";
import { useEffect, useState, use } from "react";
import { getEmployees, getAdvances, createAdvance, approveAdvance, rejectAdvance } from "@/lib/hr";

export default function AdvancesPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params); const ar = locale === "ar"; const now = new Date();
  const [employees, setEmployees] = useState<any[]>([]); const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ employee_id: "", total_amount: "", monthly_installment: "", start_month: String(now.getMonth() + 1), start_year: String(now.getFullYear()), reason: "" });
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const load = async () => { try { const [e, a] = await Promise.all([getEmployees({ status: "active" }), getAdvances()]); setEmployees(e.data || []); setRows(a.data || []); } catch {} };
  useEffect(() => { load(); }, []);
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setSaving(true); setError(""); try { await createAdvance({ ...form, total_amount: Number(form.total_amount), monthly_installment: Number(form.monthly_installment), start_month: Number(form.start_month), start_year: Number(form.start_year) }); setForm({ ...form, total_amount: "", monthly_installment: "", reason: "" }); await load(); } catch (err: any) { setError(err?.response?.data?.detail || (ar ? "تعذر إنشاء السلفة" : "Could not create advance")); } finally { setSaving(false); } };
  const act = async (id: string, approve: boolean) => { try { if (approve) await approveAdvance(id); else await rejectAdvance(id); await load(); } catch (err: any) { setError(err?.response?.data?.detail || "Error"); } };
  const status = (s: string) => s === "active" ? (ar ? "معتمدة" : "Active") : s === "completed" ? (ar ? "مكتملة" : "Completed") : s === "rejected" ? (ar ? "مرفوضة" : "Rejected") : (ar ? "بانتظار الاعتماد" : "Pending");
  return <div>
    <div className="page-header"><div><h1 className="page-title">{ar ? "السلف والقروض" : "Advances & loans"}</h1><p className="page-subtitle">{ar ? "إدارة السلف وخصم الأقساط تلقائيًا من مسير الرواتب" : "Manage advances and payroll installments"}</p></div></div>
    {error && <div style={{ background: "#FEF2F2", color: "#DC2626", padding: 10, borderRadius: 8, marginBottom: 16 }}>{error}</div>}
    <div className="card" style={{ marginBottom: 20 }}><div className="card-header"><span className="card-title">{ar ? "طلب سلفة جديد" : "New advance request"}</span></div><div className="card-body"><form onSubmit={submit}><div className="grid-3">
      <div className="form-group"><label className="form-label">{ar ? "الموظف" : "Employee"}</label><select required className="form-input form-select" value={form.employee_id} onChange={e => setForm({ ...form, employee_id: e.target.value })}><option value="">{ar ? "اختر الموظف" : "Select"}</option>{employees.map(x => <option key={x.id} value={x.id}>{x.full_name_ar}</option>)}</select></div>
      <div className="form-group"><label className="form-label">{ar ? "إجمالي السلفة" : "Total amount"}</label><input required min="1" type="number" className="form-input" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })} /></div>
      <div className="form-group"><label className="form-label">{ar ? "القسط الشهري" : "Monthly installment"}</label><input required min="1" type="number" className="form-input" value={form.monthly_installment} onChange={e => setForm({ ...form, monthly_installment: e.target.value })} /></div>
      <div className="form-group"><label className="form-label">{ar ? "شهر البداية" : "Start month"}</label><input required min="1" max="12" type="number" className="form-input" value={form.start_month} onChange={e => setForm({ ...form, start_month: e.target.value })} /></div>
      <div className="form-group"><label className="form-label">{ar ? "السنة" : "Year"}</label><input required type="number" className="form-input" value={form.start_year} onChange={e => setForm({ ...form, start_year: e.target.value })} /></div>
      <div className="form-group"><label className="form-label">{ar ? "السبب" : "Reason"}</label><input className="form-input" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
    </div><button className="btn btn-primary" disabled={saving}>{saving ? (ar ? "حفظ..." : "Saving...") : (ar ? "إنشاء طلب السلفة" : "Create request")}</button></form></div></div>
    <div className="card"><div className="card-header"><span className="card-title">{ar ? "السلف المسجلة" : "Recorded advances"}</span></div><div className="table-wrapper"><table><thead><tr><th>{ar ? "الموظف" : "Employee"}</th><th>{ar ? "الإجمالي" : "Total"}</th><th>{ar ? "القسط" : "Installment"}</th><th>{ar ? "المتبقي" : "Remaining"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "إجراء" : "Action"}</th></tr></thead><tbody>{rows.map(x => <tr key={x.id}><td>{x.employee?.full_name_ar || x.employee_id}</td><td>{Number(x.total_amount).toLocaleString()}</td><td>{Number(x.monthly_installment).toLocaleString()}</td><td>{Math.max(0, Number(x.total_amount) - Number(x.paid_amount)).toLocaleString()}</td><td>{status(x.status)}</td><td>{x.status === "pending" && <><button className="btn btn-primary" onClick={() => act(x.id, true)}>{ar ? "اعتماد" : "Approve"}</button> <button className="btn btn-secondary" onClick={() => act(x.id, false)}>{ar ? "رفض" : "Reject"}</button></>}</td></tr>)}</tbody></table></div></div>
  </div>;
}
