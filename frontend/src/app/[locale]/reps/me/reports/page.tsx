"use client";
import { useEffect, useState, use } from "react";
import { getMySummary, getMyInvoices, getMyStock } from "@/lib/reps";
import { getCustomers } from "@/lib/sales";
import api from "@/lib/api";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";
import { isFinancialInvoiceStatus } from "@/lib/invoiceStatus";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

const STATUS: Record<string, { ar: string; color: string; bg: string }> = {
  draft:     { ar: "مسودة",            color: "#6B7280", bg: "#F3F4F6" },
  submitted: { ar: "بانتظار المراجعة", color: "#D97706", bg: "#FEF3C7" },
  approved:  { ar: "موافق عليها",      color: "#3E0865", bg: "#F4EFF7" },
  rejected:  { ar: "مرفوضة",           color: "#DC2626", bg: "#FEF2F2" },
  confirmed: { ar: "مؤكدة",            color: "#6F4A84", bg: "#F7F2F8" },
  paid:      { ar: "مدفوعة",           color: "#6F4A84", bg: "#F7F2F8" },
  partial:   { ar: "مدفوعة جزئيًا",    color: "#D97706", bg: "#FEF3C7" },
  overdue:   { ar: "متأخرة السداد",    color: "#DC2626", bg: "#FEF2F2" },
  cancelled: { ar: "ملغاة",            color: "#6B7280", bg: "#F3F4F6" },
};

export default function RepReportsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [summary, setSummary]   = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [stock, setStock]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab] = useState<"summary"|"invoices"|"stock"|"statement">("summary");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth]   = useState("");

  // كشف حساب العميل
  const [customers, setCustomers]       = useState<any[]>([]);
  const [stmtCustomer, setStmtCustomer] = useState("");
  const [stmtFrom, setStmtFrom]         = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0]);
  const [stmtTo, setStmtTo]             = useState(new Date().toISOString().split("T")[0]);
  const [stmtData, setStmtData]         = useState<any>(null);
  const [stmtLoading, setStmtLoading]   = useState(false);

  useEffect(() => {
    Promise.all([
      getMySummary().catch(() => ({ data: null })),
      getMyInvoices().catch(() => ({ data: [] })),
      getMyStock().catch(() => ({ data: [] })),
      getCustomers().catch(() => ({ data: [] })),
    ]).then(([s, i, st, c]) => {
      setSummary(s.data);
      // الفواتير التي تنتظر مراجعة المحاسب تبقى في شاشة فواتيري، ولا تدخل
      // تقرير الأداء أو إجمالياته أو تصديره قبل انتقالها إلى حالة مؤكدة.
      setInvoices(Array.isArray(i.data) ? i.data.filter((invoice: any) => isFinancialInvoiceStatus(invoice.status)) : []);
      setStock(Array.isArray(st.data) ? st.data : []);
      setCustomers(Array.isArray(c.data) ? c.data : []);
    }).finally(() => setLoading(false));
  }, []);

  /* جلب كشف حساب العميل */
  const loadStatement = async () => {
    if (!stmtCustomer) return;
    setStmtLoading(true); setStmtData(null);
    try {
      const res = await api.get(`/sales/customers/${stmtCustomer}/statement`, {
        params: { from_date: `${stmtFrom}T00:00:00`, to_date: `${stmtTo}T23:59:59` }
      });
      setStmtData(res.data);
    } catch { setStmtData(null); }
    finally { setStmtLoading(false); }
  };

  /* طباعة كشف الحساب كـ PDF */
  const printStatement = () => {
    if (!stmtData) return;
    const cust = customers.find(c => c.id === stmtCustomer);
    const rows = (stmtData.transactions || []).map((t: any) => `
      <tr style="border-bottom:1px solid #E5E7EB">
        <td style="padding:7px 12px;font-size:12px">${fmtDate(t.date)}</td>
        <td style="padding:7px 12px;font-size:12px">${t.description || ""}</td>
        <td style="padding:7px 12px;font-size:12px;color:#3E0865">${(t.debit || t.amount || 0) > 0 && t.type === "invoice" ? fmt(t.debit || t.amount) + " SAR" : ""}</td>
        <td style="padding:7px 12px;font-size:12px;color:#6F4A84">${(t.credit || t.amount || 0) > 0 && t.type === "payment" ? fmt(t.credit || t.amount) + " SAR" : ""}</td>
        <td style="padding:7px 12px;font-size:12px;font-weight:700;color:${(t.balance ?? t.running_balance ?? 0) > 0 ? "#DC2626" : "#6F4A84"}">${fmt(t.balance ?? t.running_balance ?? 0)} SAR</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"/>
    <title>كشف حساب</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:"Segoe UI",Tahoma,Arial,sans-serif;direction:rtl;padding:24px}
    @media print{.no-print{display:none!important}@page{margin:10mm}}
    table{width:100%;border-collapse:collapse}th{padding:10px 12px;background:#F9FAFB;font-size:12px;color:#6B7280;font-weight:600;text-align:start;border-bottom:2px solid #E5E7EB}</style></head>
    <body>
    <div class="no-print" style="text-align:center;margin-bottom:20px">
      <button onclick="window.focus()" style="padding:10px 28px;background:#3E0865;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">تقرير مستقل</button>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #3E0865">
      <div>
        <div style="font-size:20px;font-weight:800;color:#3E0865">كشف حساب العميل</div>
        <div style="font-size:14px;font-weight:700;margin-top:4px">${cust?.name_ar || ""}</div>
        <div style="font-size:12px;color:#6B7280;margin-top:2px">الفترة: ${stmtFrom} — ${stmtTo}</div>
      </div>
      <div style="text-align:start">
        <div style="font-size:12px;color:#6B7280">إجمالي المبيعات</div>
        <div style="font-size:16px;font-weight:700;color:#3E0865">${fmt(stmtData.summary?.total_invoiced ?? stmtData.total_invoiced ?? 0)} SAR</div>
        <div style="font-size:12px;color:#6B7280;margin-top:4px">إجمالي المقبوض</div>
        <div style="font-size:16px;font-weight:700;color:#6F4A84">${fmt(stmtData.summary?.total_paid ?? stmtData.total_paid ?? 0)} SAR</div>
        <div style="font-size:12px;color:#6B7280;margin-top:4px">الرصيد المستحق</div>
        <div style="font-size:18px;font-weight:800;color:#DC2626">${fmt(stmtData.summary?.closing_balance ?? stmtData.summary?.outstanding ?? stmtData.outstanding ?? 0)} SAR</div>
      </div>
    </div>
    <table>
      <thead><tr>
        <th>التاريخ</th><th>البيان</th>
        <th style="color:#3E0865">مدين (فاتورة)</th>
        <th style="color:#6F4A84">دائن (قبض)</th>
        <th>الرصيد</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#F9FAFB;font-weight:700">
        <td colspan="2" style="padding:10px 12px;font-size:13px">الإجمالي</td>
        <td style="padding:10px 12px;color:#3E0865;font-size:13px">${fmt(stmtData.total_invoiced)} SAR</td>
        <td style="padding:10px 12px;color:#6F4A84;font-size:13px">${fmt(stmtData.total_paid)} SAR</td>
        <td style="padding:10px 12px;color:#DC2626;font-size:14px;font-weight:800">${fmt(stmtData.outstanding)} SAR</td>
      </tr></tfoot>
    </table>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  /* تصدير CSV */
  const exportCSV = () => {
    const rows = [
      ["رقم الفاتورة", "العميل", "الحالة", "التاريخ", "الإجمالي", "المدفوع", "المتبقي"],
      ...filteredInvoices.map((inv: any) => [
        inv.invoice_number,
        inv.buyer_name_ar,
        STATUS[inv.status]?.ar || "حالة غير معروفة",
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
    { key: "summary",   label: ar ? "الملخص"              : "Summary"          },
    { key: "invoices",  label: ar ? "الفواتير"            : "Invoices"         },
    { key: "stock",     label: ar ? "المخزون"             : "Stock"            },
    { key: "statement", label: ar ? "كشف حساب العميل"    : "Customer Statement"},
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
            style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #BBF7D0", background: "#F7F2F8",
              color: "#6F4A84", fontSize: 12, fontWeight: 700, cursor: "pointer",
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
              color: tab === t.key ? "#3E0865" : "var(--text-secondary)",
              borderBottom: tab === t.key ? "2px solid #3E0865" : "2px solid transparent" }}>
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
                  { label: ar ? "إجمالي مبيعاتي" : "Total Sales",     value: fmt(totalSales) + " SAR",       color: "#3E0865" },
                  { label: ar ? "المقبوض" : "Collected",               value: fmt(totalCollected) + " SAR",   color: "#6F4A84" },
                  { label: ar ? "المستحق" : "Outstanding",             value: fmt(totalOutstanding) + " SAR", color: totalOutstanding > 0 ? "#DC2626" : "#6F4A84" },
                  { label: ar ? "عدد الفواتير" : "Invoices",           value: String(summary?.invoice_count || 0), color: "#356B63" },
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
                    <span style={{ fontSize: 14, fontWeight: 800, color: pct >= 100 ? "#6F4A84" : pct >= 70 ? "#D97706" : "#3E0865" }}>
                      {pct}%
                    </span>
                  </div>
                  <div style={{ height: 10, background: "var(--border)", borderRadius: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 5,
                      background: pct >= 100 ? "#6F4A84" : pct >= 70 ? "#D97706" : "#3E0865",
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
                    const st = STATUS[status] || { ar: "حالة غير معروفة", color: "#6B7280", bg: "#F3F4F6" };
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
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13, color: "#3E0865" }}>
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
                    <span style={{ fontWeight: 800, color: "#3E0865" }}>
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
                          color: Number(s.quantity) <= 0 ? "#DC2626" : Number(s.quantity) <= 3 ? "#D97706" : "#6F4A84" }}>
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
          {/* ── تبويب كشف حساب العميل ── */}
          {tab === "statement" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* فلاتر */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <select style={{ flex: 2, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }}
                  value={stmtCustomer} onChange={e => { setStmtCustomer(e.target.value); setStmtData(null); }}>
                  <option value="">{ar ? "— اختر العميل —" : "— Select Customer —"}</option>
                  {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                </select>
                <input type="date" style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }}
                  value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} />
                <input type="date" style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 13 }}
                  value={stmtTo} onChange={e => setStmtTo(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={loadStatement} disabled={!stmtCustomer || stmtLoading}
                  style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: "#3E0865", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: !stmtCustomer ? 0.6 : 1 }}>
                  {stmtLoading ? (ar ? "جاري التحميل..." : "Loading...") : (ar ? "عرض الكشف" : "Load Statement")}
                </button>
                {stmtData && <StructuredReportPrintButton locale={locale} title={ar ? "كشف حساب العميل" : "Customer Statement"} subtitle={customers.find(c => c.id === stmtCustomer)?.name_ar || ""} period={`${stmtFrom} — ${stmtTo}`} reportCode={`CST-${stmtTo.replaceAll("-", "")}`} metrics={[{ label: ar ? "إجمالي الفواتير" : "Invoiced", value: `${fmt(stmtData.summary?.total_invoiced ?? stmtData.total_invoiced ?? 0)} SAR`, tone: "blue" }, { label: ar ? "إجمالي المقبوض" : "Collected", value: `${fmt(stmtData.summary?.total_paid ?? stmtData.total_paid ?? 0)} SAR`, tone: "green" }, { label: ar ? "الرصيد المستحق" : "Outstanding", value: `${fmt(stmtData.summary?.closing_balance ?? stmtData.summary?.outstanding ?? stmtData.outstanding ?? 0)} SAR`, tone: "amber" }]} tables={[{ headers: [ar ? "التاريخ" : "Date", ar ? "البيان" : "Description", ar ? "مدين" : "Debit", ar ? "دائن" : "Credit", ar ? "الرصيد" : "Balance"], rows: (stmtData.transactions || []).map((t: any) => [fmtDate(t.date), String(t.description || "—"), Number(t.debit || (t.type === "invoice" ? t.amount : 0)) ? fmt(t.debit || t.amount) : "—", Number(t.credit || (t.type === "payment" ? t.amount : 0)) ? fmt(t.credit || t.amount) : "—", fmt(t.balance ?? t.running_balance ?? 0)]) }]} />}
              </div>

              {stmtData && (
                <>
                  {/* ملخص */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { label: ar ? "إجمالي الفواتير" : "Total Invoiced", value: fmt(stmtData.summary?.total_invoiced ?? stmtData.total_invoiced ?? 0) + " SAR", color: "#3E0865" },
                      { label: ar ? "إجمالي المقبوض" : "Total Paid",     value: fmt(stmtData.summary?.total_paid ?? stmtData.total_paid ?? 0) + " SAR",     color: "#6F4A84" },
                      { label: ar ? "الرصيد المستحق" : "Outstanding",    value: fmt(stmtData.summary?.closing_balance ?? stmtData.summary?.outstanding ?? stmtData.outstanding ?? 0) + " SAR",    color: "#DC2626" },
                    ].map(s => (
                      <div key={s.label} style={{ background: "var(--surface)", borderRadius: 12, padding: "12px", border: "1px solid var(--border)" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: s.color }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* الحركات */}
                  {(stmtData.transactions || []).length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {stmtData.transactions.map((t: any, i: number) => (
                        <div key={i} style={{ background: "var(--surface)", borderRadius: 12, padding: "12px 14px",
                          border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.description_ar || t.description || (t.type === "invoice" ? (ar ? "فاتورة" : "Invoice") : (ar ? "قبض" : "Payment"))}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{fmtDate(t.date)}</div>
                            {t.reference && (
                              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>{t.reference}</div>
                            )}
                          </div>
                          <div style={{ textAlign: "end", flexShrink: 0, marginInlineStart: 12 }}>
                            <div style={{ fontWeight: 700, fontSize: 13,
                              color: t.type === "invoice" ? "#3E0865" : "#6F4A84" }}>
                              {t.type === "invoice"
                                ? `+ ${fmt(t.debit || t.amount || 0)} SAR`
                                : `- ${fmt(t.credit || t.amount || 0)} SAR`}
                            </div>
                            <div style={{ fontSize: 11,
                              color: Number(t.balance ?? t.running_balance ?? 0) > 0 ? "#DC2626" : "#6F4A84",
                              fontWeight: 600 }}>
                              {ar ? "رصيد:" : "Bal:"} {fmt(t.balance ?? t.running_balance ?? 0)} SAR
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
                      {ar ? "لا توجد حركات في هذه الفترة" : "No transactions in this period"}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}
