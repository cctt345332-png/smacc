"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getSerialProfitReport, getItems, reconcileSerialInvoiceStockPreview, applySerialInvoiceStockReconciliation } from "@/lib/inventory";
import { getInvoices } from "@/lib/sales";
import { getReps } from "@/lib/reps";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const CONDITION: Record<string, string> = { new: "جديد", used: "مستخدم", refurbished: "مجدد" };
const RECONCILIATION_ISSUES: Record<string, string> = {
    invalid_serial_ids_json: "بيانات السيريالات غير صالحة",
    serial_not_found: "السيريال غير موجود",
    sold_without_sale_movement: "السيريال مباع بلا حركة بيع",
    sold_without_sale_price: "السيريال مباع بلا سعر بيع",
    confirmed_invoice_serial_still_in_stock: "الفاتورة مؤكدة والسيريال ما زال في المخزون",
    sale_movement_but_serial_in_stock: "توجد حركة بيع لكن حالة السيريال في المخزون",
    serial_link_conflict: "تعارض في ربط السيريال بالفاتورة",
};

export default function SerialProfitPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const now = new Date();
  const [products, setProducts] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [filterType, setFilterType] = useState<"product" | "invoice" | "rep">("product");
  const [filterValue, setFilterValue] = useState("");
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      getItems({ tracking_type: "serial" }).catch(() => ({ data: [] })),
      getInvoices().catch(() => ({ data: [] })),
      getReps().catch(() => ({ data: [] })),
    ]).then(([itemsRes, invoicesRes, repsRes]) => {
      setProducts(Array.isArray(itemsRes.data) ? itemsRes.data : []);
      setInvoices(Array.isArray(invoicesRes.data) ? invoicesRes.data : []);
      setReps(Array.isArray(repsRes.data) ? repsRes.data : []);
    });
  }, []);

  const runSerialReconciliation = async (apply: boolean) => {
    if (apply && !window.confirm(ar ? "سيتم تحديث حالة السيريالات وحركات المخزون للفواتير INV-00003 وINV-00005 فقط. هل تريد المتابعة؟" : "This will update serial status and stock movements for INV-00003 and INV-00005 only. Continue?")) return;
    setReconcileLoading(true);
    try {
      const response = apply
        ? await applySerialInvoiceStockReconciliation(["INV-00003", "INV-00005"])
        : await reconcileSerialInvoiceStockPreview(["INV-00003", "INV-00005"]);
      setReconcileResult(response.data);
    } catch (e: any) {
      alert(e?.response?.data?.detail || (ar ? "تعذر تنفيذ المصالحة" : "Reconciliation failed"));
    } finally {
      setReconcileLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { from_date: fromDate + "T00:00:00", to_date: toDate + "T23:59:59" };
      if (filterType === "product" && filterValue) params.product_id = filterValue;
      if (filterType === "invoice" && filterValue) params.invoice_id = filterValue;
      if (filterType === "rep" && filterValue) params.rep_id = filterValue;
      const { data: res } = await getSerialProfitReport(params);
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
            <Link href={`/${locale}/reports/inventory`}>{ar ? "تقارير المخزون" : "Inventory Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "ربح السيريالات" : "Serial Profit"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير ربح السيريالات" : "Serial Profit Report"}</h1>
          <p className="page-subtitle">{ar ? "الربح الصافي لكل وحدة مباعة بالسيريال" : "Net profit per sold serial unit"}</p>
        </div>
        {data && <StructuredReportPrintButton locale={locale} title={ar ? "تقرير ربح السيريالات" : "Serial Profit Report"} subtitle={ar ? "ربحية الوحدات المباعة ذات التتبع التسلسلي" : "Profitability of serial-tracked sold units"} period={`${fromDate} — ${toDate}`} reportCode={`SER-PROFIT-${toDate.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "الوحدات المباعة" : "Units sold", value: String(data.summary.count || 0), tone: "blue" }, { label: ar ? "إجمالي التكلفة" : "Total cost", value: `${fmt(data.summary.total_cost)} SAR`, tone: "red" }, { label: ar ? "إجمالي الإيرادات" : "Total revenue", value: `${fmt(data.summary.total_revenue)} SAR`, tone: "green" }, { label: ar ? "صافي الربح" : "Net profit", value: `${fmt(data.summary.total_profit)} SAR`, tone: data.summary.total_profit >= 0 ? "green" : "red" }, { label: ar ? "متوسط الهامش" : "Average margin", value: `${fmt(data.summary.avg_profit_pct)}%`, tone: "amber" }]} tables={[{ title: ar ? "تفاصيل ربح السيريالات" : "Serial profit details", headers: [ar ? "رقم السيريال" : "Serial #", ar ? "المنتج" : "Product", ar ? "الفاتورة" : "Invoice", ar ? "المندوب" : "Sales rep", ar ? "الحالة" : "Condition", ar ? "تاريخ البيع" : "Sold date", ar ? "التكلفة" : "Cost", ar ? "سعر البيع" : "Sale price", ar ? "الربح" : "Profit", ar ? "هامش الربح" : "Margin"], rows: data.rows.map((row: any) => [row.serial_number || "—", row.product_name || "—", row.invoice_number || "—", row.rep_name || row.rep_code || "—", ar ? CONDITION[row.condition] || row.condition : row.condition, row.sold_at ? new Date(row.sold_at).toLocaleDateString("en-GB") : "—", `${fmt(row.cost_price)} SAR`, `${fmt(row.sale_price)} SAR`, `${fmt(row.profit)} SAR`, `${fmt(row.profit_pct)}%`]), totals: [ar ? "الإجمالي" : "TOTAL", "", "", "", "", "", `${fmt(data.summary.total_cost)} SAR`, `${fmt(data.summary.total_revenue)} SAR`, `${fmt(data.summary.total_profit)} SAR`, `${fmt(data.summary.avg_profit_pct)}%`] }]} />}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 170 }}>
            <label className="form-label">{ar ? "نوع الفلترة" : "Filter by"}</label>
            <select className="form-input form-select" value={filterType} onChange={e => { setFilterType(e.target.value as any); setFilterValue(""); }}>
              <option value="product">{ar ? "المنتج" : "Product"}</option>
              <option value="invoice">{ar ? "الفاتورة" : "Invoice"}</option>
              <option value="rep">{ar ? "المندوب" : "Sales rep"}</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: 270 }}>
            <label className="form-label">{ar ? "القيمة (اختياري)" : "Value (optional)"}</label>
            <select className="form-input form-select" value={filterValue} onChange={e => setFilterValue(e.target.value)}>
              <option value="">{filterType === "product" ? (ar ? "— كل المنتجات —" : "— All products —") : filterType === "invoice" ? (ar ? "— كل الفواتير —" : "— All invoices —") : (ar ? "— كل المناديب —" : "— All reps —")}</option>
              {filterType === "product" && products.map(p => <option key={p.id} value={p.id}>{p.name_ar || p.name_en}</option>)}
              {filterType === "invoice" && invoices.map(inv => <option key={inv.id} value={inv.id}>{inv.invoice_number} — {inv.buyer_name_ar || inv.customer_name_ar || inv.customer_id}</option>)}
              {filterType === "rep" && reps.map(rep => <option key={rep.id} value={rep.id}>{rep.full_name || rep.name_ar || rep.rep_code}</option>)}
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
            {loading ? (ar ? "جاري..." : "Loading...") : (ar ? "عرض التقرير" : "Show Report")}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20, border: "1px solid #E9D5FF", background: "#FCF9FF" }}>
        <div className="card-header">
          <span className="card-title">{ar ? "مصالحة فواتير السيريالات" : "Serial invoice reconciliation"}</span>
        </div>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 280, color: "var(--text-secondary)", fontSize: 13 }}>
            {ar ? "معاينة أو إصلاح ربط السيريالات بالفواتير INV-00003 وINV-00005. المعاينة لا تعدل البيانات." : "Preview or repair serial links for INV-00003 and INV-00005. Preview does not change data."}
          </span>
          <button className="btn btn-secondary" onClick={() => runSerialReconciliation(false)} disabled={reconcileLoading}>
            {reconcileLoading ? (ar ? "جاري..." : "Running...") : (ar ? "معاينة المصالحة" : "Preview reconciliation")}
          </button>
          <button className="btn btn-primary" onClick={() => runSerialReconciliation(true)} disabled={reconcileLoading}>
            {ar ? "تطبيق الإصلاح" : "Apply repair"}
          </button>
        </div>
        {reconcileResult && (
          <div className="card-body" style={{ borderTop: "1px solid #E9D5FF", fontSize: 13 }}>
            <strong>{ar ? "نتيجة المصالحة" : "Reconciliation result"}</strong>
            <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
              <div>{ar ? "الفواتير المفحوصة" : "Invoices checked"}: <b>{reconcileResult.invoices_checked ?? "—"}</b></div>
              <div>{ar ? "السيريالات المفحوصة" : "Serials checked"}: <b>{reconcileResult.serials_checked ?? "—"}</b></div>
              <div>{ar ? "قابلة للإصلاح" : "Repairable"}: <b>{reconcileResult.repairable ?? reconcileResult.repaired ?? "—"}</b></div>
              <div>{ar ? "تم إصلاحها" : "Repaired"}: <b>{reconcileResult.repaired ?? "—"}</b></div>
              <div>{ar ? "تعارضات" : "Conflicts"}: <b>{reconcileResult.conflicts ?? "—"}</b></div>
            </div>
            {Array.isArray(reconcileResult.items) && reconcileResult.items.length > 0 && (
              <div style={{ marginTop: 16, overflowX: "auto" }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>{ar ? "تفاصيل الفحص" : "Check details"}</div>
                <table style={{ width: "100%", minWidth: 760 }}>
                  <thead>
                    <tr>
                      <th>{ar ? "الفاتورة" : "Invoice"}</th>
                      <th>{ar ? "السيريال" : "Serial"}</th>
                      <th>{ar ? "الحالة" : "Issue"}</th>
                      <th>{ar ? "الحالة الحالية" : "Current status"}</th>
                      <th>{ar ? "الفاتورة المرتبطة" : "Linked invoice"}</th>
                      <th>{ar ? "عدد الحركات" : "Movements"}</th>
                      <th>{ar ? "آخر حركة" : "Latest movement"}</th>
                      <th>{ar ? "مرجع آخر حركة" : "Latest reference"}</th>
                      <th>{ar ? "الإجراء" : "Action"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconcileResult.items.map((item: any, index: number) => (
                      <tr key={`${item.invoice_id || item.invoice_number}-${item.serial_id || index}`}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{item.invoice_number || "—"}</td>
                        <td><code style={{ fontSize: 12 }}>{item.serial_number || item.serial_id || "—"}</code></td>
                        <td>{ar ? RECONCILIATION_ISSUES[item.issue] || item.issue || "—" : item.issue || "—"}</td>
                        <td>{item.serial_status || "—"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{item.sale_invoice_id || "—"}</td>
                        <td>{item.all_movement_count ?? item.sale_movement_count ?? "—"}</td>
                        <td>{item.latest_movement_type || "—"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 11 }}>{item.latest_reference_id || "—"}</td>
                        <td>{ar ? (item.action === "manual_review" ? "مراجعة يدوية" : item.action || "—") : item.action || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {data && (
        <>
          {/* Summary */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "عدد الوحدات المباعة" : "Units Sold", value: data.summary.count, color: "#5A187E" },
              { label: ar ? "إجمالي التكلفة" : "Total Cost", value: `${fmt(data.summary.total_cost)} SAR`, color: "#DC2626" },
              { label: ar ? "إجمالي الإيرادات" : "Total Revenue", value: `${fmt(data.summary.total_revenue)} SAR`, color: "#6F4A84" },
              { label: ar ? "صافي الربح" : "Net Profit", value: `${fmt(data.summary.total_profit)} SAR`, color: data.summary.total_profit >= 0 ? "#6F4A84" : "#DC2626" },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? `تفاصيل ربح السيريالات — ${fromDate} إلى ${toDate}` : `Serial Profit Details — ${fromDate} to ${toDate}`}</span>
            </div>
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {data.rows.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد مبيعات في هذه الفترة" : "No sales in this period"}</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "رقم السيريال" : "Serial #"}</th>
                      <th>{ar ? "المنتج" : "Product"}</th>
                      <th>{ar ? "الفاتورة" : "Invoice"}</th>
                      <th>{ar ? "المندوب" : "Sales Rep"}</th>
                      <th>{ar ? "الحالة" : "Condition"}</th>
                      <th>{ar ? "تاريخ البيع" : "Sold Date"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "التكلفة" : "Cost"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "سعر البيع" : "Sale Price"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الربح" : "Profit"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "هامش الربح%" : "Margin%"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row: any) => (
                      <tr key={row.serial_id}>
                        <td><code style={{ background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 700 }}>{row.serial_number}</code></td>
                        <td style={{ fontWeight: 500 }}>{row.product_name}</td>
                        <td style={{ fontSize: 12, fontFamily: "monospace" }}>{row.invoice_number || "—"}</td>
                        <td style={{ fontSize: 12 }}>{row.rep_name || row.rep_code || "—"}</td>
                        <td><span className="badge badge-info">{ar ? CONDITION[row.condition] || row.condition : row.condition}</span></td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.sold_at ? new Date(row.sold_at).toLocaleDateString("en-SA") : "—"}</td>
                        <td style={{ textAlign: "end" }}>{fmt(row.cost_price)}</td>
                        <td style={{ textAlign: "end" }}>{fmt(row.sale_price)}</td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: row.profit >= 0 ? "#6F4A84" : "#DC2626" }}>{fmt(row.profit)}</td>
                        <td style={{ textAlign: "end", color: row.profit_pct >= 20 ? "#6F4A84" : row.profit_pct >= 10 ? "#D97706" : "#DC2626" }}>
                          {fmt(row.profit_pct)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={6} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#DC2626" }}>{fmt(data.summary.total_cost)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#6F4A84" }}>{fmt(data.summary.total_revenue)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#6F4A84", fontSize: 15 }}>{fmt(data.summary.total_profit)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px" }}>{fmt(data.summary.avg_profit_pct)}%</td>
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
