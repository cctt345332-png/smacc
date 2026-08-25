"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getSerialProfitReport } from "@/lib/inventory";
import { getItems } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const CONDITION: Record<string, string> = { new: "جديد", used: "مستخدم", refurbished: "مجدد" };

export default function SerialProfitPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const now = new Date();
  const [products, setProducts] = useState<any[]>([]);
  const [productId, setProductId] = useState("");
  const [fromDate, setFromDate] = useState(`${now.getFullYear()}-01-01`);
  const [toDate, setToDate] = useState(now.toISOString().split("T")[0]);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getItems({ tracking_type: "serial" }).then(({ data }) => setProducts(data)).catch(() => {});
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params: any = { from_date: fromDate + "T00:00:00", to_date: toDate + "T23:59:59" };
      if (productId) params.product_id = productId;
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
        {data && <StructuredReportPrintButton locale={locale} title={ar ? "تقرير ربح السيريالات" : "Serial Profit Report"} subtitle={ar ? "ربحية الوحدات المباعة ذات التتبع التسلسلي" : "Profitability of serial-tracked sold units"} period={`${fromDate} — ${toDate}`} reportCode={`SER-PROFIT-${toDate.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "الوحدات المباعة" : "Units sold", value: String(data.summary.count || 0), tone: "blue" }, { label: ar ? "إجمالي التكلفة" : "Total cost", value: `${fmt(data.summary.total_cost)} SAR`, tone: "red" }, { label: ar ? "إجمالي الإيرادات" : "Total revenue", value: `${fmt(data.summary.total_revenue)} SAR`, tone: "green" }, { label: ar ? "صافي الربح" : "Net profit", value: `${fmt(data.summary.total_profit)} SAR`, tone: data.summary.total_profit >= 0 ? "green" : "red" }, { label: ar ? "متوسط الهامش" : "Average margin", value: `${fmt(data.summary.avg_profit_pct)}%`, tone: "amber" }]} tables={[{ title: ar ? "تفاصيل ربح السيريالات" : "Serial profit details", headers: [ar ? "رقم السيريال" : "Serial #", ar ? "المنتج" : "Product", ar ? "الحالة" : "Condition", ar ? "تاريخ البيع" : "Sold date", ar ? "التكلفة" : "Cost", ar ? "سعر البيع" : "Sale price", ar ? "الربح" : "Profit", ar ? "هامش الربح" : "Margin"], rows: data.rows.map((row: any) => [row.serial_number || "—", row.product_name || "—", ar ? CONDITION[row.condition] || row.condition : row.condition, row.sold_at ? new Date(row.sold_at).toLocaleDateString("en-GB") : "—", `${fmt(row.cost_price)} SAR`, `${fmt(row.sale_price)} SAR`, `${fmt(row.profit)} SAR`, `${fmt(row.profit_pct)}%`]), totals: [ar ? "الإجمالي" : "TOTAL", "", "", "", `${fmt(data.summary.total_cost)} SAR`, `${fmt(data.summary.total_revenue)} SAR`, `${fmt(data.summary.total_profit)} SAR`, `${fmt(data.summary.avg_profit_pct)}%`] }]} />}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div className="form-group" style={{ margin: 0, minWidth: 240 }}>
            <label className="form-label">{ar ? "المنتج (اختياري)" : "Product (optional)"}</label>
            <select className="form-input form-select" value={productId} onChange={e => setProductId(e.target.value)}>
              <option value="">{ar ? "— كل المنتجات —" : "— All Products —"}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
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

      {data && (
        <>
          {/* Summary */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "عدد الوحدات المباعة" : "Units Sold", value: data.summary.count, color: "#485668" },
              { label: ar ? "إجمالي التكلفة" : "Total Cost", value: `${fmt(data.summary.total_cost)} SAR`, color: "#DC2626" },
              { label: ar ? "إجمالي الإيرادات" : "Total Revenue", value: `${fmt(data.summary.total_revenue)} SAR`, color: "#059669" },
              { label: ar ? "صافي الربح" : "Net Profit", value: `${fmt(data.summary.total_profit)} SAR`, color: data.summary.total_profit >= 0 ? "#059669" : "#DC2626" },
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
                        <td><span className="badge badge-info">{ar ? CONDITION[row.condition] || row.condition : row.condition}</span></td>
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.sold_at ? new Date(row.sold_at).toLocaleDateString("en-SA") : "—"}</td>
                        <td style={{ textAlign: "end" }}>{fmt(row.cost_price)}</td>
                        <td style={{ textAlign: "end" }}>{fmt(row.sale_price)}</td>
                        <td style={{ textAlign: "end", fontWeight: 700, color: row.profit >= 0 ? "#059669" : "#DC2626" }}>{fmt(row.profit)}</td>
                        <td style={{ textAlign: "end", color: row.profit_pct >= 20 ? "#059669" : row.profit_pct >= 10 ? "#D97706" : "#DC2626" }}>
                          {fmt(row.profit_pct)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={4} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#DC2626" }}>{fmt(data.summary.total_cost)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669" }}>{fmt(data.summary.total_revenue)}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#059669", fontSize: 15 }}>{fmt(data.summary.total_profit)}</td>
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
