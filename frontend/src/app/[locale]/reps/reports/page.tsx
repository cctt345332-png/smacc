"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getReps, getRepSummary } from "@/lib/reps";
import api from "@/lib/api";

const fmt  = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtD = (d: any) => d ? new Date(d).toLocaleDateString("en-US") : "—";

export default function RepsReportsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [reps, setReps] = useState<any[]>([]);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"performance" | "invoices" | "stock">("performance");
  const [filterRep, setFilterRep] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  /* ── تصدير Excel ────────────────────────────────────────────────── */
  const exportToExcel = (type: "performance" | "invoices") => {
    if (type === "performance") {
      const rows = [
        ["المندوب", "الكود", "المنطقة", "الهدف الشهري", "المبيعات", "نسبة التحقق%", "المحصّل", "المستحق", "عدد الفواتير", "العمولة"],
        ...repStats.map(({ rep, sum, pct, commission }) => [
          rep.full_name, rep.rep_code, rep.zone || "",
          rep.target_monthly || 0,
          Number(sum.total_sales || 0).toFixed(2),
          pct !== null ? pct : "",
          Number(sum.total_collected || 0).toFixed(2),
          Number(sum.outstanding || 0).toFixed(2),
          sum.invoice_count || 0,
          commission > 0 ? commission.toFixed(2) : 0,
        ]),
        ["الإجمالي", "", "", "",
          totalSales.toFixed(2), "", totalCollected.toFixed(2), totalOutstanding.toFixed(2),
          repStats.reduce((s, r) => s + (r.sum.invoice_count || 0), 0),
          totalCommission.toFixed(2),
        ],
      ];
      downloadCSV(rows, "reps-performance.csv");
    } else {
      const rows = [
        ["رقم الفاتورة", "المندوب", "المنطقة", "العميل", "الحالة", "طريقة الدفع", "التاريخ", "الإجمالي", "المدفوع", "المتبقي"],
        ...filteredInvoices.map((inv: any) => {
          const rep = repMap[inv.rep_id];
          const remaining = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));
          return [
            inv.invoice_number, rep?.full_name || "", rep?.zone || "",
            inv.buyer_name_ar, STATUS_AR[inv.status] || inv.status,
            { cash: "نقد", credit: "آجل", cheque: "شيك", transfer: "تحويل" }[inv.invoice_payment_method as string] || "",
            inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("en-US") : "",
            Number(inv.total || 0).toFixed(2),
            Number(inv.paid_amount || 0).toFixed(2),
            remaining.toFixed(2),
          ];
        }),
      ];
      downloadCSV(rows, "reps-invoices.csv");
    }
  };

  const downloadCSV = (rows: any[][], filename: string) => {
    const bom = "\uFEFF"; // BOM for Arabic in Excel
    const csv = bom + rows.map(r =>
      r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const repsRes = await getReps();
        const list = Array.isArray(repsRes.data) ? repsRes.data : [];
        setReps(list);
        const [sumResults, invRes] = await Promise.all([
          Promise.allSettled(list.map((r: any) => getRepSummary(r.id))),
          api.get("/sales/invoices"),
        ]);
        const map: Record<string, any> = {};
        sumResults.forEach((r, i) => {
          if (r.status === "fulfilled") map[list[i].id] = r.value.data;
        });
        setSummaries(map);
        setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, []);

  const repMap: Record<string, any> = {};
  reps.forEach(r => { repMap[r.id] = r; });

  const filteredInvoices = invoices.filter((inv: any) => {
    const matchR = !filterRep || inv.rep_id === filterRep;
    const matchS = !filterStatus || inv.status === filterStatus;
    const matchFrom = !dateFrom || new Date(inv.issue_date) >= new Date(dateFrom);
    const matchTo = !dateTo || new Date(inv.issue_date) <= new Date(dateTo + "T23:59:59");
    const matchZone = !filterZone || (repMap[inv.rep_id]?.zone || "") === filterZone;
    const matchMonth = !filterMonth || (inv.issue_date || "").startsWith(filterMonth);
    // فقط الفواتير المؤكدة والمدفوعة في الإحصائيات
    return matchR && matchS && matchFrom && matchTo && matchZone && matchMonth && inv.rep_id;
  });

  // المناطق المتاحة للفلتر
  const zones = [...new Set(reps.map(r => r.zone).filter(Boolean))] as string[];

  // إحصائيات مجمّعة لكل مندوب — مع فلتر المنطقة
  const repStats = reps
    .filter(rep => !filterZone || (rep.zone || "") === filterZone)
    .map(rep => {
    const sum = summaries[rep.id] || {};
    const repInvs = filteredInvoices.filter((i: any) => i.rep_id === rep.id);
    const pct = rep.target_monthly > 0
      ? Math.min(100, Math.round((Number(sum.total_sales || 0) / Number(rep.target_monthly)) * 100))
      : null;
    const commission = rep.commission_pct > 0
      ? Number(sum.total_sales || 0) * Number(rep.commission_pct) / 100
      : 0;
    return { rep, sum, repInvs, pct, commission };
  }).sort((a, b) => Number(b.sum.total_sales || 0) - Number(a.sum.total_sales || 0));

  const STATUS_AR: Record<string, string> = {
    draft: "مسودة", submitted: "بانتظار المراجعة", approved: "موافق عليها",
    rejected: "مرفوضة", confirmed: "مؤكدة", paid: "مدفوعة",
    partial: "جزئي", cancelled: "ملغاة",
  };
  const STATUS_COLOR: Record<string, string> = {
    draft: "#6B7280", submitted: "#D97706", approved: "#2563EB",
    rejected: "#DC2626", confirmed: "#059669", paid: "#059669",
    partial: "#D97706", cancelled: "#6B7280",
  };

  const TABS = [
    { key: "performance", label: ar ? "مقارنة الاداء" : "Performance" },
    { key: "invoices",    label: ar ? "الفواتير التفصيلية" : "Invoices Detail" },
    { key: "stock",       label: ar ? "المخزون" : "Stock" },
  ] as const;

  const totalSales     = repStats.reduce((s, r) => s + Number(r.sum.total_sales || 0), 0);
  const totalCollected = repStats.reduce((s, r) => s + Number(r.sum.total_collected || 0), 0);
  const totalOutstanding = repStats.reduce((s, r) => s + Number(r.sum.outstanding || 0), 0);
  const totalCommission  = repStats.reduce((s, r) => s + r.commission, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reps/manage`}>{ar ? "المناديب" : "Sales Reps"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "التقارير" : "Reports"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقارير المناديب" : "Sales Rep Reports"}</h1>
          <p className="page-subtitle">{ar ? "مقارنة الاداء — المبيعات والتحصيل والمخزون والعمولات" : "Performance comparison — sales, collection, stock and commissions"}</p>
        </div>
        {/* أزرار التصدير */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => exportToExcel("performance")}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#059669", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {ar ? "أداء Excel" : "Performance Excel"}
          </button>
          <button onClick={() => exportToExcel("invoices")}
            style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {ar ? "فواتير Excel" : "Invoices Excel"}
          </button>
        </div>
      </div>

      {/* فلاتر عامة — تؤثر على كل التبويبات */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select className="form-input form-select" style={{ width: 180 }} value={filterRep} onChange={e => setFilterRep(e.target.value)}>
            <option value="">{ar ? "كل المناديب" : "All Reps"}</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.full_name} ({r.rep_code})</option>)}
          </select>
          {zones.length > 0 && (
            <select className="form-input form-select" style={{ width: 150 }} value={filterZone} onChange={e => setFilterZone(e.target.value)}>
              <option value="">{ar ? "كل المناطق" : "All Zones"}</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          )}
          <input type="month" className="form-input" style={{ width: 150 }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            title={ar ? "فلتر بالشهر" : "Filter by month"} />
          {(filterRep || filterZone || filterMonth) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFilterRep(""); setFilterZone(""); setFilterMonth(""); }}>
              {ar ? "مسح" : "Clear"}
            </button>
          )}
        </div>
      </div>

      {/* ملخص عام */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي مبيعات الفريق" : "Team Total Sales",      value: fmt(totalSales) + " SAR",       color: "#2563EB" },
          { label: ar ? "إجمالي المحصّل" : "Total Collected",              value: fmt(totalCollected) + " SAR",   color: "#059669" },
          { label: ar ? "إجمالي المستحق" : "Total Outstanding",            value: fmt(totalOutstanding) + " SAR", color: totalOutstanding > 0 ? "#DC2626" : "#059669" },
          { label: ar ? "إجمالي العمولات المستحقة" : "Total Commissions",  value: fmt(totalCommission) + " SAR",  color: "#7C3AED" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* التبويبات */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            style={{ padding: "8px 18px", border: "none", borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent", background: "none", cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? "var(--primary)" : "var(--text-secondary)" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* فلاتر الفواتير */}
      {tab === "invoices" && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <select className="form-input form-select" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="">{ar ? "كل الحالات" : "All Statuses"}</option>
              {Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" className="form-input" style={{ width: 150 }} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title={ar ? "من" : "From"} />
            <input type="date" className="form-input" style={{ width: 150 }} value={dateTo} onChange={e => setDateTo(e.target.value)} title={ar ? "إلى" : "To"} />
            {(filterStatus || dateFrom || dateTo) && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setFilterStatus(""); setDateFrom(""); setDateTo(""); }}>
                {ar ? "مسح" : "Clear"}
              </button>
            )}
            <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
              {filteredInvoices.length} {ar ? "فاتورة" : "invoices"} — {fmt(filteredInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0))} SAR
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
      ) : (
        <>
          {/* تبويب: مقارنة الاداء */}
          {tab === "performance" && (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "المندوب" : "Rep"}</th>
                      <th>{ar ? "المنطقة" : "Zone"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الهدف الشهري" : "Target"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المبيعات" : "Sales"}</th>
                      <th>{ar ? "نسبة التحقق" : "Achievement"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المحصّل" : "Collected"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "المستحق" : "Outstanding"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الفواتير" : "Invoices"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "العمولة" : "Commission"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repStats.map(({ rep, sum, pct, commission }, idx) => (
                      <tr key={rep.id}>
                        <td>
                          <Link href={`/${locale}/reps/${rep.id}`} style={{ fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}>
                            {idx === 0 && <span style={{ color: "#D97706", marginInlineEnd: 6 }}>1</span>}
                            {rep.full_name}
                          </Link>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rep.rep_code}</div>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{rep.zone || "—"}</td>
                        <td style={{ textAlign: "end", fontSize: 13 }}>
                          {rep.target_monthly > 0 ? fmt(rep.target_monthly) : "—"}
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: "#2563EB" }}>{fmt(sum.total_sales || 0)}</td>
                        <td style={{ minWidth: 120 }}>
                          {pct !== null ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#DC2626", marginBottom: 3 }}>{pct}%</div>
                              <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#DC2626", borderRadius: 3 }} />
                              </div>
                            </div>
                          ) : <span style={{ fontSize: 12, color: "var(--text-muted)" }}>—</span>}
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 600, color: "#059669" }}>{fmt(sum.total_collected || 0)}</td>
                        <td style={{ textAlign: "end", fontWeight: 600, color: Number(sum.outstanding || 0) > 0 ? "#DC2626" : "#059669" }}>
                          {fmt(sum.outstanding || 0)}
                        </td>
                        <td style={{ textAlign: "end" }}>{sum.invoice_count || 0}</td>
                        <td style={{ textAlign: "end", fontWeight: 600, color: "#7C3AED" }}>
                          {commission > 0 ? fmt(commission) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "var(--secondary)", fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: "10px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      <td style={{ textAlign: "end", padding: "10px 16px", color: "#2563EB" }}>{fmt(totalSales)}</td>
                      <td />
                      <td style={{ textAlign: "end", padding: "10px 16px", color: "#059669" }}>{fmt(totalCollected)}</td>
                      <td style={{ textAlign: "end", padding: "10px 16px", color: totalOutstanding > 0 ? "#DC2626" : "#059669" }}>{fmt(totalOutstanding)}</td>
                      <td style={{ textAlign: "end", padding: "10px 16px" }}>{repStats.reduce((s, r) => s + (r.sum.invoice_count || 0), 0)}</td>
                      <td style={{ textAlign: "end", padding: "10px 16px", color: "#7C3AED" }}>{fmt(totalCommission)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* تبويب: الفواتير التفصيلية */}
          {tab === "invoices" && (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                {filteredInvoices.length === 0 ? (
                  <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد فواتير" : "No invoices"}</div></div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>{ar ? "رقم الفاتورة" : "Invoice"}</th>
                        <th>{ar ? "المندوب" : "Rep"}</th>
                        <th>{ar ? "العميل" : "Customer"}</th>
                        <th>{ar ? "الحالة" : "Status"}</th>
                        <th>{ar ? "طريقة الدفع" : "Payment"}</th>
                        <th>{ar ? "التاريخ" : "Date"}</th>
                        <th style={{ textAlign: "end" }}>{ar ? "الإجمالي" : "Total"}</th>
                        <th style={{ textAlign: "end" }}>{ar ? "المدفوع" : "Paid"}</th>
                        <th style={{ textAlign: "end" }}>{ar ? "المتبقي" : "Remaining"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv: any) => {
                        const remaining = Number(inv.total || 0) - Number(inv.paid_amount || 0);
                        const rep = repMap[inv.rep_id];
                        return (
                          <tr key={inv.id}>
                            <td style={{ fontFamily: "monospace", fontWeight: 600, color: "var(--primary)" }}>{inv.invoice_number}</td>
                            <td style={{ fontSize: 13 }}>{rep?.full_name || "—"}</td>
                            <td style={{ fontSize: 13 }}>{inv.buyer_name_ar}</td>
                            <td>
                              <span style={{ background: STATUS_COLOR[inv.status] + "20", color: STATUS_COLOR[inv.status], padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                {STATUS_AR[inv.status] || inv.status}
                              </span>
                            </td>
                            <td style={{ fontSize: 12 }}>
                              {{ cash: "نقد", credit: "آجل", cheque: "شيك", transfer: "تحويل" }[inv.invoice_payment_method as string] || "—"}
                            </td>
                            <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtD(inv.issue_date)}</td>
                            <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(inv.total)}</td>
                            <td style={{ textAlign: "end", color: "#059669" }}>{fmt(inv.paid_amount)}</td>
                            <td style={{ textAlign: "end", color: remaining > 0.01 ? "#DC2626" : "#059669", fontWeight: 600 }}>
                              {fmt(remaining)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: "var(--secondary)", fontWeight: 700 }}>
                        <td colSpan={6} style={{ padding: "10px 16px" }}>{ar ? "الإجمالي" : "Total"} ({filteredInvoices.length})</td>
                        <td style={{ textAlign: "end", padding: "10px 16px" }}>{fmt(filteredInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0))}</td>
                        <td style={{ textAlign: "end", padding: "10px 16px", color: "#059669" }}>{fmt(filteredInvoices.reduce((s: number, i: any) => s + Number(i.paid_amount || 0), 0))}</td>
                        <td style={{ textAlign: "end", padding: "10px 16px", color: "#DC2626" }}>
                          {fmt(filteredInvoices.reduce((s: number, i: any) => s + Math.max(0, Number(i.total || 0) - Number(i.paid_amount || 0)), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* تبويب: المخزون */}
          {tab === "stock" && (
            <div className="card">
              <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "المندوب" : "Rep"}</th>
                      <th>{ar ? "المنطقة" : "Zone"}</th>
                      <th>{ar ? "السيارة" : "Vehicle"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "إجمالي المخزون" : "Stock Qty"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "قيمة المخزون" : "Stock Value"}</th>
                      <th>{ar ? "التفاصيل" : "Details"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repStats.map(({ rep, sum }) => (
                      <tr key={rep.id}>
                        <td>
                          <Link href={`/${locale}/reps/${rep.id}?tab=stock`} style={{ fontWeight: 700, color: "var(--primary)", textDecoration: "none" }}>
                            {rep.full_name}
                          </Link>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{rep.rep_code}</div>
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-secondary)" }}>{rep.zone || "—"}</td>
                        <td>
                          {rep.vehicle_plate ? (
                            <div>
                              <div style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600 }}>{rep.vehicle_plate}</div>
                              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{[rep.vehicle_type, rep.vehicle_color].filter(Boolean).join(" · ")}</div>
                            </div>
                          ) : <span style={{ color: "var(--text-muted)", fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: "#D97706" }}>
                          {Number(sum.stock_qty || 0).toLocaleString("en-US")}
                        </td>
                        <td style={{ textAlign: "end", fontSize: 13, color: "var(--text-secondary)" }}>
                          {sum.stock_value ? fmt(sum.stock_value) + " SAR" : "—"}
                        </td>
                        <td>
                          <Link href={`/${locale}/reps/${rep.id}`} className="btn btn-ghost btn-sm">
                            {ar ? "عرض المخزون" : "View Stock"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
