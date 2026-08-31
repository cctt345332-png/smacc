"use client";
import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCustomers, getCustomerStatement } from "@/lib/sales";
import { getAccounts } from "@/lib/accounting";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import SearchableAccountSelect from "@/components/accounting/SearchableAccountSelect";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function CustomerStatementPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const searchParams = useSearchParams();
  const now = new Date();
  const [customers, setCustomers] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState(searchParams.get("customer_id") || "");
  const [customerCity, setCustomerCity] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getCustomers(), getAccounts()]).then(([customersRes, accountsRes]) => {
      setCustomers(customersRes.data);
      setAccounts(accountsRes.data);
    });
  }, []);

  // تحميل تلقائي إذا كان customer_id في الـ URL
  useEffect(() => {
    const preId = searchParams.get("customer_id");
    if (preId) { setCustomerId(preId); }
  }, [searchParams]);

  const cities = [...new Set(customers.map(c => c.address_city).filter(Boolean))] as string[];

  const load = async () => {
    const accountScope = new Set<string>();
    if (accountId) {
      accountScope.add(accountId);
      const pending = [accountId];
      while (pending.length) {
        const current = pending.pop()!;
        accounts.filter(a => a.parent_id === current).forEach(child => {
          if (!accountScope.has(child.id)) { accountScope.add(child.id); pending.push(child.id); }
        });
      }
    }
    const selectedCustomers = customers.filter(c =>
      (!customerId || c.id === customerId) &&
      (!customerCity || c.address_city === customerCity) &&
      (!accountId || accountScope.has(c.ar_account_id))
    );
    if (selectedCustomers.length === 0) return alert(ar ? "لا يوجد عملاء ضمن الاختيار" : "No customers match the selection");
    setLoading(true);
    try {
      const responses = await Promise.all(selectedCustomers.map(c => getCustomerStatement(c.id, fromDate + "T00:00:00", toDate + "T23:59:59", accountId || undefined)));
      if (selectedCustomers.length === 1 && customerId) {
        setData(responses[0].data);
      } else {
        const rows = responses.map((r: any) => ({ customer: r.data.customer, summary: r.data.summary }));
        setData({ aggregate: true, customerCount: rows.length, city: customerCity, rows, summary: {
          opening_balance: rows.reduce((s, r) => s + Number(r.summary.opening_balance || 0), 0),
          total_invoiced: rows.reduce((s, r) => s + Number(r.summary.total_invoiced || 0), 0),
          total_paid: rows.reduce((s, r) => s + Number(r.summary.total_paid || 0), 0),
          closing_balance: rows.reduce((s, r) => s + Number(r.summary.closing_balance || 0), 0),
        }});
      }
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "كشف حساب العميل" : "Customer Statement"}</span>
          </div>
          <h1 className="page-title">{ar ? "كشف حساب العميل" : "Customer Account Statement"}</h1>
          <p className="page-subtitle">{ar ? "جميع الفواتير والمدفوعات والرصيد المستحق" : "All invoices, payments and outstanding balance"}</p>
        </div>
        {data && !data.aggregate && <StructuredReportPrintButton locale={locale} title={ar ? "كشف حساب عميل" : "Customer Account Statement"} subtitle={`${ar ? data.customer.name_ar : data.customer.name_en || data.customer.name_ar}${data.customer.customer_number ? ` — ${data.customer.customer_number}` : ""}`} period={`${fromDate} — ${toDate}`} reportCode={`CUS-ST-${data.customer.customer_number || customerId}`} orientation="landscape" metrics={[{ label: ar ? "الرصيد الافتتاحي" : "Opening balance", value: `${fmt(data.summary.opening_balance)} SAR`, tone: "neutral" }, { label: ar ? "إجمالي الفواتير" : "Total invoiced", value: `${fmt(data.summary.total_invoiced)} SAR`, tone: "blue" }, { label: ar ? "إجمالي المدفوعات" : "Total paid", value: `${fmt(data.summary.total_paid)} SAR`, tone: "green" }, { label: ar ? "الرصيد المستحق" : "Closing balance", value: `${fmt(data.summary.closing_balance)} SAR`, tone: data.summary.closing_balance > 0 ? "red" : "green" }]} tables={[{ title: ar ? "حركات الحساب" : "Account transactions", headers: [ar ? "التاريخ" : "Date", ar ? "النوع" : "Type", ar ? "المرجع" : "Reference", ar ? "البيان" : "Description", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit", ar ? "الرصيد" : "Balance"], rows: data.transactions.map((t: any) => [t.date ? new Date(t.date).toLocaleDateString("en-GB") : "—", t.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : t.type === "opening_balance" ? (ar ? "رصيد افتتاحي" : "Opening balance") : (ar ? "دفعة" : "Payment"), t.reference || "—", ar ? t.description_ar || "—" : t.description_en || t.description_ar || "—", t.debit > 0 ? fmt(t.debit) : "—", t.credit > 0 ? fmt(t.credit) : "—", `${fmt(Math.abs(t.balance))} ${t.balance > 0 ? (ar ? "مدين" : "Dr") : (ar ? "دائن" : "Cr")}`]), totals: [ar ? "الرصيد الختامي" : "Closing balance", "", "", "", fmt(data.summary.total_invoiced), fmt(data.summary.total_paid), `${fmt(data.summary.closing_balance)} SAR`] }]} />}
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
            <label className="form-label">{ar ? "العميل (اختياري)" : "Customer (optional)"}</label>
            <select className="form-input form-select" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">{ar ? "— كل العملاء —" : "— All customers —"}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.customer_number} — {c.name_ar}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 190 }}>
            <label className="form-label">{ar ? "المنطقة / المدينة (اختياري)" : "Zone / City (optional)"}</label>
            <select className="form-input form-select" value={customerCity} onChange={e => setCustomerCity(e.target.value)}>
              <option value="">{ar ? "— كل المناطق —" : "— All zones —"}</option>
              {cities.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
            <label className="form-label">{ar ? "فرع الحساب (اختياري)" : "Account branch (optional)"}</label>
            <SearchableAccountSelect
              accounts={accounts}
              value={accountId}
              onChange={setAccountId}
              locale={locale}
              allowGroups
              placeholder={ar ? "كل الحسابات — اكتب الكود أو الاسم" : "All accounts — type code or name"}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "من" : "From"}</label>
            <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "إلى" : "To"}</label>
            <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض الكشف" : "Show Statement")}
          </button>
        </div>
      </div>

      {data?.aggregate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <span className="card-title">{ar ? `كشف العملاء — ${data.city || "كل المناطق"}` : `Customer Statement — ${data.city || "All zones"}`}</span>
            <StructuredReportPrintButton locale={locale} title={ar ? "كشف حساب العملاء" : "Customer Account Statement"} subtitle={ar ? `الحساب: ${accountId ? (accounts.find(a => a.id === accountId)?.name_ar || accountId) : "كل الحسابات"}` : `Account: ${accountId ? (accounts.find(a => a.id === accountId)?.name_en || accounts.find(a => a.id === accountId)?.name_ar || accountId) : "All accounts"}`} period={`${fromDate} — ${toDate}`} reportCode={`CUS-ST-ALL-${fromDate.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "عدد العملاء" : "Customers", value: String(data.customerCount), tone: "neutral" }, { label: ar ? "الرصيد الافتتاحي" : "Opening balance", value: `${fmt(data.summary.opening_balance)} SAR`, tone: "neutral" }, { label: ar ? "إجمالي الفواتير" : "Total invoiced", value: `${fmt(data.summary.total_invoiced)} SAR`, tone: "blue" }, { label: ar ? "الرصيد المستحق" : "Closing balance", value: `${fmt(data.summary.closing_balance)} SAR`, tone: data.summary.closing_balance > 0 ? "red" : "green" }]} tables={[{ title: ar ? "أرصدة العملاء" : "Customer balances", headers: [ar ? "العميل" : "Customer", ar ? "المدينة" : "City", ar ? "الرصيد الافتتاحي" : "Opening", ar ? "الفواتير" : "Invoiced", ar ? "المدفوع" : "Paid", ar ? "المستحق" : "Outstanding"], rows: data.rows.map((row: any) => [row.customer.name_ar || row.customer.name_en || row.customer.customer_number, row.customer.address_city || "—", fmt(row.summary.opening_balance), fmt(row.summary.total_invoiced), fmt(row.summary.total_paid), fmt(row.summary.closing_balance)]), totals: [ar ? "الإجمالي" : "Total", "", fmt(data.summary.opening_balance), fmt(data.summary.total_invoiced), fmt(data.summary.total_paid), fmt(data.summary.closing_balance)] }]} />
          </div>
          <div className="card-body">
            <div className="grid-3" style={{ marginBottom: 16 }}>
              <div><strong>{ar ? "عدد العملاء" : "Customers"}</strong><div>{data.customerCount}</div></div>
              <div><strong>{ar ? "الرصيد الافتتاحي" : "Opening balance"}</strong><div>{fmt(data.summary.opening_balance)} SAR</div></div>
              <div><strong>{ar ? "إجمالي الفواتير" : "Total invoiced"}</strong><div>{fmt(data.summary.total_invoiced)} SAR</div></div>
              <div><strong>{ar ? "الرصيد المستحق" : "Closing balance"}</strong><div>{fmt(data.summary.closing_balance)} SAR</div></div>
            </div>
            <div className="table-wrapper"><table><thead><tr><th>{ar ? "العميل" : "Customer"}</th><th>{ar ? "المدينة" : "City"}</th><th>{ar ? "الرصيد الافتتاحي" : "Opening"}</th><th>{ar ? "الفواتير" : "Invoiced"}</th><th>{ar ? "المدفوع" : "Paid"}</th><th>{ar ? "المستحق" : "Outstanding"}</th></tr></thead><tbody>{data.rows.map((row: any) => <tr key={row.customer.id}><td>{row.customer.name_ar || row.customer.name_en || row.customer.customer_number}</td><td>{row.customer.address_city || "—"}</td><td>{fmt(row.summary.opening_balance)}</td><td>{fmt(row.summary.total_invoiced)}</td><td>{fmt(row.summary.total_paid)}</td><td>{fmt(row.summary.closing_balance)}</td></tr>)}</tbody></table></div>
          </div>
        </div>
      )}

      {data && !data.aggregate && (
        <>
          {/* Customer header */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{data.customer.name_ar}</div>
                {data.customer.name_en && <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{data.customer.name_en}</div>}
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {ar ? "رقم العميل:" : "Customer #:"} {data.customer.customer_number}
                  {data.customer.vat_number && ` | ${ar ? "الرقم الضريبي:" : "VAT:"} ${data.customer.vat_number}`}
                </div>
              </div>
              <div style={{ textAlign: "end" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{ar ? "الفترة:" : "Period:"} {fromDate} → {toDate}</div>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid-3" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "الرصيد الافتتاحي" : "Opening Balance", value: data.summary.opening_balance, color: "#64748B" },
              { label: ar ? "إجمالي الفواتير" : "Total Invoiced", value: data.summary.total_invoiced, color: "#5A187E" },
              { label: ar ? "إجمالي المدفوعات" : "Total Paid", value: data.summary.total_paid, color: "#6F4A84" },
              { label: ar ? "الرصيد المستحق" : "Closing Balance", value: data.summary.closing_balance, color: data.summary.closing_balance > 0 ? "#DC2626" : "#6F4A84" },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{fmt(s.value)} SAR</div>
              </div>
            ))}
          </div>

          {/* Transactions */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "حركات الحساب" : "Account Transactions"}</span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{data.transactions.length} {ar ? "حركة" : "transactions"}</span>
            </div>
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {data.transactions.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد حركات في هذه الفترة" : "No transactions in this period"}</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "التاريخ" : "Date"}</th>
                      <th>{ar ? "النوع" : "Type"}</th>
                      <th>{ar ? "المرجع" : "Reference"}</th>
                      <th>{ar ? "البيان" : "Description"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "مدين" : "Debit"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "دائن" : "Credit"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الرصيد" : "Balance"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t: any, i: number) => (
                      <tr key={i} style={{ background: t.type === "payment" ? "#F7F2F8" : "transparent" }}>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(t.date).toLocaleDateString("en-SA")}</td>
                        <td>
                          <span className={`badge ${t.type === "invoice" ? "badge-info" : t.type === "opening_balance" ? "badge-warning" : "badge-success"}`}>
                            {t.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : t.type === "opening_balance" ? (ar ? "رصيد افتتاحي" : "Opening balance") : (ar ? "دفعة" : "Payment")}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--primary)", fontSize: 12 }}>{t.reference}</td>
                        <td style={{ fontSize: 13 }}>{ar ? t.description_ar : t.description_en}</td>
                        <td style={{ textAlign: "end", color: "#5A187E", fontWeight: t.debit > 0 ? 600 : 400 }}>
                          {t.debit > 0 ? fmt(t.debit) : "—"}
                        </td>
                        <td style={{ textAlign: "end", color: "#6F4A84", fontWeight: t.credit > 0 ? 600 : 400 }}>
                          {t.credit > 0 ? fmt(t.credit) : "—"}
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: t.balance > 0 ? "#DC2626" : "#6F4A84" }}>
                          {fmt(Math.abs(t.balance))} {t.balance > 0 ? (ar ? "مدين" : "Dr") : (ar ? "دائن" : "Cr")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={4} style={{ padding: "12px 16px" }}>{ar ? "الرصيد الختامي" : "Closing Balance"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#5A187E" }}>{fmt(data.summary.total_invoiced)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#6F4A84" }}>{fmt(data.summary.total_paid)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", fontSize: 15, color: data.summary.closing_balance > 0 ? "#DC2626" : "#6F4A84" }}>
                        {fmt(data.summary.closing_balance)} SAR
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
