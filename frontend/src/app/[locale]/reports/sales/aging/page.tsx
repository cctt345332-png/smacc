"use client";
import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { getInvoices } from "@/lib/sales";
import { getCustomers } from "@/lib/sales";
import { getAccounts } from "@/lib/accounting";
import { getReps } from "@/lib/reps";
import SearchableSelect from "@/components/ui/SearchableSelect";
import SearchableAccountSelect from "@/components/accounting/SearchableAccountSelect";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const DAY = 24 * 60 * 60 * 1000;

interface AgingRow {
  id: string;
  customer: string;
  customerId?: string;
  invoice: string;
  invoiceDate: string;
  dueDate: string;
  sold: number;
  paid: number;
  balance: number;
  days: number;
  rep?: string;
}

export default function AgingReportPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = use(props.params);
  const ar = locale === "ar";
  const now = new Date();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [asOf, setAsOf] = useState(now.toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState("");
  const [repId, setRepId] = useState("");

  useEffect(() => {
    Promise.all([getInvoices(), getCustomers(), getAccounts(), getReps()]).then(([i, c, a, r]) => {
      setInvoices(Array.isArray(i.data) ? i.data : []);
      setCustomers(Array.isArray(c.data) ? c.data : []);
      setAccounts(Array.isArray(a.data) ? a.data : []);
      setReps(Array.isArray(r.data) ? r.data : []);
    }).catch(() => {});
  }, []);

  const customerById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const accountScope = useMemo(() => {
    if (!accountId) return null;
    const scope = new Set([accountId]);
    const pending = [accountId];
    while (pending.length) {
      const parent = pending.pop()!;
      accounts.filter(a => a.parent_id === parent).forEach(child => {
        if (!scope.has(child.id)) { scope.add(child.id); pending.push(child.id); }
      });
    }
    return scope;
  }, [accountId, accounts]);

  const load = () => {
    setLoading(true);
    const asOfDate = new Date(`${asOf}T23:59:59`);
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(`${toDate}T23:59:59`);
    const result: AgingRow[] = [];
    for (const inv of invoices) {
      const status = String(inv.status || "").toLowerCase();
      const sold = Number(inv.total || 0);
      const paid = Number(inv.paid_amount || 0);
      const balance = sold - paid;
      const issueDate = new Date(inv.issue_date || inv.invoice_date || inv.created_at);
      if (!Number.isFinite(issueDate.getTime()) || issueDate < start || issueDate > end) continue;
      if (!(balance > 0.01) || !["confirmed", "partial", "overdue"].includes(status)) continue;
      if (inv.rep_id && repId && inv.rep_id !== repId) continue;
      const customer = customerById.get(inv.customer_id);
      if (accountScope && !accountScope.has(customer?.ar_account_id)) continue;
      const due = new Date(inv.due_date || inv.issue_date || inv.invoice_date || inv.created_at);
      const days = Math.max(0, Math.floor((asOfDate.getTime() - due.getTime()) / DAY));
      result.push({
        id: inv.id,
        customer: inv.buyer_name_ar || customer?.name_ar || customer?.name_en || customer?.customer_number || "—",
        customerId: inv.customer_id,
        invoice: inv.invoice_number || inv.id,
        invoiceDate: issueDate.toISOString(),
        dueDate: due.toISOString(),
        sold,
        paid,
        balance,
        days,
        rep: reps.find(r => r.id === inv.rep_id)?.full_name || reps.find(r => r.id === inv.rep_id)?.name_ar || "—",
      });
    }
    setRows(result.sort((a, b) => b.days - a.days || b.balance - a.balance));
    setLoaded(true);
    setLoading(false);
  };

  const totals = rows.reduce((a, r) => ({ sold: a.sold + r.sold, paid: a.paid + r.paid, balance: a.balance + r.balance }), { sold: 0, paid: 0, balance: 0 });
  const overdue = rows.filter(r => r.days > 21);
  const date = (value: string) => new Date(value).toLocaleDateString(ar ? "ar-SA" : "en-GB");
  const repOptions = reps.map(r => ({ value: r.id, label: r.full_name || r.name_ar || r.rep_code, searchText: `${r.rep_code || ""} ${r.full_name || ""} ${r.name_ar || ""}` }));

  return <>
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "أعمار الديون" : "Receivables Aging"}</span></div>
        <h1 className="page-title">{ar ? "تقرير أعمار ديون فواتير المبيعات" : "Sales Invoice Receivables Aging"}</h1>
        <p className="page-subtitle">{ar ? "تفصيل كل فاتورة بعدد الأيام الفعلي وتمييز المتأخر أكثر من 21 يومًا" : "Invoice-level aging with actual overdue days and 21-day overdue highlighting"}</p>
      </div>
      {loaded && <StructuredReportPrintButton locale={locale} title={ar ? "أعمار ديون فواتير المبيعات" : "Sales Invoice Receivables Aging"} subtitle={ar ? "تفصيل الفواتير والعملاء والمدفوعات والأيام المتأخرة" : "Invoice, customer, payment and overdue-day details"} period={`${fromDate} — ${toDate} / ${ar ? "حتى" : "As of"} ${asOf}`} reportCode={`AR-AGE-${asOf.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي الفواتير" : "Invoices", value: String(rows.length), tone: "blue" }, { label: ar ? "إجمالي المبيعات" : "Sold", value: `${fmt(totals.sold)} SAR`, tone: "blue" }, { label: ar ? "إجمالي المسدد" : "Paid", value: `${fmt(totals.paid)} SAR`, tone: "green" }, { label: ar ? "الرصيد المتبقي" : "Outstanding", value: `${fmt(totals.balance)} SAR`, tone: "red" }, { label: ar ? "متأخر أكثر من 21 يوم" : "Over 21 days", value: String(overdue.length), tone: "red" }]} tables={[{ title: ar ? "تفاصيل أعمار الديون" : "Receivables aging details", headers: [ar ? "العميل" : "Customer", ar ? "الفاتورة" : "Invoice", ar ? "تاريخ البيع" : "Sale date", ar ? "الاستحقاق" : "Due date", ar ? "المباع" : "Sold", ar ? "المسدد" : "Paid", ar ? "المتبقي" : "Balance", ar ? "العمر بالأيام" : "Age days", ar ? "المندوب" : "Rep"], rows: rows.map(r => [r.customer, r.invoice, date(r.invoiceDate), date(r.dueDate), fmt(r.sold), fmt(r.paid), fmt(r.balance), String(r.days), r.rep || "—"]), totals: [ar ? "الإجمالي" : "TOTAL", "", "", "", fmt(totals.sold), fmt(totals.paid), fmt(totals.balance), "", ""] }]} />}
    </div>

    <div className="card" style={{ marginBottom: 20 }}><div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="form-group" style={{ margin: 0, minWidth: 220 }}><label className="form-label">{ar ? "من تاريخ الفاتورة" : "Invoice from"}</label><input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 220 }}><label className="form-label">{ar ? "إلى تاريخ الفاتورة" : "Invoice to"}</label><input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 180 }}><label className="form-label">{ar ? "حساب حتى تاريخ" : "Age as of"}</label><input type="date" className="form-input" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 260 }}><label className="form-label">{ar ? "فرع الحساب" : "Account branch"}</label><SearchableAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} locale={locale} placeholder={ar ? "ابحث في شجرة الحسابات..." : "Search account tree..."} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 240 }}><label className="form-label">{ar ? "المندوب" : "Sales rep"}</label><SearchableSelect locale={locale} value={repId} onChange={setRepId} placeholder={ar ? "ابحث عن المندوب..." : "Search rep..."} options={[{ value: "", label: ar ? "كل المناديب" : "All reps" }, ...repOptions]} /></div>
      <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض التقرير" : "Show Report")}</button>
    </div></div>

    {loaded && <div className="card"><div className="card-header"><span className="card-title">{ar ? `تفاصيل أعمار الديون — ${fromDate} إلى ${toDate} — حتى ${asOf}` : `Receivables aging — ${fromDate} to ${toDate} — as of ${asOf}`}</span></div><div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "العميل" : "Customer"}</th><th>{ar ? "الفاتورة" : "Invoice"}</th><th>{ar ? "تاريخ البيع" : "Sale date"}</th><th>{ar ? "تاريخ الاستحقاق" : "Due date"}</th><th style={{ textAlign: "end" }}>{ar ? "المباع" : "Sold"}</th><th style={{ textAlign: "end" }}>{ar ? "المسدد" : "Paid"}</th><th style={{ textAlign: "end" }}>{ar ? "المتبقي" : "Balance"}</th><th style={{ textAlign: "end" }}>{ar ? "العمر بالأيام" : "Age days"}</th><th>{ar ? "المندوب" : "Sales rep"}</th></tr></thead><tbody>{rows.map(r => { const late = r.days > 21; return <tr key={r.id} style={{ background: late ? "#FEF2F2" : undefined }}><td style={{ fontWeight: 600 }}>{r.customer}</td><td style={{ fontFamily: "monospace", fontWeight: 700 }}>{r.invoice}</td><td>{date(r.invoiceDate)}</td><td>{date(r.dueDate)}</td><td style={{ textAlign: "end" }}>{fmt(r.sold)}</td><td style={{ textAlign: "end", color: "#15803D" }}>{fmt(r.paid)}</td><td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(r.balance)}</td><td style={{ textAlign: "end", fontWeight: 800, color: late ? "#DC2626" : r.days > 0 ? "#D97706" : "#15803D" }}>{r.days} {ar ? "يوم" : "days"}{late && <span className="badge badge-danger" style={{ marginInlineStart: 6 }}>{ar ? "متأخر" : "Overdue"}</span>}</td><td>{r.rep || "—"}</td></tr>; })}</tbody><tfoot><tr style={{ background: "#F8FAFC", fontWeight: 800 }}><td>{ar ? "الإجمالي" : "TOTAL"}</td><td colSpan={3}></td><td style={{ textAlign: "end" }}>{fmt(totals.sold)}</td><td style={{ textAlign: "end" }}>{fmt(totals.paid)}</td><td style={{ textAlign: "end" }}>{fmt(totals.balance)}</td><td colSpan={2}></td></tr></tfoot></table>{rows.length === 0 && <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد فواتير مستحقة ضمن الفلاتر" : "No outstanding invoices match the filters"}</div></div>}</div></div>}
  </>;
}
