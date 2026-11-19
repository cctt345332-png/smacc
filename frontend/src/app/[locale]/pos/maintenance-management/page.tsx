"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { getMaintenanceManagementReport, getTerminals } from "@/lib/pos";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import { Icon } from "@/components/ui/Icons";

const money = (value: any) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

export default function MaintenanceManagementPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [status, setStatus] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [terminals, setTerminals] = useState<any[]>([]);
  const [data, setData] = useState<any>({ summary: {}, by_terminal: [], tickets: [] });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getMaintenanceManagementReport({
        from_date: fromDate ? `${fromDate}T00:00:00` : undefined,
        to_date: toDate ? `${toDate}T23:59:59` : undefined,
        status: status || undefined,
        terminal_id: terminalId || undefined,
      });
      setData(result.data || { summary: {}, by_terminal: [], tickets: [] });
    } catch {
      setData({ summary: {}, by_terminal: [], tickets: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTerminals().then((result) => setTerminals(result.data || [])).catch(() => setTerminals([]));
    load();
  }, []);

  const summary = data.summary || {};
  const tickets = data.tickets || [];
  const byTerminal = data.by_terminal || [];
  const statusLabel = (value: string) => ({ open: ar ? "جديدة" : "Open", in_progress: ar ? "قيد التنفيذ" : "In progress", ready: ar ? "جاهزة" : "Ready", completed: ar ? "مكتملة" : "Completed", cancelled: ar ? "ملغاة" : "Cancelled" } as Record<string, string>)[value] || value || "—";
  const printRows = tickets.map((row: any) => [row.ticket_number, row.device_name, row.customer_name || "—", statusLabel(row.status), `${money(row.parts_total)} SAR`, `${money(row.fees_total)} SAR`, `${money(row.paid_amount)} SAR`, `${money(row.outstanding)} SAR`]);

  return (
    <div dir={ar ? "rtl" : "ltr"}>
      <div className="page-header">
        <div>
          <div className="breadcrumb"><Link href={`/${locale}/pos`}>{ar ? "نقطة البيع" : "POS"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "إدارة الصيانة" : "Maintenance Management"}</span></div>
          <h1 className="page-title">{ar ? "إدارة صيانة نقاط البيع" : "POS Maintenance Management"}</h1>
          <p className="page-subtitle">{ar ? "متابعة الأجهزة، القطع المصروفة، التحصيل، والعهدة حسب الفترة والجهاز" : "Track devices, issued parts, collections, and custody by period and terminal"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <StructuredReportPrintButton locale={locale} title={ar ? "تقرير إدارة صيانة نقاط البيع" : "POS Maintenance Management Report"} subtitle={ar ? "العهدة والتحصيل والقطع المصروفة" : "Custody, collections, and issued parts"} period={`${fromDate} — ${toDate}`} orientation="landscape" reportCode={`MNT-${today.replaceAll("-", "")}`} metrics={[{ label: ar ? "التذاكر" : "Tickets", value: String(summary.ticket_count || 0), tone: "blue" }, { label: ar ? "التحصيل" : "Collected", value: `${money(summary.paid_total)} SAR`, tone: "green" }, { label: ar ? "المتبقي" : "Outstanding", value: `${money(summary.outstanding_total)} SAR`, tone: "amber" }, { label: ar ? "قيمة القطع" : "Parts value", value: `${money(summary.parts_total)} SAR`, tone: "blue" }]} tables={[{ title: ar ? "تفاصيل الصيانة" : "Maintenance details", headers: [ar ? "التذكرة" : "Ticket", ar ? "الجهاز" : "Device", ar ? "العميل" : "Customer", ar ? "الحالة" : "Status", ar ? "القطع" : "Parts", ar ? "الأجرة" : "Fees", ar ? "المحصّل" : "Collected", ar ? "المتبقي" : "Outstanding"], rows: printRows }]} />
          <Link href={`/${locale}/pos/maintenance`} className="btn btn-secondary"><Icon name="settings" size={15} />{ar ? "تشغيل الصيانة" : "Maintenance Counter"}</Link>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
          <label className="form-group" style={{ margin: 0 }}><span className="form-label">{ar ? "من تاريخ" : "From"}</span><input className="form-input" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label>
          <label className="form-group" style={{ margin: 0 }}><span className="form-label">{ar ? "إلى تاريخ" : "To"}</span><input className="form-input" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></label>
          <label className="form-group" style={{ margin: 0, minWidth: 180 }}><span className="form-label">{ar ? "جهاز الكاشير" : "Terminal"}</span><select className="form-input form-select" value={terminalId} onChange={(e) => setTerminalId(e.target.value)}><option value="">{ar ? "كل الأجهزة" : "All terminals"}</option>{terminals.map((terminal) => <option key={terminal.id} value={terminal.id}>{terminal.name}</option>)}</select></label>
          <label className="form-group" style={{ margin: 0, minWidth: 160 }}><span className="form-label">{ar ? "الحالة" : "Status"}</span><select className="form-input form-select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">{ar ? "كل الحالات" : "All statuses"}</option><option value="open">{statusLabel("open")}</option><option value="in_progress">{statusLabel("in_progress")}</option><option value="ready">{statusLabel("ready")}</option><option value="completed">{statusLabel("completed")}</option><option value="cancelled">{statusLabel("cancelled")}</option></select></label>
          <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? (ar ? "جاري التحميل..." : "Loading...") : (ar ? "عرض التقرير" : "Show report")}</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[{ label: ar ? "عدد التذاكر" : "Tickets", value: summary.ticket_count || 0, color: "#2563EB" }, { label: ar ? "إجمالي المعتمد" : "Approved total", value: `${money(summary.approved_total)} SAR`, color: "#7C3AED" }, { label: ar ? "المحصّل" : "Collected", value: `${money(summary.paid_total)} SAR`, color: "#059669" }, { label: ar ? "العهدة المتبقية" : "Outstanding custody", value: `${money(summary.outstanding_total)} SAR`, color: "#D97706" }].map((item) => <div className="stat-card" key={item.label}><div className="stat-value" style={{ color: item.color }}>{item.value}</div><div className="stat-label">{item.label}</div></div>)}
      </div>

      <div className="grid-2" style={{ alignItems: "start", marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><h3 className="card-title"><Icon name="pos" size={16} />{ar ? "عهدة الأجهزة" : "Terminal custody"}</h3><span className="badge badge-info">{byTerminal.length}</span></div>
          <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "الجهاز" : "Terminal"}</th><th>{ar ? "التذاكر" : "Tickets"}</th><th>{ar ? "القطع" : "Parts"}</th><th>{ar ? "المحصّل" : "Collected"}</th><th>{ar ? "المتبقي" : "Outstanding"}</th></tr></thead><tbody>{byTerminal.map((row: any) => <tr key={row.terminal_id}><td style={{ fontWeight: 700 }}>{row.terminal_name}</td><td>{row.ticket_count}</td><td>{money(row.parts_total)} SAR</td><td style={{ color: "#059669", fontWeight: 700 }}>{money(row.paid_total)} SAR</td><td style={{ color: Number(row.outstanding || 0) > 0 ? "#D97706" : "var(--text-muted)" }}>{money(row.outstanding)} SAR</td></tr>)}</tbody></table></div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="card-title"><Icon name="settings" size={16} />{ar ? "رقابة القطع والتحصيل" : "Parts and collection control"}</h3></div>
          <div style={{ padding: 18, display: "grid", gap: 12 }}><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "قيمة القطع المصروفة" : "Issued parts value"}</span><b>{money(summary.parts_total)} SAR</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "أجور الصيانة" : "Maintenance fees"}</span><b>{money(summary.fees_total)} SAR</b></div><div style={{ display: "flex", justifyContent: "space-between" }}><span>{ar ? "عدد القطع المصروفة" : "Issued parts count"}</span><b>{summary.issued_parts || 0}</b></div><div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>{ar ? "إجمالي المطلوب" : "Total approved"}</span><b style={{ color: "var(--primary)" }}>{money(summary.approved_total)} SAR</b></div></div>
        </div>
      </div>

      <div className="card"><div className="card-header"><h3 className="card-title"><Icon name="receipt" size={16} />{ar ? "تفاصيل تذاكر الصيانة" : "Maintenance tickets"}</h3><span className="badge badge-gray">{tickets.length}</span></div>{tickets.length === 0 ? <div className="empty-state">{loading ? (ar ? "جاري تحميل التقرير..." : "Loading report...") : (ar ? "لا توجد نتائج ضمن الفلاتر" : "No results for selected filters")}</div> : <div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "التذكرة" : "Ticket"}</th><th>{ar ? "الجهاز" : "Device"}</th><th>{ar ? "العميل" : "Customer"}</th><th>{ar ? "الحالة" : "Status"}</th><th>{ar ? "القطع" : "Parts"}</th><th>{ar ? "الأجرة" : "Fees"}</th><th>{ar ? "المحصّل" : "Collected"}</th><th>{ar ? "المتبقي" : "Outstanding"}</th><th>{ar ? "التاريخ" : "Date"}</th></tr></thead><tbody>{tickets.map((row: any) => <tr key={row.id}><td style={{ fontWeight: 700, color: "var(--primary)" }}>{row.ticket_number}</td><td>{row.device_name}{row.device_serial ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.device_serial}</div> : null}</td><td>{row.customer_name || "—"}</td><td><span className="badge badge-gray">{statusLabel(row.status)}</span></td><td>{money(row.parts_total)} SAR</td><td>{money(row.fees_total)} SAR</td><td style={{ color: "#059669", fontWeight: 700 }}>{money(row.paid_amount)} SAR</td><td style={{ color: Number(row.outstanding || 0) > 0 ? "#D97706" : "var(--text-muted)" }}>{money(row.outstanding)} SAR</td><td style={{ fontSize: 12, color: "var(--text-muted)" }}>{new Date(row.created_at).toLocaleDateString(ar ? "ar-SA" : "en-GB")}</td></tr>)}</tbody></table></div>}</div>
    </div>
  );
}
