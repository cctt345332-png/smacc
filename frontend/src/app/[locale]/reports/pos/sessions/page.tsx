"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function POSSessionsReportPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const sar = ar ? "ر.س" : "SAR";
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    try { const r = await api.get("/pos/sessions", { params: { limit: 200 } }); setSessions(r.data || []); }
    catch { setSessions([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const filtered = sessions.filter(s => { const d = s.opened_at?.slice(0, 10); return d >= dateFrom && d <= dateTo; });
  const closed = filtered.filter(s => s.status === "closed");
  const avgSales = closed.length ? closed.reduce((s, x) => s + Number(x.total_sales || 0), 0) / closed.length : 0;
  const avgTxns  = closed.length ? closed.reduce((s, x) => s + Number(x.transaction_count || 0), 0) / closed.length : 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/reports/pos`}>{ar ? "POS" : "POS"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "الجلسات" : "Sessions"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير جلسات الكاشير" : "Cashier Sessions Report"}</h1>
        </div>
        <StructuredReportPrintButton locale={locale} title={ar ? "تقرير جلسات الكاشير" : "Cashier Sessions Report"} subtitle={ar ? "ملخص إقفال وتشغيل جلسات نقطة البيع" : "POS session opening and closing summary"} period={`${dateFrom} — ${dateTo}`} reportCode={`POS-SES-${dateTo.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي الجلسات" : "Total sessions", value: String(filtered.length), tone: "blue" }, { label: ar ? "جلسات مغلقة" : "Closed sessions", value: String(closed.length), tone: "green" }, { label: ar ? "متوسط المبيعات" : "Avg sales/session", value: `${fmt(avgSales)} ${sar}`, tone: "green" }, { label: ar ? "متوسط المعاملات" : "Avg transactions", value: avgTxns.toFixed(1), tone: "amber" }]} tables={[{ title: ar ? "تفاصيل الجلسات" : "Session details", headers: [ar ? "الفتح" : "Opened", ar ? "الإغلاق" : "Closed", ar ? "المدة" : "Duration", ar ? "المبيعات" : "Sales", ar ? "نقدي" : "Cash", ar ? "بطاقة" : "Card", ar ? "معاملات" : "Txns", ar ? "الفرق" : "Difference", ar ? "الحالة" : "Status"], rows: filtered.map(s => { const opened = new Date(s.opened_at); const closedAt = s.closed_at ? new Date(s.closed_at) : null; const minutes = closedAt ? Math.round((closedAt.getTime() - opened.getTime()) / 60000) : null; const expected = Number(s.opening_cash || 0) + Number(s.total_cash || 0); const difference = s.closing_cash != null ? Number(s.closing_cash) - expected : null; return [opened.toLocaleString(ar ? "ar-SA" : "en-US"), closedAt ? closedAt.toLocaleString(ar ? "ar-SA" : "en-US") : "—", minutes != null ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "—", `${fmt(Number(s.total_sales || 0))} ${sar}`, `${fmt(Number(s.total_cash || 0))} ${sar}`, `${fmt(Number(s.total_card || 0))} ${sar}`, String(s.transaction_count || 0), difference == null ? "—" : `${difference >= 0 ? "+" : ""}${fmt(difference)} ${sar}`, s.status === "open" ? (ar ? "مفتوحة" : "Open") : (ar ? "مغلقة" : "Closed")]; }) }]} />
      </div>

      <div className="card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{ar ? "من" : "From"}</label>
          <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{ar ? "إلى" : "To"}</label>
          <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load}><Icon name="search" size={15} />{ar ? "تحديث" : "Refresh"}</button>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { label: ar ? "إجمالي الجلسات" : "Total Sessions",   value: String(filtered.length),          icon: "session"  as const, color: "#587795", bg: "#EFF6FF" },
          { label: ar ? "جلسات مغلقة"    : "Closed Sessions",  value: String(closed.length),            icon: "lock"     as const, color: "#059669", bg: "#ECFDF5" },
          { label: ar ? "متوسط المبيعات" : "Avg Sales/Session", value: `${fmt(avgSales)} ${sar}`,       icon: "revenue"  as const, color: "#5D7E9F", bg: "#F5F3FF" },
          { label: ar ? "متوسط المعاملات": "Avg Txns/Session",  value: avgTxns.toFixed(1),              icon: "receipt"  as const, color: "#D97706", bg: "#FFFBEB" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg, color: s.color }}><Icon name={s.icon} size={20} /></div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title"><Icon name="session" size={16} />{ar ? "تفاصيل الجلسات" : "Sessions Detail"}</h3>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
        ) : (
          <div className="table-wrapper" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الفتح" : "Opened"}</th>
                  <th>{ar ? "الإغلاق" : "Closed"}</th>
                  <th>{ar ? "المدة" : "Duration"}</th>
                  <th>{ar ? "المبيعات" : "Sales"}</th>
                  <th>{ar ? "نقدي" : "Cash"}</th>
                  <th>{ar ? "بطاقة" : "Card"}</th>
                  <th>{ar ? "معاملات" : "Txns"}</th>
                  <th>{ar ? "الفرق" : "Diff"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const openedAt  = new Date(s.opened_at);
                  const closedAt  = s.closed_at ? new Date(s.closed_at) : null;
                  const durMin    = closedAt ? Math.round((closedAt.getTime() - openedAt.getTime()) / 60000) : null;
                  const expected  = Number(s.opening_cash || 0) + Number(s.total_cash || 0);
                  const actual    = s.closing_cash != null ? Number(s.closing_cash) : null;
                  const diff      = actual != null ? actual - expected : null;
                  return (
                    <tr key={s.id}>
                      <td style={{ fontSize: 12 }}>{openedAt.toLocaleString(ar ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                      <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{closedAt ? closedAt.toLocaleString(ar ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td style={{ fontSize: 12 }}>{durMin != null ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : "—"}</td>
                      <td style={{ fontWeight: 700, color: "var(--success)" }}>{fmt(Number(s.total_sales))} {sar}</td>
                      <td>{fmt(Number(s.total_cash))} {sar}</td>
                      <td>{fmt(Number(s.total_card))} {sar}</td>
                      <td><span className="badge badge-gray">{s.transaction_count}</span></td>
                      <td style={{ fontWeight: 600, color: diff == null ? "var(--text-muted)" : diff >= 0 ? "var(--success)" : "var(--danger)" }}>
                        {diff != null ? `${diff >= 0 ? "+" : ""}${fmt(diff)}` : "—"}
                      </td>
                      <td><span className={`badge ${s.status === "open" ? "badge-success" : "badge-gray"}`}>{s.status === "open" ? (ar ? "مفتوحة" : "Open") : (ar ? "مغلقة" : "Closed")}</span></td>
                      <td><Link href={`/${locale}/pos/sessions/${s.id}`} className="btn btn-ghost btn-sm"><Icon name="view" size={13} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
