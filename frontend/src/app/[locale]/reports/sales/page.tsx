"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getInvoices, getSalesSummary } from "@/lib/sales";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import {
  INVOICE_STATUS_PRESENTATION,
  isFinancialInvoiceStatus,
} from "@/lib/invoiceStatus";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function SalesReportPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const now = new Date();
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [inv, sum] = await Promise.all([getInvoices(), getSalesSummary()]);
      const filtered = inv.data.filter((i: any) => {
        const d = new Date(i.issue_date);
        return d >= new Date(fromDate)
          && d <= new Date(toDate)
          && isFinancialInvoiceStatus(i.status);
      });
      setInvoices(filtered);
      setSummary(sum.data);
      setLoaded(true);
    } catch {} finally { setLoading(false); }
  };

  const totalVAT = invoices.reduce((s, i) => s + Number(i.vat_amount || 0), 0);
  const totalNet = invoices.reduce((s, i) => s + Number(i.taxable_amount || 0), 0);
  const totalGross = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + Math.max(0, Number(i.total||0) - Number(i.paid_amount||0)), 0);
  const todayD = new Date();todayD.setHours(0,0,0,0);
  const overdueCount = invoices.filter(i => {
    const due = i.due_date ? new Date(i.due_date) : null;
    return due && due < todayD && !["paid","cancelled"].includes(i.status);
  }).length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تقرير المبيعات" : "Sales Report"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير المبيعات" : "Sales Report"}</h1>
        </div>
        {loaded && <StructuredReportPrintButton locale={locale} title={ar ? "تقرير المبيعات" : "Sales Report"} subtitle={ar ? "ملخص الفواتير والتحصيلات خلال الفترة" : "Invoice and collection summary for the period"} period={`${fromDate} — ${toDate}`} reportCode={`SR-${toDate.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "عدد الفواتير" : "Invoice count", value: String(invoices.length), tone: "blue" }, { label: ar ? "المبيعات قبل الضريبة" : "Net sales", value: `${fmt(totalNet)} SAR`, tone: "blue" }, { label: ar ? "ضريبة القيمة المضافة" : "VAT", value: `${fmt(totalVAT)} SAR`, tone: "amber" }, { label: ar ? "إجمالي المبيعات" : "Gross sales", value: `${fmt(totalGross)} SAR`, tone: "green" }, { label: ar ? "المحصّل" : "Collected", value: `${fmt(totalPaid)} SAR`, tone: "green" }, { label: ar ? "المستحق" : "Outstanding", value: `${fmt(totalOutstanding)} SAR`, tone: totalOutstanding > 0 ? "red" : "green" }]} tables={[{ title: ar ? "تفاصيل فواتير المبيعات" : "Sales invoice details", headers: [ar ? "رقم الفاتورة" : "Invoice #", ar ? "العميل" : "Customer", ar ? "التاريخ" : "Date", ar ? "قبل الضريبة" : "Net", ar ? "الضريبة" : "VAT", ar ? "الإجمالي" : "Total", ar ? "المدفوع" : "Paid", ar ? "الحالة" : "Status"], rows: invoices.map((inv: any) => [inv.invoice_number || "—", inv.buyer_name_ar || "—", inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("en-GB") : "—", fmt(inv.taxable_amount), fmt(inv.vat_amount), fmt(inv.total), fmt(inv.paid_amount), (INVOICE_STATUS_PRESENTATION[inv.status] || { ar: "حالة غير معروفة" }).ar]), totals: [ar ? "الإجمالي" : "TOTAL", "", "", fmt(totalNet), fmt(totalVAT), fmt(totalGross), fmt(totalPaid), ""] }]} />}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "من" : "From"}</label>
            <input type="date" className="form-input" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "إلى" : "To"}</label>
            <input type="date" className="form-input" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض التقرير" : "Show Report")}
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div id="report-content-sales">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr) repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: ar ? "عدد الفواتير" : "Invoice Count", value: invoices.length, color: "#485668", isMoney: false },
              { label: ar ? "المبيعات قبل الضريبة" : "Net Sales", value: totalNet, color: "#65707E", isMoney: true },
              { label: ar ? "ضريبة القيمة المضافة" : "VAT Amount", value: totalVAT, color: "#D97706", isMoney: true },
              { label: ar ? "إجمالي المبيعات" : "Gross Sales", value: totalGross, color: "#059669", isMoney: true },
              { label: ar ? "المحصّل" : "Collected", value: totalPaid, color: "#059669", isMoney: true },
              { label: ar ? "المستحق" : "Outstanding", value: totalOutstanding, color: overdueCount > 0 ? "#DC2626" : "#D97706", isMoney: true },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                  {s.isMoney ? `${fmt(s.value as number)} SAR` : s.value}
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? `تفاصيل المبيعات — ${fromDate} إلى ${toDate}` : `Sales Details — ${fromDate} to ${toDate}`}</span>
            </div>
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {invoices.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد فواتير في هذه الفترة" : "No invoices in this period"}</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "رقم الفاتورة" : "Invoice #"}</th>
                      <th>{ar ? "العميل" : "Customer"}</th>
                      <th>{ar ? "التاريخ" : "Date"}</th>
                      <th>{ar ? "الاستحقاق" : "Due Date"}</th>
                      <th>{ar ? "النوع" : "Type"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "قبل الضريبة" : "Net"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الضريبة 15%" : "VAT 15%"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                      <th>{ar ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => {
                      const due = inv.due_date ? new Date(inv.due_date) : null;
                      const isOverdue = due && due < todayD && !["paid","cancelled"].includes(inv.status);
                      const st = INVOICE_STATUS_PRESENTATION[inv.status] || { ar: "حالة غير معروفة", badge: "badge-gray" };
                      return (
                        <tr key={inv.id} style={isOverdue ? { background: "#FFF5F5" } : {}}>
                          <td><Link href={`/${locale}/sales/invoices/${inv.id}`} style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>{inv.invoice_number}</Link></td>
                          <td>{inv.buyer_name_ar}</td>
                          <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(inv.issue_date).toLocaleDateString("en-SA")}</td>
                          <td style={{ fontSize: 12 }}>
                            {due ? (
                              <span style={{ color: isOverdue ? "var(--danger)" : "var(--text-secondary)", fontWeight: isOverdue ? 700 : 400 }}>
                                {due.toISOString().split("T")[0]}
                                {isOverdue && <span style={{ display: "block", fontSize: 10 }}>{ar ? "متأخرة" : "Overdue"}</span>}
                              </span>
                            ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                          </td>
                          <td style={{ fontSize: 12 }}>{inv.invoice_type === "standard" ? (ar ? "كاملة" : "Standard") : (ar ? "مبسطة" : "Simplified")}</td>
                          <td style={{ textAlign: "end" }}>{fmt(inv.taxable_amount)}</td>
                          <td style={{ textAlign: "end", color: "#D97706" }}>{fmt(inv.vat_amount)}</td>
                          <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(inv.total)}</td>
                          <td style={{ textAlign: "end", color: "var(--success)" }}>{fmt(inv.paid_amount)}</td>
                          <td><span className={`badge ${isOverdue ? "badge-danger" : st.badge}`}>{isOverdue ? (ar ? "متأخرة" : "Overdue") : st.ar}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={5} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px" }}>{fmt(totalNet)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#D97706" }}>{fmt(totalVAT)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669", fontSize: 15 }}>{fmt(totalGross)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669" }}>{fmt(totalPaid)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
          </div>
        </>
      )}
    </>
  );
}
