"use client";

import { use, useEffect, useState } from "react";
import api from "@/lib/api";

const STATUS: Record<string, string> = { new: "جديد", received: "تم الاستلام", inspecting: "قيد الفحص", waiting_customer: "بانتظار موافقة العميل", in_repair: "قيد الصيانة", waiting_part: "بانتظار قطعة", ready: "جاهز للتسليم", delivered: "تم التسليم", closed: "مغلق", rejected: "مرفوض", cancelled: "ملغي" };

export default function MaintenanceReportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const ar = locale === "ar";
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [status, setStatus] = useState("");
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try { const res = await api.get("/maintenance/reports/summary", { params: { from_date: fromDate || undefined, to_date: toDate || undefined, status: status || undefined } }); setReport(res.data); }
    catch (e: any) { setError(e?.response?.data?.detail || (ar ? "تعذر تحميل التقرير" : "Could not load report")); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  return <main dir={ar ? "rtl" : "ltr"}>
    <div className="page-header"><div><div className="breadcrumb"><span>{ar ? "التقارير" : "Reports"}</span><span className="breadcrumb-sep">/</span><span>{ar ? "الصيانة" : "Maintenance"}</span></div><h1 className="page-title">{ar ? "تقرير صيانة الجوالات" : "Mobile Maintenance Report"}</h1><p className="page-subtitle">{ar ? "حركة الطلبات والأعطال والاستبدالات حسب الفترة والحالة" : "Requests, faults and replacements by period and status"}</p></div><button className="btn btn-secondary" onClick={() => window.print()}>{ar ? "طباعة التقرير" : "Print report"}</button></div>
    <div className="card" style={{ marginBottom: 16 }}><div className="card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}><label>{ar ? "من تاريخ" : "From"}<input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} /></label><label>{ar ? "إلى تاريخ" : "To"}<input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} /></label><label>{ar ? "الحالة" : "Status"}<select className="form-input form-select" value={status} onChange={e => setStatus(e.target.value)}><option value="">{ar ? "كل الحالات" : "All statuses"}</option>{Object.entries(STATUS).map(([key, label]) => <option key={key} value={key}>{ar ? label : key}</option>)}</select></label><button className="btn btn-primary" onClick={load}>{loading ? (ar ? "جارٍ التحميل" : "Loading") : (ar ? "عرض التقرير" : "Run report")}</button></div></div>
    {error && <div className="alert alert-error">{error}</div>}
    {report && <><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>{[[ar ? "إجمالي الطلبات" : "Total requests", report.total_requests, "#5A187E"], [ar ? "الطلبات المفتوحة" : "Open requests", report.open_requests, "#D97706"], [ar ? "الاستبدالات" : "Replacements", report.replacements, "#DC2626"], [ar ? "حالات الضمان" : "Warranty cases", report.warranty_requests, "#15803D"]].map(([label, value, color]) => <div className="card" key={String(label)} style={{ padding: 16 }}><div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{label}</div><div style={{ color, fontSize: 24, fontWeight: 800, marginTop: 6 }}>{value}</div></div>)}</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}><div className="card"><div className="card-header"><h2>{ar ? "حسب الحالة" : "By status"}</h2></div><div className="table-wrapper"><table><tbody>{Object.entries(report.by_status || {}).map(([key, value]) => <tr key={key}><td>{ar ? STATUS[key] || key : key}</td><td style={{ textAlign: "end", fontWeight: 700 }}>{String(value)}</td></tr>)}</tbody></table></div></div><div className="card"><div className="card-header"><h2>{ar ? "الأجهزة الأكثر دخولًا للصيانة" : "Most serviced devices"}</h2></div><div className="table-wrapper"><table><tbody>{(report.by_product || []).slice(0, 10).map((item: any) => <tr key={item.label}><td>{item.label}</td><td style={{ textAlign: "end", fontWeight: 700 }}>{item.count}</td></tr>)}</tbody></table></div></div></div></>}
    <style jsx global>{`@media print { .no-print { display:none!important; } body { margin:0; } }`}</style>
  </main>;
}
