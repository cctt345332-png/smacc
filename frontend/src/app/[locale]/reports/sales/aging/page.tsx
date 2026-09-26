"use client";
import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { getInvoices, getPayments } from "@/lib/sales";
import { getCustomers } from "@/lib/sales";
import { getAccounts } from "@/lib/accounting";
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
  const [payments, setPayments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [asOf, setAsOf] = useState(now.toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState("");
  const [customerId, setCustomerId] = useState("");

  useEffect(() => {
    // لا نجعل فشل جلب السندات يمنع ظهور الفواتير؛ السداد المباشر إضافة للتقرير.
    Promise.allSettled([getInvoices(), getPayments(), getCustomers(), getAccounts()]).then(([i, p, c, a]) => {
      if (i.status === "fulfilled") setInvoices(Array.isArray(i.value.data) ? i.value.data : []);
      if (p.status === "fulfilled") setPayments(Array.isArray(p.value.data) ? p.value.data : []);
      if (c.status === "fulfilled") setCustomers(Array.isArray(c.value.data) ? c.value.data : []);
      if (a.status === "fulfilled") setAccounts(Array.isArray(a.value.data) ? a.value.data : []);
    });
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
    const eligible = invoices.filter((inv: any) => {
      const status = String(inv.status || "").toLowerCase();
      const sold = Number(inv.total || 0);
      const issueDate = new Date(inv.issue_date || inv.invoice_date || inv.created_at);
      return Number.isFinite(issueDate.getTime()) && issueDate >= start && issueDate <= end && sold > 0.01 && !["draft", "submitted", "rejected", "cancelled"].includes(status) && (!customerId || inv.customer_id === customerId);
    }).sort((a: any, b: any) => new Date(a.due_date || a.issue_date).getTime() - new Date(b.due_date || b.issue_date).getTime());
    const directPayments = payments.filter((p: any) => !p.invoice_id && (!customerId || p.customer_id === customerId) && new Date(p.payment_date).getTime() <= asOfDate.getTime()).sort((a: any, b: any) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime());
    const remainingDirectByCustomer = new Map<string, number>();
    for (const payment of directPayments) {
      const key = String(payment.customer_id || "");
      remainingDirectByCustomer.set(key, (remainingDirectByCustomer.get(key) || 0) + Number(payment.amount || 0));
    }
    for (const inv of eligible) {
      const status = String(inv.status || "").toLowerCase();
      const sold = Number(inv.total || 0);
      const invoiceReceipts = payments.filter((p: any) => p.invoice_id === inv.id && new Date(p.payment_date).getTime() <= asOfDate.getTime());
      // سندات الفاتورة هي المصدر الدقيق. نستخدم paid_amount القديم فقط عند تعذر جلب السندات.
      const invoicePaid = payments.length > 0
        ? invoiceReceipts.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0)
        : Number(inv.paid_amount || 0);
      const issueDate = new Date(inv.issue_date || inv.invoice_date || inv.created_at);
      const customerKey = String(inv.customer_id || "");
      const unallocatedDirect = remainingDirectByCustomer.get(customerKey) || 0;
      const directApplied = Math.min(Math.max(0, sold - invoicePaid), unallocatedDirect);
      remainingDirectByCustomer.set(customerKey, unallocatedDirect - directApplied);
      const paid = invoicePaid + directApplied;
      const balance = sold - paid;
      const customer = customerById.get(inv.customer_id);
      if (accountScope && !accountScope.has(customer?.ar_account_id)) continue;
      // عمر الفاتورة يُحسب من تاريخ إصدار/إنشاء الفاتورة، وليس من تاريخ الاستحقاق.
      // مثال: فاتورة بتاريخ 05-09 وحتى 26-09 = 21 يوماً.
      const days = Math.floor((asOfDate.getTime() - issueDate.getTime()) / DAY);
      if (balance <= 0.01) continue;
      result.push({
        id: inv.id,
        customer: inv.buyer_name_ar || customer?.name_ar || customer?.name_en || customer?.customer_number || "—",
        customerId: inv.customer_id,
        invoice: inv.invoice_number || inv.id,
        invoiceDate: issueDate.toISOString(),
        dueDate: issueDate.toISOString(),
        sold,
        paid,
        balance,
        days,
      });
    }
    setRows(result.sort((a, b) => b.days - a.days || b.balance - a.balance));
    setLoaded(true);
    setLoading(false);
  };

  const totals = rows.reduce((a, r) => ({ sold: a.sold + r.sold, paid: a.paid + r.paid, balance: a.balance + r.balance }), { sold: 0, paid: 0, balance: 0 });
  const overdue = rows.filter(r => r.days > 30);
  const date = (value: string) => new Date(value).toLocaleDateString(ar ? "ar-SA" : "en-GB");
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name_ar || c.name_en || c.customer_number || c.id, searchText: `${c.customer_number || ""} ${c.name_ar || ""} ${c.name_en || ""}` }));

  return <>
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "أعمار الديون" : "Receivables Aging"}</span></div>
        <h1 className="page-title">{ar ? "تقرير أعمار ديون فواتير المبيعات" : "Sales Invoice Receivables Aging"}</h1>
        <p className="page-subtitle">{ar ? "تفصيل كل فاتورة بعدد الأيام الفعلي وتمييز المتأخر أكثر من 21 يومًا" : "Invoice-level aging with actual overdue days and 21-day overdue highlighting"}</p>
      </div>
      {loaded && <StructuredReportPrintButton locale={locale} title={ar ? "أعمار ديون فواتير المبيعات" : "Sales Invoice Receivables Aging"} subtitle={ar ? "العميل ومبلغ الفاتورة وتاريخها وأيامها والمتبقي والمسدد" : "Customer, invoice amount, date, age, balance and paid"} period={`${fromDate} — ${toDate} / ${ar ? "حتى" : "As of"} ${asOf}`} reportCode={`AR-AGE-${asOf.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي الفواتير" : "Invoices", value: String(rows.length), tone: "blue" }, { label: ar ? "إجمالي المبيعات" : "Sold", value: `${fmt(totals.sold)} SAR`, tone: "blue" }, { label: ar ? "إجمالي المسدد" : "Paid", value: `${fmt(totals.paid)} SAR`, tone: "green" }, { label: ar ? "الرصيد المتبقي" : "Outstanding", value: `${fmt(totals.balance)} SAR`, tone: "red" }, { label: ar ? "متأخر أكثر من 30 يوم" : "Over 30 days", value: String(overdue.length), tone: "red" }]} tables={[{ title: ar ? "تفاصيل أعمار الديون" : "Receivables aging details", headers: [ar ? "العميل" : "Customer", ar ? "مبلغ الفاتورة" : "Invoice amount", ar ? "تاريخ الفاتورة" : "Invoice date", ar ? "عدد الأيام" : "Invoice days", ar ? "المتبقي" : "Remaining", ar ? "المسدد" : "Paid"], rows: rows.map(r => [r.customer, fmt(r.sold), date(r.invoiceDate), String(r.days), fmt(r.balance), fmt(r.paid)]), totals: [ar ? "الإجمالي" : "TOTAL", fmt(totals.sold), "", "", fmt(totals.balance), fmt(totals.paid)] }]} />}
    </div>

    <div className="card" style={{ marginBottom: 20 }}><div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="form-group" style={{ margin: 0, minWidth: 220 }}><label className="form-label">{ar ? "من تاريخ الفاتورة" : "Invoice from"}</label><input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 220 }}><label className="form-label">{ar ? "إلى تاريخ الفاتورة" : "Invoice to"}</label><input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 180 }}><label className="form-label">{ar ? "حساب حتى تاريخ" : "Age as of"}</label><input type="date" className="form-input" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 260 }}><label className="form-label">{ar ? "فرع الحساب" : "Account branch"}</label><SearchableAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} locale={locale} allowGroups placeholder={ar ? "ابحث في شجرة الحسابات كاملة..." : "Search the full account tree..."} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 280 }}><label className="form-label">{ar ? "العميل" : "Customer"}</label><SearchableSelect locale={locale} value={customerId} onChange={setCustomerId} placeholder={ar ? "ابحث عن العميل..." : "Search customer..."} options={[{ value: "", label: ar ? "كل العملاء" : "All customers" }, ...customerOptions]} /></div>
      <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض التقرير" : "Show Report")}</button>
    </div></div>

    {loaded && <div className="card"><div className="card-header"><span className="card-title">{ar ? `تفاصيل أعمار الديون — ${fromDate} إلى ${toDate} — حتى ${asOf}` : `Receivables aging — ${fromDate} to ${toDate} — as of ${asOf}`}</span><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "الأيام 22 إلى 30 باللون الأصفر، وبعد 30 يوماً باللون الأحمر. المسدد من سندات قبض العميل" : "Days 22–30 are yellow; over 30 days are red. Paid from customer receipts"}</span></div><div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "العميل" : "Customer"}</th><th style={{ textAlign: "end" }}>{ar ? "مبلغ الفاتورة" : "Invoice amount"}</th><th>{ar ? "تاريخ الفاتورة" : "Invoice date"}</th><th style={{ textAlign: "end" }}>{ar ? "عدد أيام الفاتورة" : "Invoice days"}</th><th style={{ textAlign: "end" }}>{ar ? "المتبقي من الفاتورة" : "Remaining"}</th><th style={{ textAlign: "end" }}>{ar ? "المسدد" : "Paid"}</th></tr></thead><tbody>{rows.map(r => { const yellow = r.days > 21 && r.days <= 30; const red = r.days > 30; const dayLabel = String(r.days); const rowClass = red ? "aging-row-red" : yellow ? "aging-row-yellow" : ""; return <tr key={r.id} className={rowClass}><td style={{ fontWeight: 600 }}>{r.customer}</td><td style={{ textAlign: "end" }}>{fmt(r.sold)}</td><td>{date(r.invoiceDate)}</td><td style={{ textAlign: "end", fontWeight: 800, color: red ? "#B91C1C" : yellow ? "#92400E" : "inherit" }}>{dayLabel}</td><td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(r.balance)}</td><td style={{ textAlign: "end", color: "#15803D" }}>{fmt(r.paid)}</td></tr>; })}</tbody><tfoot><tr style={{ background: "#F8FAFC", fontWeight: 800 }}><td>{ar ? "الإجمالي" : "TOTAL"}</td><td style={{ textAlign: "end" }}>{fmt(totals.sold)}</td><td></td><td></td><td style={{ textAlign: "end" }}>{fmt(totals.balance)}</td><td style={{ textAlign: "end" }}>{fmt(totals.paid)}</td></tr></tfoot></table>{rows.length === 0 && <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد فواتير مستحقة ضمن الفلاتر" : "No outstanding invoices match the filters"}</div></div>}</div></div>}
    <style jsx global>{`
      tr.aging-row-yellow > td { background: #FEF3C7 !important; }
      tr.aging-row-red > td { background: #FEE2E2 !important; }
      @media print {
        tr.aging-row-yellow > td { background: #FEF3C7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        tr.aging-row-red > td { background: #FEE2E2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  </>;
}
