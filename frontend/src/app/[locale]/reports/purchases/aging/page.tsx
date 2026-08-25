"use client";
import { useState, use } from "react";
import Link from "next/link";
import { getBills } from "@/lib/purchases";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

interface AgingRow { vendor: string; current: number; days30: number; days60: number; days90: number; over90: number; total: number; }

const cols = [
  { key: "current", ar: "جاري",        en: "Current",      color: "#059669" },
  { key: "days30",  ar: "1-30 يوم",     en: "1-30 Days",    color: "#D97706" },
  { key: "days60",  ar: "31-60 يوم",    en: "31-60 Days",   color: "#F97316" },
  { key: "days90",  ar: "61-90 يوم",    en: "61-90 Days",   color: "#DC2626" },
  { key: "over90",  ar: "أكثر من 90",   en: "Over 90 Days", color: "#65707E" },
];

export default function APAgingPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [asOf, setAsOf] = useState(new Date().toISOString().split("T")[0]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await getBills();
      const asOfDate = new Date(asOf);
      const unpaid = (data || []).filter((b: any) =>
        ["confirmed", "partial"].includes(b.status) &&
        Number(b.total) - Number(b.paid_amount) > 0.01
      );
      const map: Record<string, AgingRow> = {};
      for (const bill of unpaid) {
        const vendor = bill.vendor_name_ar || "Unknown";
        if (!map[vendor]) map[vendor] = { vendor, current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
        const balance = Number(bill.total) - Number(bill.paid_amount);
        const dueDate = bill.due_date ? new Date(bill.due_date) : new Date(bill.bill_date);
        const daysPast = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysPast <= 0)       map[vendor].current += balance;
        else if (daysPast <= 30) map[vendor].days30  += balance;
        else if (daysPast <= 60) map[vendor].days60  += balance;
        else if (daysPast <= 90) map[vendor].days90  += balance;
        else                     map[vendor].over90  += balance;
        map[vendor].total += balance;
      }
      setRows(Object.values(map).sort((a, b) => b.total - a.total));
      setLoaded(true);
    } catch {} finally { setLoading(false); }
  };

  const totals = rows.reduce(
    (acc, r) => ({ current: acc.current + r.current, days30: acc.days30 + r.days30, days60: acc.days60 + r.days60, days90: acc.days90 + r.days90, over90: acc.over90 + r.over90, total: acc.total + r.total }),
    { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 }
  );

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/reports/purchases`}>{ar ? "تقارير المشتريات" : "Purchases Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "عمر ديون الموردين" : "AP Aging"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير عمر الديون — الموردون" : "AP Aging Report"}</h1>
          <p className="page-subtitle">{ar ? "تحليل الديون المستحقة للموردين حسب الفترة الزمنية" : "Outstanding payables by aging period"}</p>
        </div>
        {loaded && <StructuredReportPrintButton locale={locale} title={ar ? "تقرير عمر ديون الموردين" : "AP Aging Report"} subtitle={ar ? "تحليل الذمم المستحقة للموردين حسب شريحة التأخر" : "Outstanding payables by aging bucket"} period={ar ? `كما في ${asOf}` : `As of ${asOf}`} reportCode={`AP-AGE-${asOf.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "جاري" : "Current", value: `${fmt(totals.current)} SAR`, tone: "green" }, { label: ar ? "1-30 يوم" : "1-30 days", value: `${fmt(totals.days30)} SAR`, tone: "amber" }, { label: ar ? "31-60 يوم" : "31-60 days", value: `${fmt(totals.days60)} SAR`, tone: "amber" }, { label: ar ? "61-90 يوم" : "61-90 days", value: `${fmt(totals.days90)} SAR`, tone: "red" }, { label: ar ? "أكثر من 90 يوم" : "Over 90 days", value: `${fmt(totals.over90)} SAR`, tone: "red" }, { label: ar ? "إجمالي الدائنين" : "Total payables", value: `${fmt(totals.total)} SAR`, tone: "blue" }]} tables={[{ title: ar ? "تحليل الموردين حسب الاستحقاق" : "Payables by vendor", headers: [ar ? "المورد" : "Vendor", ar ? "جاري" : "Current", ar ? "1-30" : "1-30", ar ? "31-60" : "31-60", ar ? "61-90" : "61-90", ar ? ">90" : ">90", ar ? "الإجمالي" : "Total"], rows: rows.map(row => [row.vendor, fmt(row.current), fmt(row.days30), fmt(row.days60), fmt(row.days90), fmt(row.over90), fmt(row.total)]), totals: [ar ? "الإجمالي" : "TOTAL", fmt(totals.current), fmt(totals.days30), fmt(totals.days60), fmt(totals.days90), fmt(totals.over90), fmt(totals.total)] }]} />}
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{ar ? "بتاريخ" : "As of Date"}</label>
            <input type="date" className="form-input" value={asOf} onChange={e => setAsOf(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض التقرير" : "Show Report")}
          </button>
        </div>
      </div>

      {loaded && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {cols.map(c => (
              <div key={c.key} className="card" style={{ padding: "14px 16px", flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? c.ar : c.en}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{fmt((totals as any)[c.key])}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>SAR</div>
              </div>
            ))}
            <div className="card" style={{ padding: "14px 16px", flex: 1, minWidth: 140, borderColor: "#485668" }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "الإجمالي" : "Total"}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#485668" }}>{fmt(totals.total)}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>SAR</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? `تقرير عمر ديون الموردين — بتاريخ ${asOf}` : `AP Aging Report — As of ${asOf}`}</span>
            </div>
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {rows.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد ديون مستحقة للموردين" : "No outstanding payables"}</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "المورد" : "Vendor"}</th>
                      {cols.map(c => <th key={c.key} style={{ textAlign: "end" }}>{ar ? c.ar : c.en}</th>)}
                      <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.vendor}>
                        <td style={{ fontWeight: 500 }}>{row.vendor}</td>
                        {cols.map(c => (
                          <td key={c.key} style={{ textAlign: "end", color: (row as any)[c.key] > 0 ? c.color : "var(--text-muted)" }}>
                            {(row as any)[c.key] > 0 ? fmt((row as any)[c.key]) : "—"}
                          </td>
                        ))}
                        <td style={{ textAlign: "end", fontWeight: 700, color: "#485668" }}>{fmt(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      {cols.map(c => (
                        <td key={c.key} style={{ textAlign: "end", padding: "12px 16px", color: c.color }}>{fmt((totals as any)[c.key])}</td>
                      ))}
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#485668", fontSize: 15 }}>{fmt(totals.total)}</td>
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
