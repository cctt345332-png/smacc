"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getRepAttendance, getReps } from "@/lib/reps";

const saudiDate = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

const formatTime = (value?: string, ar = true) => {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString(ar ? "ar-SA" : "en-US", {
    timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

export default function RepAttendancePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [date, setDate] = useState(saudiDate());
  const [repId, setRepId] = useState("");
  const [reps, setReps] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getRepAttendance(date, repId || undefined);
      setRecords(Array.isArray(response.data?.records) ? response.data.records : []);
      setSummary(response.data?.summary || { total: 0, present: 0, absent: 0 });
    } catch (err: any) {
      setError(err?.response?.data?.detail || (ar ? "تعذر تحميل سجل الحضور." : "Could not load attendance."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getReps().then((response) => setReps(Array.isArray(response.data) ? response.data : [])).catch(() => {});
  }, []);

  useEffect(() => { void load(); }, [date, repId]);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الحضور والانصراف" : "Attendance"}</span>
          </div>
          <h1 className="page-title">{ar ? "إدارة حضور المناديب" : "Rep Attendance"}</h1>
          <p className="page-subtitle">{ar ? "متابعة حضور المناديب المسجل من لوحة المندوب بعد الساعة 5 مساءً." : "Review rep check-ins recorded from the rep dashboard after 5 PM."}</p>
        </div>
        <Link className="btn btn-secondary" href={`/${locale}/reps/manage`}>{ar ? "عودة إلى المناديب" : "Back to reps"}</Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }} className="rep-attendance-summary">
        {[
          { label: ar ? "إجمالي المناديب" : "Total reps", value: summary.total, color: "#3E0865", bg: "#F4EFF7" },
          { label: ar ? "سجلوا الحضور" : "Checked in", value: summary.present, color: "#067647", bg: "#ECFDF3" },
          { label: ar ? "لم يسجلوا" : "Not checked in", value: summary.absent, color: "#B54708", bg: "#FFFAEB" },
        ].map((item) => (
          <div className="card" key={item.label} style={{ padding: "14px 16px", background: item.bg }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 5 }}>{item.label}</div>
            <div style={{ fontSize: 24, lineHeight: 1, fontWeight: 800, color: item.color }}>{item.value}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
            {ar ? "التاريخ" : "Date"}
            <input className="form-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "var(--text-secondary)" }}>
            {ar ? "المندوب" : "Rep"}
            <select className="form-input form-select" value={repId} onChange={(event) => setRepId(event.target.value)} style={{ minWidth: 210 }}>
              <option value="">{ar ? "كل المناديب" : "All reps"}</option>
              {reps.map((rep) => <option key={rep.id} value={rep.id}>{rep.full_name} ({rep.rep_code})</option>)}
            </select>
          </label>
          <button className="btn btn-secondary" type="button" onClick={() => void load()}>{ar ? "تحديث" : "Refresh"}</button>
        </div>
      </div>

      {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 4, padding: "10px 14px", color: "#B42318", marginBottom: 12, fontSize: 13 }}>{error}</div>}

      <div className="card">
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          <table>
            <thead>
              <tr>
                <th>{ar ? "المندوب" : "Rep"}</th>
                <th>{ar ? "الكود" : "Code"}</th>
                <th>{ar ? "التاريخ" : "Date"}</th>
                <th>{ar ? "وقت الحضور" : "Check-in time"}</th>
                <th>{ar ? "الحالة" : "Status"}</th>
                <th>{ar ? "المصدر" : "Source"}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--text-muted)" }}>{ar ? "جاري تحميل سجل الحضور..." : "Loading attendance..."}</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 28, color: "var(--text-muted)" }}>{ar ? "لا توجد سجلات لهذا التاريخ." : "No attendance records for this date."}</td></tr>
              ) : records.map((record) => {
                const present = record.status === "present";
                return (
                  <tr key={record.rep_id}>
                    <td style={{ fontWeight: 700 }}>{record.rep_name}</td>
                    <td dir="ltr" style={{ fontFamily: "monospace" }}>{record.rep_code}</td>
                    <td dir="ltr">{record.attendance_date}</td>
                    <td dir="ltr" style={{ fontFamily: "monospace", fontWeight: present ? 700 : 400 }}>{formatTime(record.check_in_at, ar)}</td>
                    <td><span style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 3, fontWeight: 700, fontSize: 11, background: present ? "#ECFDF3" : "#FFFAEB", color: present ? "#067647" : "#B54708" }}>{present ? (ar ? "حاضر" : "Present") : (ar ? "لم يسجل / غائب" : "Not checked in")}</span></td>
                    <td>{present ? (ar ? "لوحة المندوب" : "Rep dashboard") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
