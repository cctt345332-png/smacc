"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getSettlementReport, getSettlementSources } from "@/lib/settlements";

const money = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (value: any, ar: boolean) => value ? new Date(value).toLocaleDateString(ar ? "ar-SA" : "en-GB") : "—";

export default function SettlementReportPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [sources, setSources] = useState<any[]>([]);
  const [report, setReport] = useState<any>({ rows: [], totals: {} });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: sourceData }, { data: reportData }] = await Promise.all([
        getSettlementSources(),
        getSettlementReport({ date_from: from || undefined, date_to: to || undefined, source_id: source || undefined, source_type: source ? "rep" : undefined }),
      ]);
      setSources(sourceData || []);
      setReport(reportData || { rows: [], totals: {} });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [from, to, source]);

  const clear = () => { setFrom(""); setTo(""); setSource(""); };
  const totals = report.totals || {};

  return <div className="page-container">
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/dashboard`}>{ar ? "الرئيسية" : "Home"}</Link><span className="breadcrumb-sep">/</span><Link href={`/${locale}/treasury/settlements`}>{ar ? "تسويات العهد" : "Settlements"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "التقرير" : "Report"}</span></div>
        <h1 className="page-title">{ar ? "تقرير استلام العهد" : "Custody collection report"}</h1>
        <p className="page-subtitle">{ar ? "تقرير موحد يوضح ما هو متوقع وما تم استلامه لكل مندوب" : "A unified report of expected and received amounts by representative"}</p>
      </div>
      <div style={{ display: "flex", gap: 8 }}><button className="btn btn-secondary btn-sm" onClick={() => window.print()}>{ar ? "طباعة التقرير" : "Print report"}</button><Link href={`/${locale}/treasury/settlements`} className="btn btn-primary btn-sm">{ar ? "العودة للتسويات" : "Back to settlements"}</Link></div>
    </div>

    <div className="card" style={{ marginBottom: 20 }}><div className="card-header"><div className="card-title">{ar ? "فلاتر التقرير" : "Report filters"}</div></div><div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr)) auto", gap: 12, alignItems: "end" }}><label className="form-label" style={{ margin: 0 }}>{ar ? "من تاريخ" : "From date"}<input type="date" className="form-input" style={{ marginTop: 5 }} value={from} onChange={e => setFrom(e.target.value)} /></label><label className="form-label" style={{ margin: 0 }}>{ar ? "إلى تاريخ" : "To date"}<input type="date" className="form-input" style={{ marginTop: 5 }} value={to} onChange={e => setTo(e.target.value)} /></label><label className="form-label" style={{ margin: 0 }}>{ar ? "المندوب" : "Representative"}<select className="form-input" style={{ marginTop: 5 }} value={source} onChange={e => setSource(e.target.value)}><option value="">{ar ? "كل المناديب" : "All representatives"}</option>{sources.filter(x => x.source_type === "rep").map(x => <option key={x.source_id} value={x.source_id}>{x.name}</option>)}</select></label><button className="btn btn-ghost btn-sm" onClick={clear}>{ar ? "مسح الفلاتر" : "Clear"}</button></div></div>

    <div className="grid-3" style={{ marginBottom: 20 }}>{[
      [ar ? "عدد التسويات" : "Settlements", totals.count || 0, "#5A187E"],
      [ar ? "المتوقع" : "Expected", `${money(totals.expected_amount)} SAR`, "#5A187E"],
      [ar ? "المستلم" : "Received", `${money(totals.received_amount)} SAR`, "#047857"],
    ].map(([label, value, color]) => <div className="stat-card" key={String(label)}><div className="stat-content"><div className="stat-label">{label}</div><div className="stat-value" style={{ color: String(color), fontSize: 18 }}>{value}</div></div></div>)}</div>

    <div className="card"><div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div className="card-title">{ar ? "تفاصيل التقرير" : "Report details"}</div><span style={{ color: "var(--text-muted)", fontSize: 12 }}>{loading ? (ar ? "جاري التحميل..." : "Loading...") : `${report.rows?.length || 0} ${ar ? "تسوية" : "settlements"}`}</span></div><div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}><table><thead><tr><th>{ar ? "المندوب / العهدة" : "Custody"}</th><th>{ar ? "الفترة" : "Period"}</th><th>{ar ? "تاريخ الإقفال" : "Closed"}</th><th>{ar ? "المتوقع" : "Expected"}</th><th>{ar ? "المستلم" : "Received"}</th><th>{ar ? "ملاحظات" : "Notes"}</th></tr></thead><tbody>{(report.rows || []).map((row: any) => <tr key={row.id}><td style={{ fontWeight: 600 }}>{row.source_label}</td><td>{day(row.period_from, ar)} — {day(row.period_to, ar)}</td><td>{day(row.settled_at, ar)}</td><td>{money(row.expected_amount)}</td><td>{money(row.received_amount)}</td><td>{row.notes || "—"}</td></tr>)}{!loading && !report.rows?.length && <tr><td colSpan={6} className="empty-state">{ar ? "لا توجد تسويات في الفترة المحددة" : "No settlements for the selected filters"}</td></tr>}</tbody></table></div></div>
  </div>;
}
