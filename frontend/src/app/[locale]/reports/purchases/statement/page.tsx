"use client";
import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getVendors, getVendorStatement } from "@/lib/purchases";
import { getAccounts } from "@/lib/accounting";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function VendorStatementPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const searchParams = useSearchParams();
  const now = new Date();
  const [vendors, setVendors] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState(searchParams.get("vendor_id") || "");
  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([getVendors(), getAccounts()]).then(([vendorsRes, accountsRes]) => {
      setVendors(vendorsRes.data);
      setAccounts(accountsRes.data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const preId = searchParams.get("vendor_id");
    if (preId) setVendorId(preId);
  }, [searchParams]);

  const load = async () => {
    if (!vendorId) return alert(ar ? "اختر المورد" : "Select vendor");
    setLoading(true);
    try {
      const { data: res } = await getVendorStatement(vendorId, fromDate + "T00:00:00", toDate + "T23:59:59", accountId || undefined);
      setData(res);
    } catch (e: any) {
      alert(e?.response?.data?.detail || "Error");
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/reports/purchases`}>{ar ? "تقارير المشتريات" : "Purchases Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "كشف حساب المورد" : "Vendor Statement"}</span>
          </div>
          <h1 className="page-title">{ar ? "كشف حساب المورد" : "Vendor Account Statement"}</h1>
          <p className="page-subtitle">{ar ? "جميع الفواتير والمدفوعات والرصيد المستحق للمورد" : "All bills, payments and outstanding balance"}</p>
        </div>
        {data && <StructuredReportPrintButton locale={locale} title={ar ? "كشف حساب مورد" : "Vendor Account Statement"} subtitle={`${data.vendor.vendor_number || ""} — ${ar ? data.vendor.name_ar : data.vendor.name_en || data.vendor.name_ar}`} period={`${fromDate} — ${toDate}`} reportCode={`VEN-ST-${data.vendor.vendor_number || vendorId}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي الفواتير الواردة" : "Total bills", value: `${fmt(data.summary.total_billed)} SAR`, tone: "red" }, { label: ar ? "إجمالي المدفوعات" : "Total paid", value: `${fmt(data.summary.total_paid)} SAR`, tone: "green" }, { label: ar ? "الرصيد المستحق للمورد" : "Outstanding balance", value: `${fmt(data.summary.closing_balance)} SAR`, tone: data.summary.closing_balance > 0 ? "red" : "green" }, { label: ar ? "عدد الحركات" : "Transactions", value: String(data.transactions.length), tone: "neutral" }]} tables={[{ title: ar ? "حركات حساب المورد" : "Vendor account transactions", headers: [ar ? "التاريخ" : "Date", ar ? "النوع" : "Type", ar ? "المرجع" : "Reference", ar ? "البيان" : "Description", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit", ar ? "الرصيد" : "Balance"], rows: data.transactions.map((t: any) => [t.date ? new Date(t.date).toLocaleDateString("en-GB") : "—", t.type === "bill" ? (ar ? "فاتورة واردة" : "Bill") : (ar ? "سند صرف" : "Payment"), t.reference || "—", ar ? t.description_ar || "—" : t.description_en || t.description_ar || "—", t.debit > 0 ? fmt(t.debit) : "—", t.credit > 0 ? fmt(t.credit) : "—", `${fmt(Math.abs(t.balance))} ${t.balance > 0 ? (ar ? "مستحق" : "Owed") : (ar ? "مسدد" : "Paid")}`]), totals: [ar ? "الرصيد الختامي" : "Closing balance", "", "", "", fmt(data.summary.total_paid), fmt(data.summary.total_billed), `${fmt(data.summary.closing_balance)} SAR`] }]} />}
      </div>

      {/* Filter */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
            <label className="form-label">{ar ? "المورد" : "Vendor"} <span className="required">*</span></label>
            <select className="form-input form-select" value={vendorId} onChange={e => setVendorId(e.target.value)}>
              <option value="">{ar ? "— اختر المورد —" : "— Select Vendor —"}</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.vendor_number} — {v.name_ar}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 260 }}>
            <label className="form-label">{ar ? "الحساب (اختياري)" : "Account (optional)"}</label>
            <select className="form-input form-select" value={accountId} onChange={e => setAccountId(e.target.value)}>
              <option value="">{ar ? "— كل حسابات المورد —" : "— All vendor accounts —"}</option>
              {accounts.filter(a => a.is_active && a.is_posting && (a.allow_direct_posting ?? true)).map(a => <option key={a.id} value={a.id}>{a.code} — {ar ? a.name_ar : a.name_en || a.name_ar}</option>)}
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
          {/* Vendor Header */}
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-body" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{data.vendor.name_ar}</div>
                {data.vendor.name_en && (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{data.vendor.name_en}</div>
                )}
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <span>{ar ? "رقم المورد:" : "Vendor #:"} <strong>{data.vendor.vendor_number}</strong></span>
                  {data.vendor.vat_number && (
                    <span>{ar ? "الرقم الضريبي:" : "VAT:"} <strong>{data.vendor.vat_number}</strong></span>
                  )}
                  {data.vendor.phone && (
                    <span>{ar ? "الهاتف:" : "Phone:"} <strong>{data.vendor.phone}</strong></span>
                  )}
                  {data.vendor.address_city && (
                    <span>{ar ? "المدينة:" : "City:"} <strong>{data.vendor.address_city}</strong></span>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "end" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {ar ? "الفترة:" : "Period:"} {fromDate} → {toDate}
                </div>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid-3" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "إجمالي الفواتير الواردة" : "Total Bills", value: data.summary.total_billed, color: "#DC2626" },
              { label: ar ? "إجمالي المدفوعات" : "Total Paid", value: data.summary.total_paid, color: "#6F4A84" },
              { label: ar ? "الرصيد المستحق للمورد" : "Outstanding Balance", value: data.summary.closing_balance, color: data.summary.closing_balance > 0 ? "#DC2626" : "#6F4A84" },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{fmt(s.value)} SAR</div>
              </div>
            ))}
          </div>

          {/* Transactions Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "حركات الحساب" : "Account Transactions"}</span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {data.transactions.length} {ar ? "حركة" : "transactions"}
              </span>
            </div>
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {data.transactions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">{ar ? "لا توجد حركات في هذه الفترة" : "No transactions in this period"}</div>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "التاريخ" : "Date"}</th>
                      <th>{ar ? "النوع" : "Type"}</th>
                      <th>{ar ? "المرجع" : "Reference"}</th>
                      <th>{ar ? "البيان" : "Description"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "مدين (دفعنا)" : "Debit (Paid)"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "دائن (مستحق)" : "Credit (Owed)"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الرصيد" : "Balance"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.transactions.map((t: any, i: number) => (
                      <tr key={i} style={{ background: t.type === "payment" ? "#F7F2F8" : "transparent" }}>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {new Date(t.date).toLocaleDateString("en-SA")}
                        </td>
                        <td>
                          <span className={`badge ${t.type === "bill" ? "badge-warning" : "badge-success"}`}>
                            {t.type === "bill"
                              ? (ar ? "فاتورة واردة" : "Bill")
                              : (ar ? "سند صرف" : "Payment")}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--primary)", fontSize: 12 }}>{t.reference}</td>
                        <td style={{ fontSize: 13 }}>{ar ? t.description_ar : t.description_en}</td>
                        <td style={{ textAlign: "end", color: "#6F4A84", fontWeight: t.debit > 0 ? 600 : 400 }}>
                          {t.debit > 0 ? fmt(t.debit) : "—"}
                        </td>
                        <td style={{ textAlign: "end", color: "#DC2626", fontWeight: t.credit > 0 ? 600 : 400 }}>
                          {t.credit > 0 ? fmt(t.credit) : "—"}
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: t.balance > 0 ? "#DC2626" : "#6F4A84" }}>
                          {fmt(Math.abs(t.balance))}
                          <span style={{ fontSize: 11, marginInlineStart: 4 }}>
                            {t.balance > 0 ? (ar ? "مستحق" : "Owed") : (ar ? "مسدد" : "Paid")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={4} style={{ padding: "12px 16px" }}>{ar ? "الرصيد الختامي" : "Closing Balance"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#6F4A84" }}>
                        {fmt(data.summary.total_paid)}
                      </td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#DC2626" }}>
                        {fmt(data.summary.total_billed)}
                      </td>
                      <td style={{ textAlign: "end", padding: "12px 16px", fontSize: 15, color: data.summary.closing_balance > 0 ? "#DC2626" : "#6F4A84" }}>
                        {fmt(data.summary.closing_balance)} SAR
                        <span style={{ fontSize: 12, marginInlineStart: 6 }}>
                          {data.summary.closing_balance > 0 ? (ar ? "مستحق للمورد" : "Owed to Vendor") : (ar ? "مسدد بالكامل" : "Fully Paid")}
                        </span>
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
