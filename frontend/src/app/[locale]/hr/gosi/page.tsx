"use client";
import { useEffect, useState, use } from "react";
import { getGOSI } from "@/lib/hr";

const IcShield   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcDollar   = () => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>;
const IcInfo     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;

const months = [
  { v: 1, ar: "يناير", en: "January" }, { v: 2, ar: "فبراير", en: "February" },
  { v: 3, ar: "مارس", en: "March" },    { v: 4, ar: "أبريل", en: "April" },
  { v: 5, ar: "مايو", en: "May" },      { v: 6, ar: "يونيو", en: "June" },
  { v: 7, ar: "يوليو", en: "July" },    { v: 8, ar: "أغسطس", en: "August" },
  { v: 9, ar: "سبتمبر", en: "September" }, { v: 10, ar: "أكتوبر", en: "October" },
  { v: 11, ar: "نوفمبر", en: "November" }, { v: 12, ar: "ديسمبر", en: "December" },
];

export default function GosiPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [data, setData]   = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data: d } = await getGOSI(month, year);
      setData(d);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [month, year]);

  const currentMonth = months.find(m => m.v === month);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "التأمينات الاجتماعية — GOSI" : "GOSI — Social Insurance"}</h1>
          <p className="page-subtitle">{ar ? "إدارة اشتراكات التأمينات الاجتماعية للموظفين" : "Manage employee social insurance contributions"}</p>
        </div>
      </div>

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

      {/* معلومات الاشتراك */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><IcShield />{ar ? "معلومات الاشتراك" : "Subscription Info"}</span>
        </div>
        <div className="card-body">
          <div className="grid-3">
            <div style={{ padding: "16px 20px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{ar ? "نسبة صاحب العمل" : "Employer Rate"}</div>
              <div style={{ fontWeight: 700, fontSize: 28, color: "#2563EB" }}>{data?.employer_rate ?? 9}%</div>
            </div>
            <div style={{ padding: "16px 20px", background: "#F5F3FF", borderRadius: 10, border: "1px solid #DDD6FE" }}>
              <div style={{ fontSize: 12, color: "#5B21B6", marginBottom: 6 }}>{ar ? "نسبة الموظف" : "Employee Rate"}</div>
              <div style={{ fontWeight: 700, fontSize: 28, color: "#7C3AED" }}>{data?.employee_rate ?? 9}%</div>
            </div>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)", borderRadius: 10, border: "1px solid #BFDBFE" }}>
              <div style={{ fontSize: 12, color: "#1E40AF", marginBottom: 6 }}>{ar ? "إجمالي GOSI الشهر" : "Total GOSI"}</div>
              <div style={{ fontWeight: 700, fontSize: 24, color: "#2563EB" }}>{Number(data?.grand_total ?? 0).toLocaleString()} <span style={{ fontSize: 13, fontWeight: 400 }}>{ar ? "ر.س" : "SAR"}</span></div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginTop: 16, padding: "12px 16px", background: "#FFFBEB", borderRadius: 8, border: "1px solid #FDE68A" }}>
            <span style={{ color: "#D97706", flexShrink: 0, marginTop: 1 }}><IcInfo /></span>
            <p style={{ fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>
              {ar ? "يُحسب الراتب الخاضع للتأمينات على أساس الراتب الأساسي فقط. الحد الأقصى 45,000 ريال شهرياً." : "GOSI is calculated on basic salary only. Maximum eligible salary is SAR 45,000/month."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#EFF6FF", color: "#2563EB" }}><IcDollar /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "حصة صاحب العمل" : "Employer Total"}</div>
            <div className="stat-value">{Number(data?.total_employer ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ar ? "ر.س" : "SAR"}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#F5F3FF", color: "#7C3AED" }}><IcDollar /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "حصة الموظفين" : "Employees Total"}</div>
            <div className="stat-value">{Number(data?.total_employee ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{ar ? "ر.س" : "SAR"}</div>
          </div>
        </div>
        <div className="stat-card" style={{ background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)", border: "1px solid #BFDBFE" }}>
          <div className="stat-icon" style={{ background: "white", color: "#2563EB" }}><IcShield /></div>
          <div className="stat-content">
            <div className="stat-label">{ar ? "الإجمالي" : "Grand Total"}</div>
            <div className="stat-value" style={{ color: "#2563EB" }}>{Number(data?.grand_total ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 2 }}>{ar ? "ر.س" : "SAR"}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? `تفاصيل GOSI — ${currentMonth?.[ar ? "ar" : "en"]} ${year}` : `GOSI Details — ${currentMonth?.en} ${year}`}</span>
        </div>
        {loading ? (
          <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
        ) : !data?.lines?.length ? (
          <div className="empty-state" style={{ padding: "40px 20px" }}>
            <div className="empty-state-title">{ar ? "لا توجد بيانات لهذا الشهر" : "No data for this month"}</div>
            <div className="empty-state-desc">{ar ? "يجب توليد مسير الرواتب أولاً" : "Generate payroll first"}</div>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الموظف" : "Employee"}</th>
                  <th>{ar ? "الراتب الخاضع" : "Eligible Salary"}</th>
                  <th>{ar ? `حصة صاحب العمل (${data?.employer_rate}%)` : `Employer (${data?.employer_rate}%)`}</th>
                  <th>{ar ? `حصة الموظف (${data?.employee_rate}%)` : `Employee (${data?.employee_rate}%)`}</th>
                  <th>{ar ? "الإجمالي" : "Total"}</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((line: any, i: number) => (
                  <tr key={i}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #2563EB, #7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                          {line.employee_name?.charAt(0) || "?"}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{line.employee_name}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{Number(line.basic_salary || 0).toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{ar ? "ر.س" : "SAR"}</span></td>
                    <td style={{ color: "#2563EB", fontWeight: 600 }}>{Number(line.employer_share || 0).toLocaleString()}</td>
                    <td style={{ color: "#7C3AED", fontWeight: 600 }}>{Number(line.employee_share || 0).toLocaleString()}</td>
                    <td style={{ fontWeight: 700 }}>{Number(line.total || 0).toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{ar ? "ر.س" : "SAR"}</span></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", fontWeight: 700 }}>
                  <td style={{ fontWeight: 700 }}>{ar ? "الإجمالي" : "Total"}</td>
                  <td style={{ fontWeight: 700 }}>{Number(data?.lines?.reduce((s: number, l: any) => s + Number(l.basic_salary || 0), 0) || 0).toLocaleString()}</td>
                  <td style={{ color: "#2563EB", fontWeight: 700 }}>{Number(data?.total_employer ?? 0).toLocaleString()}</td>
                  <td style={{ color: "#7C3AED", fontWeight: 700 }}>{Number(data?.total_employee ?? 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 700, fontSize: 14 }}>{Number(data?.grand_total ?? 0).toLocaleString()} <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{ar ? "ر.س" : "SAR"}</span></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
