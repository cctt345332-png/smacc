"use client";
import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getCustomers, getCustomerStatement } from "@/lib/sales";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

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
  const [customerId, setCustomerId] = useState(searchParams.get("customer_id") || "");
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { getCustomers().then(({ data }) => setCustomers(data)); }, []);

  // تحميل تلقائي إذا كان customer_id في الـ URL
  useEffect(() => {
    const preId = searchParams.get("customer_id");
    if (preId) { setCustomerId(preId); }
  }, [searchParams]);

  const load = async () => {
    if (!customerId) return alert(ar ? "اختر العميل" : "Select customer");
    setLoading(true);
    try {
      const { data: res } = await getCustomerStatement(customerId, fromDate + "T00:00:00", toDate + "T23:59:59");
      setData(res);
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
        {data && <StructuredReportPrintButton locale={locale} title={ar ? "كشف حساب عميل" : "Customer Account Statement"} subtitle={`${data.customer.customer_number || ""} — ${ar ? data.customer.name_ar : data.customer.name_en || data.customer.name_ar}`} period={`${fromDate} — ${toDate}`} reportCode={`CUS-ST-${data.customer.customer_number || customerId}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي الفواتير" : "Total invoiced", value: `${fmt(data.summary.total_invoiced)} SAR`, tone: "blue" }, { label: ar ? "إجمالي المدفوعات" : "Total paid", value: `${fmt(data.summary.total_paid)} SAR`, tone: "green" }, { label: ar ? "الرصيد المستحق" : "Closing balance", value: `${fmt(data.summary.closing_balance)} SAR`, tone: data.summary.closing_balance > 0 ? "red" : "green" }, { label: ar ? "عدد الحركات" : "Transactions", value: String(data.transactions.length), tone: "neutral" }]} tables={[{ title: ar ? "حركات الحساب" : "Account transactions", headers: [ar ? "التاريخ" : "Date", ar ? "النوع" : "Type", ar ? "المرجع" : "Reference", ar ? "البيان" : "Description", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit", ar ? "الرصيد" : "Balance"], rows: data.transactions.map((t: any) => [t.date ? new Date(t.date).toLocaleDateString("en-GB") : "—", t.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : (ar ? "دفعة" : "Payment"), t.reference || "—", ar ? t.description_ar || "—" : t.description_en || t.description_ar || "—", t.debit > 0 ? fmt(t.debit) : "—", t.credit > 0 ? fmt(t.credit) : "—", `${fmt(Math.abs(t.balance))} ${t.balance > 0 ? (ar ? "مدين" : "Dr") : (ar ? "دائن" : "Cr")}`]), totals: [ar ? "الرصيد الختامي" : "Closing balance", "", "", "", fmt(data.summary.total_invoiced), fmt(data.summary.total_paid), `${fmt(data.summary.closing_balance)} SAR`] }]} />}
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
            <label className="form-label">{ar ? "العميل" : "Customer"} <span className="required">*</span></label>
            <select className="form-input form-select" value={customerId} onChange={e => setCustomerId(e.target.value)}>
              <option value="">{ar ? "— اختر العميل —" : "— Select Customer —"}</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.customer_number} — {c.name_ar}</option>)}
            </select>
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

      {data && (
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
              { label: ar ? "إجمالي الفواتير" : "Total Invoiced", value: data.summary.total_invoiced, color: "#587795" },
              { label: ar ? "إجمالي المدفوعات" : "Total Paid", value: data.summary.total_paid, color: "#059669" },
              { label: ar ? "الرصيد المستحق" : "Closing Balance", value: data.summary.closing_balance, color: data.summary.closing_balance > 0 ? "#DC2626" : "#059669" },
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
                      <tr key={i} style={{ background: t.type === "payment" ? "#F0FDF4" : "transparent" }}>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(t.date).toLocaleDateString("en-SA")}</td>
                        <td>
                          <span className={`badge ${t.type === "invoice" ? "badge-info" : "badge-success"}`}>
                            {t.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : (ar ? "دفعة" : "Payment")}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--primary)", fontSize: 12 }}>{t.reference}</td>
                        <td style={{ fontSize: 13 }}>{ar ? t.description_ar : t.description_en}</td>
                        <td style={{ textAlign: "end", color: "#587795", fontWeight: t.debit > 0 ? 600 : 400 }}>
                          {t.debit > 0 ? fmt(t.debit) : "—"}
                        </td>
                        <td style={{ textAlign: "end", color: "#059669", fontWeight: t.credit > 0 ? 600 : 400 }}>
                          {t.credit > 0 ? fmt(t.credit) : "—"}
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: t.balance > 0 ? "#DC2626" : "#059669" }}>
                          {fmt(Math.abs(t.balance))} {t.balance > 0 ? (ar ? "مدين" : "Dr") : (ar ? "دائن" : "Cr")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={4} style={{ padding: "12px 16px" }}>{ar ? "الرصيد الختامي" : "Closing Balance"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#587795" }}>{fmt(data.summary.total_invoiced)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669" }}>{fmt(data.summary.total_paid)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", fontSize: 15, color: data.summary.closing_balance > 0 ? "#DC2626" : "#059669" }}>
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
