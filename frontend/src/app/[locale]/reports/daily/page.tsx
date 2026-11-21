"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import { getDailyReport } from "@/lib/daily-report";
import { getWarehouses } from "@/lib/inventory";
import { getReps } from "@/lib/reps";
import { getTerminals } from "@/lib/pos";

const today = () => new Date().toISOString().slice(0, 10);
const money = (value: any) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function DailyReportPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const sar = ar ? "ر.س" : "SAR";
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [warehouseId, setWarehouseId] = useState("");
  const [terminalId, setTerminalId] = useState("");
  const [repId, setRepId] = useState("");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [terminals, setTerminals] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await getDailyReport({ date_from: from, date_to: to, warehouse_id: warehouseId || undefined, terminal_id: terminalId || undefined, rep_id: repId || undefined });
      setReport(response.data);
    } catch (e: any) {
      setReport(null); setError(e?.response?.data?.detail || (ar ? "تعذر تحميل التقرير" : "Could not load report"));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    Promise.allSettled([getWarehouses(), getTerminals(), getReps()]).then(([w, t, r]) => {
      setWarehouses(w.status === "fulfilled" ? (w.value.data || []) : []);
      setTerminals(t.status === "fulfilled" ? (t.value.data || []) : []);
      setReps(r.status === "fulfilled" ? (r.value.data || []) : []);
    });
    load();
  }, []);

  const summary = report?.summary || {};
  const pos = report?.pos?.terminals || [];
  const details = report?.details || {};
  const label = (ar ? {
    sales: "المبيعات", purchases: "المشتريات", collected: "تحصيل المناديب", posCollected: "مدفوعات فواتير POS", otherCollected: "تحصيل العملاء الآخر", supplier: "المدفوع للموردين", gross: "إجمالي الربح", net: "صافي الربح", expenses: "المصروفات", maintenance: "تحصيل الصيانة", vat: "ضريبة المبيعات",
  } : {
    sales: "Sales", purchases: "Purchases", collected: "Rep collections", posCollected: "POS invoice payments", otherCollected: "Other customer collections", supplier: "Supplier payments", gross: "Gross profit", net: "Net profit", expenses: "Expenses", maintenance: "Maintenance collected", vat: "Sales VAT",
  });
  const amount = (value: any) => `${money(value)} ${sar}`;
  const metrics = [
    { label: label.sales, value: amount(summary.sales), color: "#6F4A84", bg: "#F4EFF7", icon: "revenue" as const },
    { label: label.collected, value: amount(summary.rep_collected), color: "#15803D", bg: "#F0FDF4", icon: "cash" as const },
    { label: label.posCollected, value: amount(summary.pos_collected), color: "#0369A1", bg: "#EFF6FF", icon: "pos" as const },
    { label: label.net, value: amount(summary.net_profit), color: "#5A187E", bg: "#F5F3FF", icon: "revenue" as const },
  ];
  const printSummary = [
    [label.sales, amount(summary.sales)], [label.purchases, amount(summary.purchases)], [label.collected, amount(summary.rep_collected)], [label.posCollected, amount(summary.pos_collected)], [label.otherCollected, amount(summary.other_customer_collected)], [label.supplier, amount(summary.supplier_paid)], [label.maintenance, amount(summary.maintenance_collected)], [label.expenses, amount(summary.expenses)], [label.gross, amount(summary.gross_profit)], [label.net, amount(summary.net_profit)],
  ];
  const printPos = pos.map((row: any) => [row.terminal_name, amount(row.sales), amount(row.cost), amount(row.gross_profit), amount(row.expenses), amount(row.net_profit), String(row.transactions || 0)]);
  const printPayments = Object.entries(report?.payment_methods || {}).map(([method, value]) => [method, amount(value)]);

  return <>
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "الملخص اليومي الشامل" : "Daily Summary"}</span></div>
        <h1 className="page-title">{ar ? "التقرير اليومي الشامل" : "Daily Comprehensive Report"}</h1>
        <p className="page-subtitle">{ar ? "ملخص موحد لكل حركة النظام: مبيعات، مشتريات، تحصيل، أرباح، مصروفات وPOS" : "Unified summary of sales, purchases, collections, profit, expenses and POS"}</p>
      </div>
      <StructuredReportPrintButton locale={locale} title={ar ? "التقرير اليومي الشامل" : "Daily Comprehensive Report"} subtitle={ar ? "ملخص النظام المالي والتشغيلي" : "Financial and operational system summary"} period={`${from} — ${to}`} reportCode={`DAILY-${to.replaceAll("-", "")}`} orientation="landscape" metrics={metrics.map((m, i) => ({ label: m.label, value: m.value, tone: i === 3 ? "green" : "neutral" }))} tables={[{ title: ar ? "الملخص المالي" : "Financial summary", headers: [ar ? "البند" : "Item", ar ? "المبلغ" : "Amount"], rows: printSummary }, { title: ar ? "أداء نقاط البيع" : "POS performance", headers: [ar ? "الجهاز" : "Terminal", ar ? "المبيعات" : "Sales", ar ? "التكلفة" : "Cost", ar ? "الربح" : "Profit", ar ? "المصروفات" : "Expenses", ar ? "الصافي" : "Net", ar ? "العمليات" : "Transactions"], rows: printPos }, { title: ar ? "طرق التحصيل" : "Collection methods", headers: [ar ? "الطريقة" : "Method", ar ? "المبلغ" : "Amount"], rows: printPayments }]} />
    </div>

    <div className="card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">{ar ? "من تاريخ" : "From"}</label><input type="date" className="form-input" value={from} onChange={e => setFrom(e.target.value)} /></div>
      <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">{ar ? "إلى تاريخ" : "To"}</label><input type="date" className="form-input" value={to} onChange={e => setTo(e.target.value)} /></div>
      <div className="form-group" style={{ marginBottom: 0, minWidth: 190 }}><label className="form-label">{ar ? "المستودع" : "Warehouse"}</label><select className="form-input" value={warehouseId} onChange={e => setWarehouseId(e.target.value)}><option value="">{ar ? "كل المستودعات" : "All warehouses"}</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name_ar || w.name || w.name_en}</option>)}</select></div>
      <div className="form-group" style={{ marginBottom: 0, minWidth: 190 }}><label className="form-label">{ar ? "نقطة البيع" : "POS terminal"}</label><select className="form-input" value={terminalId} onChange={e => setTerminalId(e.target.value)}><option value="">{ar ? "كل النقاط" : "All terminals"}</option>{terminals.map(t => <option key={t.id} value={t.id}>{t.name}{t.branch_name ? ` — ${t.branch_name}` : ""}</option>)}</select></div>
      <div className="form-group" style={{ marginBottom: 0, minWidth: 190 }}><label className="form-label">{ar ? "المندوب" : "Sales rep"}</label><select className="form-input" value={repId} onChange={e => setRepId(e.target.value)}><option value="">{ar ? "كل المناديب" : "All reps"}</option>{reps.map(r => <option key={r.id} value={r.id}>{r.name || r.full_name || r.user_name || r.rep_code}</option>)}</select></div>
      <button className="btn btn-primary" onClick={load} disabled={loading}><Icon name="search" size={15} />{loading ? (ar ? "جاري التحميل..." : "Loading...") : (ar ? "عرض التقرير" : "Run report")}</button>
    </div>

    {error && <div className="card" style={{ padding: 16, color: "var(--danger)", marginBottom: 20 }}>{error}</div>}
    <div className="grid-4" style={{ marginBottom: 24 }}>{metrics.map(m => <div key={m.label} className="stat-card"><div className="stat-icon" style={{ background: m.bg, color: m.color }}><Icon name={m.icon} size={20} /></div><div className="stat-value">{m.value}</div><div className="stat-label">{m.label}</div></div>)}</div>

    <div className="grid-4" style={{ marginBottom: 24 }}>{[
      [ar ? "عدد فواتير المبيعات" : "Sales invoices", summary.sales_invoices || 0], [ar ? "عدد فواتير المشتريات" : "Purchase bills", summary.purchase_bills || 0], [ar ? "تحصيل المناديب" : "Rep collections", amount(summary.rep_collected)], [ar ? "مدفوعات فواتير POS" : "POS invoice payments", amount(summary.pos_collected)],
    ].map(([title, value]) => <div className="card" key={String(title)} style={{ padding: 16 }}><div style={{ color: "var(--text-muted)", fontSize: 12 }}>{title}</div><strong style={{ fontSize: 19 }}>{value}</strong></div>)}</div>

    <div className="card" style={{ marginBottom: 24 }}><div className="card-header"><h3 className="card-title"><Icon name="journal" size={16} />{ar ? "الملخص المالي والتشغيلي" : "Financial and operational summary"}</h3></div><div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "البند" : "Item"}</th><th>{ar ? "المبلغ" : "Amount"}</th><th>{ar ? "ملاحظات" : "Notes"}</th></tr></thead><tbody>{[[label.sales, summary.sales, `${summary.sales_invoices || 0} ${ar ? "فاتورة عادية" : "regular invoices"} + ${summary.pos_transactions || 0} POS`], [label.purchases, summary.purchases, `${summary.purchase_bills || 0} ${ar ? "فاتورة" : "bills"}`], [label.collected, summary.rep_collected, ar ? "تحصيل مرتبط بفواتير/عملاء المناديب" : "Receipts linked to reps/customers"], [label.posCollected, summary.pos_collected, ar ? "المدفوع فعليًا في عمليات POS" : "Actually paid in POS transactions"], [label.otherCollected, summary.other_customer_collected, ar ? "تحصيل عملاء غير مرتبط بمندوب" : "Customer receipts without a rep"], [label.supplier, summary.supplier_paid, ar ? "دفعات الموردين" : "Supplier payments"], [label.maintenance, summary.maintenance_collected, `${summary.maintenance_count || 0} ${ar ? "دفعة" : "payments"}`], [label.expenses, summary.expenses, `${amount(summary.rep_expenses)} ${ar ? "مصاريف مناديب" : "rep expenses"}`], [label.gross, summary.gross_profit, ar ? "مبيعات ناقص تكلفة البضاعة — POS محسوب مرة واحدة" : "Sales less cost; POS counted once"], [label.vat, summary.vat, ar ? "ضريبة مخرجات المبيعات" : "Output VAT"]].map((row: any[]) => <tr key={row[0]}><td style={{ fontWeight: 700 }}>{row[0]}</td><td>{amount(row[1])}</td><td style={{ color: "var(--text-muted)" }}>{row[2]}</td></tr>)}</tbody><tfoot><tr><th>{label.net}</th><th>{amount(summary.net_profit)}</th><th /></tr></tfoot></table></div></div>

    <div className="card" style={{ marginBottom: 24 }}><div className="card-header"><h3 className="card-title"><Icon name="pos" size={16} />{ar ? "أداء نقاط البيع" : "POS performance"}</h3></div>{pos.length === 0 ? <div className="empty-state">{ar ? "لا توجد عمليات نقاط بيع ضمن الفترة" : "No POS activity in this period"}</div> : <div className="table-wrapper" style={{ border: "none", overflowX: "auto" }}><table><thead><tr><th>{ar ? "الجهاز" : "Terminal"}</th><th>{ar ? "العمليات" : "Transactions"}</th><th>{ar ? "المبيعات" : "Sales"}</th><th>{ar ? "التكلفة" : "Cost"}</th><th>{ar ? "الربح" : "Profit"}</th><th>{ar ? "المصروفات" : "Expenses"}</th><th>{ar ? "الصافي" : "Net"}</th></tr></thead><tbody>{pos.map((row: any) => <tr key={row.terminal_id}><td style={{ fontWeight: 700 }}>{row.terminal_name}</td><td>{row.transactions || 0}</td><td>{amount(row.sales)}</td><td>{amount(row.cost)}</td><td>{amount(row.gross_profit)}</td><td>{amount(row.expenses)}</td><td style={{ fontWeight: 700 }}>{amount(row.net_profit)}</td></tr>)}</tbody></table></div>}</div>

    <div className="card"><div className="card-header"><h3 className="card-title"><Icon name="receipt" size={16} />{ar ? "تفاصيل العمليات اليومية" : "Daily transaction details"}</h3></div><div className="table-wrapper" style={{ border: "none", overflowX: "auto" }}><table><thead><tr><th>{ar ? "النوع" : "Type"}</th><th>{ar ? "الرقم" : "Number"}</th><th>{ar ? "التاريخ" : "Date"}</th><th>{ar ? "المبلغ" : "Amount"}</th><th>{ar ? "الطريقة" : "Method"}</th></tr></thead><tbody>{[...(details.invoices || []).map((r: any) => ({ ...r, type: ar ? "مبيعات" : "Sale" })), ...(details.bills || []).map((r: any) => ({ ...r, type: ar ? "مشتريات" : "Purchase" })), ...(details.payments || []).map((r: any) => ({ ...r, type: ar ? (r.source === "rep" ? "تحصيل المناديب" : r.source === "pos" ? "مدفوعات فواتير POS" : "تحصيل العملاء") : (r.source === "rep" ? "Rep collection" : r.source === "pos" ? "POS invoice payment" : "Customer receipt") }))].map((row: any, index) => <tr key={`${row.type}-${row.number}-${index}`}><td>{row.type}</td><td>{row.number}</td><td>{row.date?.slice(0, 16).replace("T", " ")}</td><td>{amount(row.total ?? row.amount)}</td><td>{row.method || "—"}</td></tr>)}</tbody></table></div></div>
  </>;
}
