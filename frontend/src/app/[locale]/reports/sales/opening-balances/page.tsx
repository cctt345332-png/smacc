"use client";
import { useEffect, useMemo, useState, use } from "react";
import Link from "next/link";
import { getOpeningBalanceAging } from "@/lib/sales";
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
  const [customers, setCustomers] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [asOf, setAsOf] = useState(now.toISOString().split("T")[0]);
  const [accountId, setAccountId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [repId, setRepId] = useState("");

  useEffect(() => {
    Promise.allSettled([getCustomers(), getAccounts(), getReps()]).then(([c, a, r]) => {
      if (c.status === "fulfilled") setCustomers(Array.isArray(c.value.data) ? c.value.data : []);
      if (a.status === "fulfilled") setAccounts(Array.isArray(a.value.data) ? a.value.data : []);
      if (r.status === "fulfilled") setReps(Array.isArray(r.value.data) ? r.value.data : []);
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
    getOpeningBalanceAging({
      as_of: `${asOf}T23:59:59`,
      from_date: `${fromDate}T00:00:00`,
      to_date: `${toDate}T23:59:59`,
      customer_id: customerId || undefined,
      rep_id: repId || undefined,
      account_id: accountId || undefined,
    }).then((response) => {
      setRows((Array.isArray(response.data) ? response.data : []).map((row: any) => ({
        id: row.opening_balance_id || row.invoice_id,
        customer: row.customer_name || "—",
        customerId: row.customer_id,
        invoice: row.invoice_number || row.opening_balance_id || row.invoice_id,
        invoiceDate: row.issue_date,
        dueDate: row.issue_date,
        sold: Number(row.invoice_total || 0),
        paid: Number(row.paid_amount || 0),
        balance: Number(row.outstanding || 0),
        days: Number(row.age_days || 0),
        rep: row.rep_name,
      })));
      setLoaded(true);
    }).finally(() => setLoading(false));
  };

  const totals = rows.reduce((a, r) => ({ sold: a.sold + r.sold, paid: a.paid + r.paid, balance: a.balance + r.balance }), { sold: 0, paid: 0, balance: 0 });
  const overdue = rows.filter(r => r.days > 30);
  const date = (value: string) => new Date(value).toLocaleDateString(ar ? "ar-SA" : "en-GB");
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name_ar || c.name_en || c.customer_number || c.id, searchText: `${c.customer_number || ""} ${c.name_ar || ""} ${c.name_en || ""}` }));
  const repOptions = reps.map(r => ({ value: r.id, label: r.full_name || r.rep_code || r.id, searchText: `${r.rep_code || ""} ${r.full_name || ""}` }));

  return <>
    <div className="page-header">
      <div>
        <div className="breadcrumb"><Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link><span className="breadcrumb-sep">/</span><span>{ar ? "أعمار الديون" : "Receivables Aging"}</span></div>
        <h1 className="page-title">{ar ? "تقرير أعمار الأرصدة الافتتاحية للعملاء" : "Opening Customer Balances Aging"}</h1>
        <p className="page-subtitle">{ar ? "تفصيل كل رصيد افتتاحي بعدد الأيام الفعلي وتمييز المتأخر أكثر من 21 يومًا" : "Opening-balance aging with the same overdue rules and filters"}</p>
      </div>
      {loaded && <StructuredReportPrintButton locale={locale} title={ar ? "أعمار الأرصدة الافتتاحية" : "Opening Customer Balances Aging"} subtitle={ar ? "العميل ومبلغ الرصيد الافتتاحي وتاريخه وأيامه والمتبقي والمسدد" : "Customer, opening balance, date, age, balance and paid"} period={`${fromDate} — ${toDate} / ${ar ? "حتى" : "As of"} ${asOf}`} reportCode={`AR-OPENING-AGE-${asOf.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "عدد العملاء" : "Customers", value: String(rows.length), tone: "blue" }, { label: ar ? "إجمالي الأرصدة الافتتاحية" : "Opening balances", value: `${fmt(totals.sold)} SAR`, tone: "blue" }, { label: ar ? "إجمالي المسدد" : "Paid", value: `${fmt(totals.paid)} SAR`, tone: "green" }, { label: ar ? "الرصيد المتبقي" : "Outstanding", value: `${fmt(totals.balance)} SAR`, tone: "red" }, { label: ar ? "متأخر أكثر من 30 يوم" : "Over 30 days", value: String(overdue.length), tone: "red" }]} tables={[{ title: ar ? "تفاصيل أعمار الأرصدة الافتتاحية" : "Opening balance aging details", headers: [ar ? "العميل" : "Customer", ar ? "مبلغ الرصيد الافتتاحي" : "Opening balance", ar ? "تاريخ الرصيد" : "Opening date", ar ? "عدد الأيام" : "Age days", ar ? "المتبقي" : "Remaining", ar ? "المسدد" : "Paid"], rows: rows.map(r => [r.customer, fmt(r.sold), date(r.invoiceDate), String(r.days), fmt(r.balance), fmt(r.paid)]), totals: [ar ? "الإجمالي" : "TOTAL", fmt(totals.sold), "", "", fmt(totals.balance), fmt(totals.paid)] }]} />}
    </div>

    <div className="card" style={{ marginBottom: 20 }}><div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
      <div className="form-group" style={{ margin: 0, minWidth: 220 }}><label className="form-label">{ar ? "من تاريخ الرصيد" : "Opening balance from"}</label><input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 220 }}><label className="form-label">{ar ? "إلى تاريخ الرصيد" : "Opening balance to"}</label><input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 180 }}><label className="form-label">{ar ? "حساب حتى تاريخ" : "Age as of"}</label><input type="date" className="form-input" value={asOf} onChange={e => setAsOf(e.target.value)} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 260 }}><label className="form-label">{ar ? "فرع الحساب" : "Account branch"}</label><SearchableAccountSelect accounts={accounts} value={accountId} onChange={setAccountId} locale={locale} allowGroups placeholder={ar ? "ابحث في شجرة الحسابات كاملة..." : "Search the full account tree..."} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 280 }}><label className="form-label">{ar ? "العميل" : "Customer"}</label><SearchableSelect locale={locale} value={customerId} onChange={setCustomerId} placeholder={ar ? "ابحث عن العميل..." : "Search customer..."} options={[{ value: "", label: ar ? "كل العملاء" : "All customers" }, ...customerOptions]} /></div>
      <div className="form-group" style={{ margin: 0, minWidth: 260 }}><label className="form-label">{ar ? "المندوب" : "Representative"}</label><SearchableSelect locale={locale} value={repId} onChange={setRepId} placeholder={ar ? "ابحث عن المندوب..." : "Search representative..."} options={[{ value: "", label: ar ? "كل المناديب" : "All representatives" }, ...repOptions]} /></div>
      <button className="btn btn-primary" onClick={load} disabled={loading}>{loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض التقرير" : "Show Report")}</button>
    </div></div>

    {loaded && <div className="card"><div className="card-header"><span className="card-title">{ar ? `تفاصيل أعمار الأرصدة الافتتاحية — ${fromDate} إلى ${toDate} — حتى ${asOf}` : `Opening balance aging — ${fromDate} to ${toDate} — as of ${asOf}`}</span><span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "الأيام 22 إلى 30 باللون الأصفر، وبعد 30 يوماً باللون الأحمر. المسدد من سندات قبض العميل يخصم من الرصيد الافتتاحي أولاً" : "Days 22–30 are yellow; over 30 days are red. Receipts are applied to opening balances first"}</span></div><div className="table-wrapper" style={{ border: "none" }}><table><thead><tr><th>{ar ? "العميل" : "Customer"}</th><th style={{ textAlign: "end" }}>{ar ? "مبلغ الرصيد الافتتاحي" : "Opening balance"}</th><th>{ar ? "تاريخ الرصيد" : "Opening date"}</th><th style={{ textAlign: "end" }}>{ar ? "عدد الأيام" : "Age days"}</th><th style={{ textAlign: "end" }}>{ar ? "المتبقي من الرصيد" : "Remaining"}</th><th style={{ textAlign: "end" }}>{ar ? "المسدد" : "Paid"}</th></tr></thead><tbody>{rows.map(r => { const yellow = r.days > 21 && r.days <= 30; const red = r.days > 30; const dayLabel = String(r.days); const cellClass = red ? "aging-cell-red" : yellow ? "aging-cell-yellow" : ""; return <tr key={r.id}><td style={{ fontWeight: 600 }}>{r.customer}</td><td className={cellClass} style={{ textAlign: "end" }}>{fmt(r.sold)}</td><td>{date(r.invoiceDate)}</td><td className={cellClass} style={{ textAlign: "end", fontWeight: 800, color: red ? "#B91C1C" : yellow ? "#92400E" : "inherit" }}>{dayLabel}</td><td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(r.balance)}</td><td style={{ textAlign: "end", color: "#15803D" }}>{fmt(r.paid)}</td></tr>; })}</tbody><tfoot><tr style={{ background: "#F8FAFC", fontWeight: 800 }}><td>{ar ? "الإجمالي" : "TOTAL"}</td><td style={{ textAlign: "end" }}>{fmt(totals.sold)}</td><td></td><td></td><td style={{ textAlign: "end" }}>{fmt(totals.balance)}</td><td style={{ textAlign: "end" }}>{fmt(totals.paid)}</td></tr></tfoot></table>{rows.length === 0 && <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد أرصدة افتتاحية مستحقة ضمن الفلاتر" : "No outstanding opening balances match the filters"}</div></div>}</div></div>}
    <style jsx global>{`
      td.aging-cell-yellow { background: #FEF3C7 !important; }
      td.aging-cell-red { background: #FEE2E2 !important; }
      @media print {
        td.aging-cell-yellow { background: #FEF3C7 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        td.aging-cell-red { background: #FEE2E2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    `}</style>
  </>;
}
