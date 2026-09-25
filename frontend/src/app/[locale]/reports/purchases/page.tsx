"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getBills, getVendors } from "@/lib/purchases";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import SearchableSelect from "@/components/ui/SearchableSelect";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const STATUS_AR: Record<string, { label: string; badge: string }> = {
  draft:     { label: "مسودة",  badge: "badge-warning" },
  confirmed: { label: "مؤكدة",  badge: "badge-info" },
  paid:      { label: "مدفوعة", badge: "badge-success" },
  partial:   { label: "جزئية",  badge: "badge-warning" },
  cancelled: { label: "ملغاة",  badge: "badge-danger" },
};

export default function PurchasesReportPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const now = new Date();
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [vendorId, setVendorId] = useState("");
  const [vendors, setVendors] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { getVendors().then(r => setVendors(r.data)).catch(() => {}); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getBills(vendorId ? { vendor_id: vendorId } : undefined);
      const filtered = data.filter((b: any) => {
        const d = new Date(b.bill_date);
        return d >= new Date(fromDate) && d <= new Date(toDate) && b.status !== "cancelled";
      });
      setBills(filtered);
      setLoaded(true);
    } catch {} finally { setLoading(false); }
  };

  const totalNet = bills.reduce((s, b) => s + Number(b.taxable_amount || 0), 0);
  const totalVAT = bills.reduce((s, b) => s + Number(b.vat_amount || 0), 0);
  const totalGross = bills.reduce((s, b) => s + Number(b.total || 0), 0);
  const totalPaid = bills.reduce((s, b) => s + Number(b.paid_amount || 0), 0);
  const totalOutstanding = bills.reduce((s, b) => s + Math.max(0, Number(b.total||0) - Number(b.paid_amount||0)), 0);
  const todayD = new Date();todayD.setHours(0,0,0,0);
  const overdueCount = bills.filter(b => {
    const due = b.due_date ? new Date(b.due_date) : null;
    return due && due < todayD && !["paid","cancelled"].includes(b.status);
  }).length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تقرير المشتريات" : "Purchases Report"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير المشتريات" : "Purchases Report"}</h1>
          <p className="page-subtitle">{ar ? "الفواتير الواردة والمدفوعات للموردين" : "Incoming bills and vendor payments"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/${locale}/reports/purchases/statement`} className="btn btn-secondary btn-sm">
            <Icon name="ledger" size={14} />
            {ar ? "كشف حساب مورد" : "Vendor Statement"}
          </Link>
          {loaded && <StructuredReportPrintButton locale={locale} title={ar ? "تقرير المشتريات" : "Purchases Report"} subtitle={ar ? "ملخص فواتير الموردين والمدفوعات خلال الفترة" : "Vendor bills and payments summary for the period"} period={`${fromDate} — ${toDate}`} reportCode={`PR-${toDate.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "عدد الفواتير" : "Bill count", value: String(bills.length), tone: "blue" }, { label: ar ? "المشتريات قبل الضريبة" : "Net purchases", value: `${fmt(totalNet)} SAR`, tone: "blue" }, { label: ar ? "ضريبة المدخلات" : "Input VAT", value: `${fmt(totalVAT)} SAR`, tone: "amber" }, { label: ar ? "إجمالي المشتريات" : "Gross purchases", value: `${fmt(totalGross)} SAR`, tone: "green" }, { label: ar ? "المدفوع للموردين" : "Paid to vendors", value: `${fmt(totalPaid)} SAR`, tone: "green" }, { label: ar ? "المستحق للموردين" : "Outstanding AP", value: `${fmt(totalOutstanding)} SAR`, tone: totalOutstanding > 0 ? "red" : "green" }]} tables={[{ title: ar ? "تفاصيل فواتير الموردين" : "Vendor bill details", headers: [ar ? "رقم الفاتورة" : "Bill #", ar ? "المورد" : "Vendor", ar ? "التاريخ" : "Date", ar ? "قبل الضريبة" : "Net", ar ? "الضريبة" : "VAT", ar ? "الإجمالي" : "Total", ar ? "المدفوع" : "Paid", ar ? "الحالة" : "Status"], rows: bills.map((bill: any) => [bill.bill_number || "—", bill.vendor_name_ar || "—", bill.bill_date ? new Date(bill.bill_date).toLocaleDateString("en-GB") : "—", fmt(bill.taxable_amount), fmt(bill.vat_amount), fmt(bill.total), fmt(bill.paid_amount), (STATUS_AR[bill.status] || { label: bill.status || "—" }).label]), totals: [ar ? "الإجمالي" : "TOTAL", "", "", fmt(totalNet), fmt(totalVAT), fmt(totalGross), fmt(totalPaid), ""] }]} />}
        </div>
      </div>

      {/* Filters */}
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
          <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
            <label className="form-label">{ar ? "المورد (اختياري)" : "Vendor (optional)"}</label>
            <SearchableSelect locale={locale} value={vendorId} onChange={setVendorId} placeholder={ar ? "ابحث عن المورد..." : "Search vendor..."} options={[{ value: "", label: ar ? "— كل الموردين —" : "— All Vendors —" }, ...vendors.map(v => ({ value: v.id, label: `${v.vendor_number ? `${v.vendor_number} — ` : ""}${v.name_ar}`, searchText: `${v.vendor_number || ""} ${v.name_ar || ""} ${v.name_en || ""}` }))]} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض التقرير" : "Show Report")}
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div id="report-content-purchases">
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr) repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { label: ar ? "عدد الفواتير" : "Bill Count", value: bills.length, color: "#5A187E", isMoney: false },
              { label: ar ? "المشتريات قبل الضريبة" : "Net Purchases", value: totalNet, color: "#75617F", isMoney: true },
              { label: ar ? "ضريبة المدخلات" : "Input VAT", value: totalVAT, color: "#D97706", isMoney: true },
              { label: ar ? "إجمالي المشتريات" : "Gross Purchases", value: totalGross, color: "#6F4A84", isMoney: true },
              { label: ar ? "المدفوع للموردين" : "Paid to Vendors", value: totalPaid, color: "#6F4A84", isMoney: true },
              { label: ar ? "المستحق للموردين" : "Outstanding AP", value: totalOutstanding, color: overdueCount > 0 ? "#DC2626" : "#D97706", isMoney: true },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                  {s.isMoney ? `${fmt(s.value as number)} SAR` : s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? `تفاصيل المشتريات — ${fromDate} إلى ${toDate}` : `Purchase Details — ${fromDate} to ${toDate}`}</span>
            </div>
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {bills.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد فواتير في هذه الفترة" : "No bills in this period"}</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "رقم الفاتورة" : "Bill #"}</th>
                      <th>{ar ? "المورد" : "Vendor"}</th>
                      <th>{ar ? "التاريخ" : "Date"}</th>
                      <th>{ar ? "الاستحقاق" : "Due Date"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "قبل الضريبة" : "Net"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الضريبة 15%" : "VAT 15%"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                      <th>{ar ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bills.map(bill => {
                      const due = bill.due_date ? new Date(bill.due_date) : null;
                      const isOverdue = due && due < todayD && !["paid","cancelled"].includes(bill.status);
                      const st = STATUS_AR[bill.status] || { label: bill.status, badge: "badge-gray" };
                      return (
                        <tr key={bill.id} style={isOverdue ? { background: "#FFF5F5" } : {}}>
                          <td>
                            <Link href={`/${locale}/purchases/bills/${bill.id}`} style={{ color: "var(--primary)", fontWeight: 700, textDecoration: "none" }}>
                              {bill.bill_number}
                            </Link>
                          </td>
                          <td>{bill.vendor_name_ar}</td>
                          <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(bill.bill_date).toLocaleDateString("en-SA")}</td>
                          <td style={{ fontSize: 12 }}>
                            {due ? (
                              <span style={{ color: isOverdue ? "var(--danger)" : "var(--text-secondary)", fontWeight: isOverdue ? 700 : 400 }}>
                                {due.toISOString().split("T")[0]}
                                {isOverdue && <span style={{ display: "block", fontSize: 10 }}>{ar ? "متأخرة" : "Overdue"}</span>}
                              </span>
                            ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                          </td>
                          <td style={{ textAlign: "end" }}>{fmt(bill.taxable_amount)}</td>
                          <td style={{ textAlign: "end", color: "#D97706" }}>{fmt(bill.vat_amount)}</td>
                          <td style={{ textAlign: "end", fontWeight: 700 }}>{fmt(bill.total)}</td>
                          <td style={{ textAlign: "end", color: "var(--success)" }}>{fmt(bill.paid_amount)}</td>
                          <td><span className={`badge ${isOverdue ? "badge-danger" : st.badge}`}>{isOverdue ? (ar ? "متأخرة" : "Overdue") : st.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={4} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px" }}>{fmt(totalNet)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#D97706" }}>{fmt(totalVAT)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#6F4A84", fontSize: 15 }}>{fmt(totalGross)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#6F4A84" }}>{fmt(totalPaid)}</td>
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
