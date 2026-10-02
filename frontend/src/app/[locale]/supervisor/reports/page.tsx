"use client";

import { useEffect, useMemo, useState, use } from "react";
import { getSupervisorCustomerStatements, getSupervisorInvoices, getSupervisorReps, getSupervisorSummary } from "@/lib/reps";
import { INVOICE_STATUS_PRESENTATION, isFinancialInvoiceStatus } from "@/lib/invoiceStatus";
import SearchableSelect from "@/components/ui/SearchableSelect";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";
const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

export default function SupervisorReportsPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const [summary, setSummary] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [statements, setStatements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [tab, setTab] = useState<"performance" | "invoices" | "customers">("performance");
  const [filterRep, setFilterRep] = useState("");
  const [fromDate, setFromDate] = useState(yearStart());
  const [toDate, setToDate] = useState(today());

  useEffect(() => {
    Promise.all([getSupervisorSummary(), getSupervisorInvoices(), getSupervisorReps()])
      .then(([s, i, r]) => {
        setSummary(s.data);
        setInvoices(Array.isArray(i.data) ? i.data : []);
        setReps(Array.isArray(r.data) ? r.data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const visibleInvoices = useMemo(() => invoices.filter(i => !filterRep || i.rep_id === filterRep), [invoices, filterRep]);
  const financialInvoices = visibleInvoices.filter(i => isFinancialInvoiceStatus(i.status));
  const totalSales = financialInvoices.reduce((sum, i) => sum + Number(i.total || 0), 0);
  const totalCollected = visibleInvoices.reduce((sum, i) => sum + Number(i.paid_amount || 0), 0);
  const repOptions = reps.map(rep => ({ value: rep.id, label: `${rep.full_name} · ${rep.rep_code}`, searchText: rep.phone || "" }));

  const loadStatements = async () => {
    setStatementsLoading(true);
    try {
      const result = await getSupervisorCustomerStatements({
        from_date: `${fromDate}T00:00:00`, to_date: `${toDate}T23:59:59`, ...(filterRep ? { rep_id: filterRep } : {}),
      });
      setStatements(Array.isArray(result.data) ? result.data : []);
      setTab("customers");
    } finally { setStatementsLoading(false); }
  };

  const exportCSV = () => {
    const rows = tab === "customers"
      ? [["العميل", "رقم العميل", "المندوب", "الفواتير", "المقبوض", "الرصيد النهائي"], ...statements.map(row => [row.customer?.name_ar || "", row.customer?.customer_number || "", reps.find(r => r.id === row.rep_id)?.full_name || "", row.summary?.total_invoiced || 0, row.summary?.total_paid || 0, row.summary?.closing_balance || 0])]
      : [["رقم الفاتورة", "العميل", "المندوب", "الحالة", "التاريخ", "الإجمالي", "المدفوع", "المتبقي"], ...visibleInvoices.map(i => [i.invoice_number, i.buyer_name_ar, i.rep_name, i.status, fmtDate(i.issue_date), i.total || 0, i.paid_amount || 0, Math.max(0, Number(i.total || 0) - Number(i.paid_amount || 0))])];
    const csv = "\uFEFF" + rows.map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); link.download = `supervisor-report-${today()}.csv`; link.click();
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "جاري تحميل تقارير المناديب..." : "Loading supervisor reports..."}</div>;

  const repSummary = (summary?.rep_summaries || []).filter((r: any) => !filterRep || r.rep_id === filterRep);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div><h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "تقارير المناديب" : "Supervisor Reports"}</h1><p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>{ar ? "حركة مفصلة حسب المندوب والعملاء والفواتير" : "Detailed activity by rep, customer and invoice"}</p></div>
        <button onClick={exportCSV} style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid #E9DDF0", background: "#F7F2F8", color: "#6F4A84", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Excel</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(190px, 1.4fr) 1fr 1fr", gap: 8 }}>
        <SearchableSelect locale={locale} options={repOptions} value={filterRep} onChange={setFilterRep} placeholder={ar ? "ابحث واختر المندوب" : "Search and choose rep"} style={{ padding: "10px 12px", borderRadius: 10, fontSize: 13 }} />
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }} />
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }} />
      </div>

      <div style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: "1px solid var(--border)" }}>
        {[['performance', ar ? 'أداء المناديب' : 'Rep performance'], ['invoices', ar ? 'الفواتير التفصيلية' : 'Invoice activity'], ['customers', ar ? 'كشوف العملاء' : 'Customer statements']].map(([key, label]) => <button key={key} onClick={() => setTab(key as any)} style={{ flex: "0 0 auto", whiteSpace: "nowrap", padding: "10px 14px", border: 0, borderBottom: tab === key ? "2px solid #3E0865" : "2px solid transparent", background: "transparent", color: tab === key ? "#3E0865" : "var(--text-secondary)", fontWeight: tab === key ? 800 : 500, cursor: "pointer" }}>{label}</button>)}
      </div>

      {tab === "performance" && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {[{ label: ar ? "المبيعات" : "Sales", value: totalSales, color: "#5A187E" }, { label: ar ? "المقبوض" : "Collected", value: totalCollected, color: "#166534" }, { label: ar ? "المتبقي" : "Outstanding", value: totalSales - totalCollected, color: "#DC2626" }, { label: ar ? "الفواتير" : "Invoices", value: visibleInvoices.length, color: "#2563EB" }].map(card => <div key={card.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}><div style={{ fontSize: 11, color: "var(--text-muted)" }}>{card.label}</div><div style={{ fontSize: 18, fontWeight: 800, color: card.color, marginTop: 5 }}>{typeof card.value === "number" && card.label !== (ar ? "الفواتير" : "Invoices") ? `${fmt(card.value)} SAR` : card.value}</div></div>)}
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>{ar ? "حركة كل مندوب" : "Rep activity"}</div>
          {repSummary.map((rep: any) => <div key={rep.rep_id} style={{ display: "grid", gridTemplateColumns: "minmax(130px, 1fr) repeat(3, minmax(90px, auto))", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}><div><strong>{rep.full_name}</strong><div style={{ color: "var(--text-muted)", marginTop: 2 }}>{rep.rep_code} · {rep.invoice_count} {ar ? "فاتورة" : "invoices"}</div></div><span>{ar ? "مبيعات" : "Sales"}<br/><b>{fmt(rep.total_sales)}</b></span><span>{ar ? "مقبوض" : "Collected"}<br/><b>{fmt(rep.total_collected)}</b></span><span style={{ color: Number(rep.outstanding) > 0 ? "#DC2626" : "#166534" }}>{ar ? "المستحق" : "Due"}<br/><b>{fmt(rep.outstanding)}</b></span></div>)}
        </div>
      </>}

      {tab === "invoices" && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{visibleInvoices.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "لا توجد فواتير" : "No invoices"}</div> : visibleInvoices.map(inv => { const status = INVOICE_STATUS_PRESENTATION[inv.status as keyof typeof INVOICE_STATUS_PRESENTATION]; const due = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0)); return <div key={inv.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 14px" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><strong style={{ color: "#5A187E", fontFamily: "monospace" }}>{inv.invoice_number}</strong><strong>{fmt(inv.total)} SAR</strong></div><div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}><span>{inv.buyer_name_ar} · {inv.rep_name}</span><span>{fmtDate(inv.issue_date)}</span></div><div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11 }}><span style={{ color: "#64748B" }}>{status?.ar || inv.status}</span><span style={{ color: due > 0 ? "#DC2626" : "#166534" }}>{ar ? "المتبقي" : "Due"}: {fmt(due)} SAR</span></div></div>; })}</div>}

      {tab === "customers" && <>
        <button className="btn btn-primary" onClick={loadStatements} disabled={statementsLoading} style={{ alignSelf: "flex-start" }}>{statementsLoading ? (ar ? "جاري استخراج الكشوف..." : "Preparing statements...") : (ar ? "استخراج كشوف العملاء" : "Generate customer statements")}</button>
        {statements.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "اختر المندوب والفترة ثم اضغط استخراج" : "Choose a rep/date range and generate statements"}</div> : <div style={{ overflowX: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}><table style={{ width: "100%", minWidth: 650, borderCollapse: "collapse", fontSize: 12 }}><thead><tr><th style={{ padding: 10, textAlign: "start" }}>{ar ? "العميل" : "Customer"}</th><th style={{ padding: 10 }}>{ar ? "المندوب" : "Rep"}</th><th style={{ padding: 10 }}>{ar ? "الفواتير" : "Invoiced"}</th><th style={{ padding: 10 }}>{ar ? "المقبوض" : "Collected"}</th><th style={{ padding: 10 }}>{ar ? "الرصيد النهائي" : "Closing"}</th></tr></thead><tbody>{statements.map(row => <tr key={row.customer?.id} style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: 10 }}><strong>{row.customer?.name_ar}</strong><div style={{ color: "var(--text-muted)" }}>{row.customer?.customer_number}</div></td><td style={{ padding: 10 }}>{reps.find(r => r.id === row.rep_id)?.full_name || "—"}</td><td style={{ padding: 10, textAlign: "center" }}>{fmt(row.summary?.total_invoiced)}</td><td style={{ padding: 10, textAlign: "center" }}>{fmt(row.summary?.total_paid)}</td><td style={{ padding: 10, textAlign: "center", color: Number(row.summary?.closing_balance) > 0 ? "#DC2626" : "#166534", fontWeight: 800 }}>{fmt(row.summary?.closing_balance)}</td></tr>)}</tbody></table></div>}
      </>}
    </div>
  );
}
