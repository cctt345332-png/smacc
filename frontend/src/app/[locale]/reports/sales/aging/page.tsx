"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getInvoices } from "@/lib/sales";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

interface AgingRow { customer: string; current: number; days30: number; days60: number; days90: number; over90: number; total: number; }

export default function AgingReportPage(props: { params: Promise<{ locale: string }> }) {
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
      const { data } = await getInvoices();
      const asOfDate = new Date(asOf);

      // فلتر الفواتير غير المدفوعة بالكامل
      const unpaid = data.filter((i: any) =>
        ["confirmed", "partial", "overdue"].includes(i.status) &&
        Number(i.total) - Number(i.paid_amount) > 0.01
      );

      // تجميع حسب العميل
      const map: Record<string, AgingRow> = {};
      for (const inv of unpaid) {
        const customer = inv.buyer_name_ar || "Unknown";
        if (!map[customer]) map[customer] = { customer, current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 };
        const balance = Number(inv.total) - Number(inv.paid_amount);
        const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.issue_date);
        const daysPast = Math.floor((asOfDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysPast <= 0) map[customer].current += balance;
        else if (daysPast <= 30) map[customer].days30 += balance;
        else if (daysPast <= 60) map[customer].days60 += balance;
        else if (daysPast <= 90) map[customer].days90 += balance;
        else map[customer].over90 += balance;
        map[customer].total += balance;
      }

      setRows(Object.values(map).sort((a, b) => b.total - a.total));
      setLoaded(true);
    } catch {} finally { setLoading(false); }
  };

  const totals = rows.reduce((acc, r) => ({
    current: acc.current + r.current, days30: acc.days30 + r.days30,
    days60: acc.days60 + r.days60, days90: acc.days90 + r.days90,
    over90: acc.over90 + r.over90, total: acc.total + r.total,
  }), { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 });

  const cols = [
    { key: "current", label: ar ? "جاري" : "Current", color: "#059669" },
    { key: "days30", label: ar ? "1-30 يوم" : "1-30 Days", color: "#D97706" },
    { key: "days60", label: ar ? "31-60 يوم" : "31-60 Days", color: "#F97316" },
    { key: "days90", label: ar ? "61-90 يوم" : "61-90 Days", color: "#DC2626" },
    { key: "over90", label: ar ? "أكثر من 90" : "Over 90 Days", color: "#75617F" },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تقرير عمر الديون" : "Aging Report"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير عمر الديون" : "Accounts Receivable Aging"}</h1>
          <p className="page-subtitle">{ar ? "تحليل الديون المستحقة حسب الفترة الزمنية" : "Outstanding receivables by aging period"}</p>
        </div>
        {loaded && <StructuredReportPrintButton locale={locale} title={ar ? "تقرير عمر الديون" : "Accounts Receivable Aging"} subtitle={ar ? "تحليل الذمم المستحقة حسب شريحة التأخر" : "Outstanding receivables by aging bucket"} period={ar ? `كما في ${asOf}` : `As of ${asOf}`} reportCode={`AR-AGE-${asOf.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "جاري" : "Current", value: `${fmt(totals.current)} SAR`, tone: "green" }, { label: ar ? "1-30 يوم" : "1-30 days", value: `${fmt(totals.days30)} SAR`, tone: "amber" }, { label: ar ? "31-60 يوم" : "31-60 days", value: `${fmt(totals.days60)} SAR`, tone: "amber" }, { label: ar ? "61-90 يوم" : "61-90 days", value: `${fmt(totals.days90)} SAR`, tone: "red" }, { label: ar ? "أكثر من 90 يوم" : "Over 90 days", value: `${fmt(totals.over90)} SAR`, tone: "red" }, { label: ar ? "إجمالي الذمم" : "Total receivables", value: `${fmt(totals.total)} SAR`, tone: "blue" }]} tables={[{ title: ar ? "تحليل الذمم حسب العميل" : "Receivables by customer", headers: [ar ? "العميل" : "Customer", ar ? "جاري" : "Current", ar ? "1-30" : "1-30", ar ? "31-60" : "31-60", ar ? "61-90" : "61-90", ar ? ">90" : ">90", ar ? "الإجمالي" : "Total"], rows: rows.map(row => [row.customer, fmt(row.current), fmt(row.days30), fmt(row.days60), fmt(row.days90), fmt(row.over90), fmt(row.total)]), totals: [ar ? "الإجمالي" : "TOTAL", fmt(totals.current), fmt(totals.days30), fmt(totals.days60), fmt(totals.days90), fmt(totals.over90), fmt(totals.total)] }]} />}
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
          {/* Summary */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            {cols.map(c => (
              <div key={c.key} className="card" style={{ padding: "14px 16px", flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: c.color }}>{fmt((totals as any)[c.key])}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>SAR</div>
              </div>
            ))}
            <div className="card" style={{ padding: "14px 16px", flex: 1, minWidth: 140, borderColor: "#5A187E" }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{ar ? "الإجمالي" : "Total"}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#5A187E" }}>{fmt(totals.total)}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>SAR</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? `تقرير عمر الديون — بتاريخ ${asOf}` : `Aging Report — As of ${asOf}`}</span>
            </div>
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {rows.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد ديون مستحقة" : "No outstanding receivables"}</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "العميل" : "Customer"}</th>
                      {cols.map(c => <th key={c.key} style={{ textAlign: "end" }}>{c.label}</th>)}
                      <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.customer}>
                        <td style={{ fontWeight: 500 }}>{row.customer}</td>
                        {cols.map(c => (
                          <td key={c.key} style={{ textAlign: "end", color: (row as any)[c.key] > 0 ? c.color : "var(--text-muted)" }}>
                            {(row as any)[c.key] > 0 ? fmt((row as any)[c.key]) : "—"}
                          </td>
                        ))}
                        <td style={{ textAlign: "end", fontWeight: 700, color: "#5A187E" }}>{fmt(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      {cols.map(c => (
                        <td key={c.key} style={{ textAlign: "end", padding: "12px 16px", color: c.color }}>{fmt((totals as any)[c.key])}</td>
                      ))}
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#5A187E", fontSize: 15 }}>{fmt(totals.total)}</td>
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
