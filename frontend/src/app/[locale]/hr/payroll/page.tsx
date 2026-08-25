"use client";
import { useEffect, useState, use } from "react";
import { getPayroll, generatePayroll, confirmPayroll } from "@/lib/hr";

const IcDollar   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcUsers    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcCheck    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcClock    = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;

const months = [
  { v: 1, ar: "يناير", en: "January" }, { v: 2, ar: "فبراير", en: "February" },
  { v: 3, ar: "مارس", en: "March" },    { v: 4, ar: "أبريل", en: "April" },
  { v: 5, ar: "مايو", en: "May" },      { v: 6, ar: "يونيو", en: "June" },
  { v: 7, ar: "يوليو", en: "July" },    { v: 8, ar: "أغسطس", en: "August" },
  { v: 9, ar: "سبتمبر", en: "September" }, { v: 10, ar: "أكتوبر", en: "October" },
  { v: 11, ar: "نوفمبر", en: "November" }, { v: 12, ar: "ديسمبر", en: "December" },
];

export default function PayrollPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getPayroll({ month, year });
      setRecords(data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [month, year]);

  const handleGenerate = async () => {
    setGenerating(true); setError("");
    try {
      await generatePayroll(month, year);
      await load();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : (ar ? "حدث خطأ" : "An error occurred"));
    } finally { setGenerating(false); }
  };

  const handleConfirm = async () => {
    if (!confirm(ar ? "هل تريد تأكيد صرف الرواتب؟" : "Confirm payroll processing?")) return;
    setConfirming(true);
    try { await confirmPayroll(month, year); await load(); }
    catch {} finally { setConfirming(false); }
  };

  const totalNet     = records.reduce((s, r) => s + Number(r.net_salary || 0), 0);
  const paidCount    = records.filter(r => r.status === "paid").length;
  const pendingCount = records.filter(r => r.status !== "paid").length;
  const paidAmount   = records.filter(r => r.status === "paid").reduce((s, r) => s + Number(r.net_salary || 0), 0);
  const pendingAmount= records.filter(r => r.status !== "paid").reduce((s, r) => s + Number(r.net_salary || 0), 0);
  const currentMonth = months.find(m => m.v === month);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "مسير الرواتب" : "Payroll"}</h1>
          <p className="page-subtitle">{ar ? "إدارة رواتب الموظفين الشهرية" : "Manage monthly employee salaries"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {records.length === 0 && (
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? (ar ? "جاري التوليد..." : "Generating...") : (ar ? "توليد مسير الرواتب" : "Generate Payroll")}
            </button>
          )}
          {records.some(r => r.status === "draft") && (
            <button className="btn btn-primary" onClick={handleConfirm} disabled={confirming}>
              {confirming ? (ar ? "جاري التأكيد..." : "Confirming...") : (ar ? "تأكيد صرف الرواتب" : "Confirm Payroll")}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#DC2626", marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label className="form-label" style={{ margin: 0 }}>{ar ? "الفترة:" : "Period:"}</label>
            <select className="form-input form-select" style={{ width: "auto" }} value={month} onChange={e => setMonth(Number(e.target.value))}>
              {months.map(m => <option key={m.v} value={m.v}>{ar ? m.ar : m.en}</option>)}
            </select>
            <select className="form-input form-select" style={{ width: "auto" }} value={year} onChange={e => setYear(Number(e.target.value))}>
              {[now.getFullYear(), now.getFullYear() - 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#EFF6FF", color: "#485668" }}><IcDollar /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "إجمالي الرواتب" : "Total Payroll"}</div>
            <div className="stat-value">{totalNet.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ar ? "ر.س" : "SAR"}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#F5F3FF", color: "#65707E" }}><IcUsers /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "عدد الموظفين" : "Employees"}</div>
            <div className="stat-value">{records.length}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ECFDF5", color: "#059669" }}><IcCheck /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "المدفوع" : "Paid"}</div>
            <div className="stat-value" style={{ color: "#059669" }}>{paidAmount.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{paidCount} {ar ? "موظف" : "employees"}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FFFBEB", color: "#D97706" }}><IcClock /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "المعلق" : "Pending"}</div>
            <div className="stat-value" style={{ color: "#D97706" }}>{pendingAmount.toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{pendingCount} {ar ? "موظف" : "employees"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? `كشف رواتب ${currentMonth?.[ar ? "ar" : "en"]} ${year}` : `Payroll — ${currentMonth?.en} ${year}`}</span>
        </div>
        {loading ? (
          <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
        ) : records.length === 0 ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <div className="empty-state-title">{ar ? "لا يوجد مسير رواتب لهذا الشهر" : "No payroll for this month"}</div>
            <div className="empty-state-desc" style={{ marginBottom: 16 }}>{ar ? "اضغط على 'توليد مسير الرواتب' لإنشائه" : "Click 'Generate Payroll' to create it"}</div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الموظف" : "Employee"}</th>
                  <th>{ar ? "الراتب الأساسي" : "Basic"}</th>
                  <th>{ar ? "البدلات" : "Allowances"}</th>
                  <th>{ar ? "الخصومات" : "Deductions"}</th>
                  <th>{ar ? "الصافي" : "Net"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec: any) => (
                  <tr key={rec.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #485668, #65707E)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                          {rec.employee?.full_name_ar?.charAt(0) || "?"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{rec.employee?.full_name_ar || rec.employee_id}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rec.employee?.job_title_ar || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td>{Number(rec.basic_salary || 0).toLocaleString()}</td>
                    <td style={{ color: "#059669" }}>+{(Number(rec.housing_allowance || 0) + Number(rec.transport_allowance || 0) + Number(rec.other_allowances || 0)).toLocaleString()}</td>
                    <td style={{ color: "#DC2626" }}>-{Number(rec.total_deductions || 0).toLocaleString()}</td>
                    <td style={{ fontWeight: 700 }}>{Number(rec.net_salary || 0).toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{ar ? "ر.س" : "SAR"}</span></td>
                    <td><span className={rec.status === "paid" ? "badge badge-success" : rec.status === "draft" ? "badge badge-warning" : "badge badge-info"}>{rec.status === "paid" ? (ar ? "مدفوع" : "Paid") : rec.status === "draft" ? (ar ? "مسودة" : "Draft") : (ar ? "معلق" : "Pending")}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", fontWeight: 700 }}>
                  <td style={{ fontWeight: 700 }}>{ar ? "الإجمالي" : "Total"}</td>
                  <td>{records.reduce((s, r) => s + Number(r.basic_salary || 0), 0).toLocaleString()}</td>
                  <td style={{ color: "#059669" }}>+{records.reduce((s, r) => s + Number(r.housing_allowance || 0) + Number(r.transport_allowance || 0) + Number(r.other_allowances || 0), 0).toLocaleString()}</td>
                  <td style={{ color: "#DC2626" }}>-{records.reduce((s, r) => s + Number(r.total_deductions || 0), 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 700, fontSize: 14 }}>{totalNet.toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{ar ? "ر.س" : "SAR"}</span></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
