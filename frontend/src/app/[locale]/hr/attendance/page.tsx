"use client";
import { useEffect, useState, use } from "react";
import { getAttendance } from "@/lib/hr";

const IcCheck    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>;
const IcX        = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IcClock    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcCalendar = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;

const statusCfg: Record<string, { ar: string; en: string; badge: string }> = {
  present: { ar: "حاضر",  en: "Present",  badge: "badge-success" },
  absent:  { ar: "غائب",  en: "Absent",   badge: "badge-danger" },
  late:    { ar: "متأخر", en: "Late",     badge: "badge-warning" },
  leave:   { ar: "إجازة", en: "On Leave", badge: "badge-info" },
};

export default function AttendancePage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const today = new Date().toISOString().split("T")[0];
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo]     = useState(today);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getAttendance({ date_from: dateFrom, date_to: dateTo });
      setRecords(data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const present = records.filter(r => r.status === "present").length;
  const absent  = records.filter(r => r.status === "absent").length;
  const late    = records.filter(r => r.status === "late").length;
  const onLeave = records.filter(r => r.status === "leave").length;

  const fmt = (dt: string | null) => dt ? new Date(dt).toLocaleTimeString(ar ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "الحضور والانصراف" : "Attendance"}</h1>
          <p className="page-subtitle">{ar ? "متابعة حضور وانصراف الموظفين" : "Track employee check-in and check-out"}</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: "14px 20px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{ar ? "من" : "From"}</label>
              <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{ar ? "إلى" : "To"}</label>
              <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={load} disabled={loading}>{ar ? "عرض" : "Show"}</button>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#ECFDF5", color: "#059669" }}><IcCheck /></div>
          <div className="stat-content"><div className="stat-label">{ar ? "حاضر" : "Present"}</div><div className="stat-value" style={{ color: "#059669" }}>{present}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FEF2F2", color: "#DC2626" }}><IcX /></div>
          <div className="stat-content"><div className="stat-label">{ar ? "غائب" : "Absent"}</div><div className="stat-value" style={{ color: "#DC2626" }}>{absent}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#FFFBEB", color: "#D97706" }}><IcClock /></div>
          <div className="stat-content"><div className="stat-label">{ar ? "متأخر" : "Late"}</div><div className="stat-value" style={{ color: "#D97706" }}>{late}</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: "#DBEAFE", color: "#587795" }}><IcCalendar /></div>
          <div className="stat-content"><div className="stat-label">{ar ? "إجازة" : "On Leave"}</div><div className="stat-value" style={{ color: "#587795" }}>{onLeave}</div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">{ar ? "سجل الحضور" : "Attendance Record"}</span></div>
        {loading ? (
          <div className="empty-state"><div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div></div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الموظف" : "Employee"}</th>
                  <th>{ar ? "التاريخ" : "Date"}</th>
                  <th>{ar ? "وقت الحضور" : "Check In"}</th>
                  <th>{ar ? "وقت الانصراف" : "Check Out"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>{ar ? "لا توجد سجلات" : "No records found"}</td></tr>
                ) : records.map((rec: any) => {
                  const cfg = statusCfg[rec.status] || statusCfg.present;
                  return (
                    <tr key={rec.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #587795, #5D7E9F)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                            {rec.employee?.full_name_ar?.charAt(0) || "?"}
                          </div>
                          <span style={{ fontWeight: 500 }}>{rec.employee?.full_name_ar || rec.employee_id}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{rec.date}</td>
                      <td style={{ fontWeight: rec.check_in ? 600 : 400, color: rec.status === "late" ? "#D97706" : "inherit" }}>{fmt(rec.check_in)}</td>
                      <td>{fmt(rec.check_out)}</td>
                      <td><span className={`badge ${cfg.badge}`}>{ar ? cfg.ar : cfg.en}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
