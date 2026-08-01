"use client";
import { useEffect, useState } from "react";
import { getMySummary, getMyInvoices, getMyStock } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
  draft:     { ar: "مسودة",            color: "#6B7280", bg: "#F3F4F6" },
  submitted: { ar: "بانتظار المراجعة", color: "#D97706", bg: "#FEF3C7" },
  approved:  { ar: "موافق عليها",      color: "#2563EB", bg: "#EFF6FF" },
  rejected:  { ar: "مرفوضة",           color: "#DC2626", bg: "#FEF2F2" },
  confirmed: { ar: "مؤكدة",            color: "#059669", bg: "#F0FDF4" },
  paid:      { ar: "مدفوعة",           color: "#059669", bg: "#F0FDF4" },
  partial:   { ar: "جزئي",             color: "#D97706", bg: "#FEF3C7" },
  cancelled: { ar: "ملغاة",            color: "#6B7280", bg: "#F3F4F6" },
};

export default function RepReportsPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [summary, setSummary]   = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stock, setStock]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<"summary" | "invoices" | "stock">("summary");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth]   = useState("");

  useEffect(() => {
    Promise.all([
      getMySummary().catch(() => ({ data: null })),
      getMyInvoices().catch(() => ({ data: [] })),
      getMyStock().catch(() => ({ data: [] })),
    ]).then(([s, i, st]) => {
      setSummary(s.data);
      setInvoices(Array.isArray(i.data) ? i.data : []);
      setStock(Array.isArray(st.data) ? st.data : []);
    }).finally(() => setLoading(false));
  }, []);

  /* تصدير CSV */
  const exportCSV = () => {
    const rows = [
      ["رقم الفاتورة", "العميل", "الحالة", "التاريخ", "الإجمالي", "المدفوع", "المتبقي"],
      ...filteredInvoices.map((inv: any) => [
        inv.invoice_number,
        inv.buyer_name_ar,
        STATUS[inv.status]?.ar || inv.status,
        inv.issue_date ? new Date(inv.issue_date).toLocaleDateString("en-US") : "",
        Number(inv.total || 0).toFixed(2),
        Number(inv.paid_amount || 0).toFixed(2),
        Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0)).toFixed(2),
      ]),
    ];
    const bom = "\uFEFF";
    const csv = bom + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `my-invoices-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const filteredInvoices = invoices.filter((inv: any) => {
    const matchS = !filterStatus || inv.status === filterStatus;
    const matchM = !filterMonth || (inv.issue_date || "").startsWith(filterMonth);
    return matchS && matchM;
  });

  const totalSales       = Number(summary?.total_sales || 0);
  const totalCollected   = Number(summary?.total_collected || 0);
  const totalOutstanding = Number(summary?.outstanding || 0);
  const targetMonthly    = Number(summary?.target_monthly || 0);
  const pct = targetMonthly > 0 ? Math.min(100, Math.round((totalSales / targetMonthly) * 100)) : null;

  const TABS = [
    { key: "summary",  label: ar ? "الملخص"   : "Summary"  },
    { key: "invoices", label: ar ? "الفواتير" : "Invoices" },
    { key: "stock",    label: ar ? "المخزون"  : "Stock"    },
  ] as const;

  return (
    <>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{ar ? "تقاريري" : "My Reports"}</h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {ar ? "تقارير أدائك الشخصي" : "Your personal performance reports"}
          </p>
        </div>
        {tab === "invoices" && (
          <button onClick={exportCSV}
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F0FDF4",
              color: "#059669", fontSize: 12, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Excel
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "8px 16px", border: "none", background: "none", cursor: "pointer",
              fontSize: 13, fontWeight: tab === t.key ? 700 : 400,
              color: tab === t.key ? "#2563EB" : "var(--text-secondary)",
              borderBottom: tab === t.key ? "2px solid #2563EB" : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
          {ar ? "جاري التحميل..." : "Loading..."}
        </div>
      ) : (
        <>
          {/* ── تبويب الملخص ── */}
          {tab === "summary" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* بطاقات */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: ar ? "إجمالي مبيعاتي" : "Total Sales",     value: fmt(totalSales) + " SAR",       color: "#2563EB" },
                  { label: ar ? "المقبوض" : "Collected",               value: fmt(totalCollected) + " SAR",   color: "#059669" },
                  { label: ar ? "المستحق" : "Outstanding",             value: fmt(totalOutstanding) + " SAR", color: totalOutstanding > 0 ? "#DC2626" : "#059669" },
                  { label: ar ? "عدد الفواتير" : "Invoices",           value: String(summary?.invoice_count || 0), color: "#7C3AED" },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--surface)", borderRadius: 14,
                    padding: "14px 16px", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {/* شريط الهدف */}
              {pct !== null && targetMonthly > 0 && (
                <div style={{ background: "var(--surface)", borderRadius: 14, padding: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "الهدف الشهري" : "Monthly Target"}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#2563EB" }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ height: 10, background: "var(--border)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 5,
                      background: pct >= 100 ? "#059669" : pct >= 70 ? "#D97706" : "#2563EB",
                      transition: "width 0.6s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
                    <span>{fmt(totalSales)} SAR</span>
                    <span>{fmt(targetMonthly)} SAR</span>
                  </div>
                </div>
              )}

              {/* توزيع الفواتير حسب الحالة */}
              {invoices.length > 0 && (
                <div style={{ background: "var(--surface)", borderRadius: 14, padding: "16px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                    {ar ? "توزيع الفواتير" : "Invoices by Status"}
                  </div>
                  {Object.entries(
                    invoices.reduce((acc: any, inv: any) => {
                      acc[inv.status] = (acc[inv.status] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([status, count]: any) => {
                    const st = STATUS[status] || { ar: status, color: "#6B7280", bg: "#F3F4F6" };
                    return (
                      <div key={status} style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: "2px 10px",
                          borderRadius: 20, background: st.bg, color: st.color }}>
                          {ar ? st.ar : status}
                        </span>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── تبويب الفواتير ── */}
          {tab === "invoices" && (
            <div>
              {/* فلاتر */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                <select style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "var(--surface)", fontSize: 13, flex: 1 }}
                  value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="">{ar ? "كل الحالات" : "All Statuses"}</option>
                  {Object.entries(STATUS).map(([k, v]) => (
                    <option key={k} value={k}>{ar ? v.ar : k}</option>
                  ))}
                </select>
                <input type="month"
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "var(--surface)", fontSize: 13, flex: 1 }}
                  value={filterMonth} onChange={e => setFilterMonth(e.target.value)} />
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
                {filteredInvoices.length} {ar ? "فاتورة" : "invoices"} —{" "}
                {fmt(filteredInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0))} SAR
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filteredInvoices.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    {ar ? "لا توجد فواتير" : "No invoices"}
                  </div>
                ) : filteredInvoices.map((inv: any) => {
                  const st = STATUS[inv.status] || STATUS.draft;
                  const rem = Math.max(0, Number(inv.total || 0) - Number(inv.paid_amount || 0));
                  return (
                    <div key={inv.id} style={{ background: "var(--surface)", borderRadius: 14,
                      padding: "14px 16px", border: "1px solid var(--border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#2563EB" }}>
                          {inv.invoice_number}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{fmt(inv.total)} SAR</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px",
                            borderRadius: 20, background: st.bg, color: st.color }}>
                            {ar ? st.ar : inv.status}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {inv.buyer_name_ar}
                          </span>
                        </div>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{fmtDate(inv.issue_date)}</span>
                      </div>
                      {rem > 0.01 && (
                        <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 600, marginTop: 4 }}>
                          {ar ? "متبقي:" : "Due:"} {fmt(rem)} SAR
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── تبويب المخزون ── */}
          {tab === "stock" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stock.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                  {ar ? "لا يوجد مخزون" : "No stock"}
                </div>
              ) : (
                <>
                  <div style={{ background: "var(--surface)", borderRadius: 14, padding: "12px 16px",
                    border: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{ar ? "إجمالي القيمة" : "Total Value"}</span>
                    <span style={{ fontWeight: 800, color: "#2563EB" }}>
                      {fmt(stock.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.sale_price || 0), 0))} SAR
                    </span>
                  </div>
                  {stock.map((s: any) => (
                    <div key={s.item_id || s.id} style={{ background: "var(--surface)", borderRadius: 14,
                      padding: "12px 16px", border: "1px solid var(--border)",
                      display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{s.item_name || s.name_ar}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {fmt(s.sale_price)} SAR / {ar ? "وحدة" : "unit"}
                        </div>
                      </div>
                      <div style={{ textAlign: "end" }}>
                        <div style={{ fontWeight: 800, fontSize: 16,
                          color: Number(s.quantity) <= 0 ? "#DC2626" : Number(s.quantity) <= 3 ? "#D97706" : "#059669" }}>
                          {fmt(s.quantity)}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{ar ? "قطعة" : "units"}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
