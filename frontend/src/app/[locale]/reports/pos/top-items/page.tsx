"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function POSTopItemsPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const sar = ar ? "ر.س" : "SAR";
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get("/pos/reports/top-items", { params: { from_date: dateFrom, to_date: dateTo } });
      setData(r.data?.items || []);
    } catch { setData([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const maxQty = data.length ? Math.max(...data.map(d => d.total_qty)) : 1;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <Link href={`/${locale}/reports/pos`}>POS</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "أفضل الأصناف" : "Top Items"}</span>
          </div>
          <h1 className="page-title">{ar ? "أفضل الأصناف مبيعاً" : "Top Selling Items"}</h1>
        </div>
        <StructuredReportPrintButton locale={locale} title={ar ? "تقرير أفضل الأصناف مبيعًا" : "Top Selling Items Report"} subtitle={ar ? "ترتيب الأصناف بحسب الإيراد والكمية" : "Item ranking by revenue and quantity"} period={`${dateFrom} — ${dateTo}`} reportCode={`POS-TOP-${dateTo.replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "عدد الأصناف" : "Items", value: String(data.length), tone: "blue" }, { label: ar ? "إجمالي المبيعات" : "Total sales", value: `${fmt(data.reduce((s, item) => s + Number(item.total_revenue || 0), 0))} ${sar}`, tone: "green" }, { label: ar ? "إجمالي الكمية" : "Total quantity", value: fmt(data.reduce((s, item) => s + Number(item.total_qty || 0), 0)), tone: "blue" }]} tables={[{ title: ar ? "ترتيب الأصناف" : "Item ranking", headers: ["#", ar ? "الصنف" : "Item", ar ? "الكمية المباعة" : "Qty sold", ar ? "إجمالي المبيعات" : "Total sales", ar ? "متوسط السعر" : "Avg price", ar ? "الحصة" : "Share"], rows: data.map((item, i) => [String(i + 1), item.product_name_ar || "—", fmt(item.total_qty), `${fmt(item.total_revenue)} ${sar}`, `${fmt(item.avg_price)} ${sar}`, `${Number(item.share_pct || 0).toFixed(1)}%`]) }]} />
      </div>

      <div className="card" style={{ padding: "14px 20px", marginBottom: 20, display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{ar ? "من" : "From"}</label>
          <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{ar ? "إلى" : "To"}</label>
          <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={load}><Icon name="search" size={15} />{ar ? "تحديث" : "Refresh"}</button>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title"><Icon name="box" size={16} />{ar ? "الأصناف الأكثر مبيعاً" : "Best Selling Items"}</h3>
          <span className="badge badge-gray">{data.length}</span>
        </div>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-title">{ar ? "لا توجد بيانات" : "No data"}</div>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{ar ? "تأكد من وجود معاملات في الفترة المحددة" : "Make sure there are transactions in the selected period"}</p>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none" }}>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{ar ? "الصنف" : "Item"}</th>
                  <th>{ar ? "الكمية المباعة" : "Qty Sold"}</th>
                  <th>{ar ? "إجمالي المبيعات" : "Total Sales"}</th>
                  <th>{ar ? "متوسط السعر" : "Avg Price"}</th>
                  <th>{ar ? "التوزيع" : "Share"}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, i) => (
                  <tr key={item.product_name_ar}>
                    <td style={{ fontWeight: 700, color: i < 3 ? "#D97706" : "var(--text-muted)", fontSize: 14 }}>
                      {i < 3 ? ["🥇","🥈","🥉"][i] : i + 1}
                    </td>
                    <td style={{ fontWeight: 600 }}>{item.product_name_ar}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 80, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(item.total_qty / maxQty) * 100}%`, background: "#5A187E", borderRadius: 3 }} />
                        </div>
                        <span style={{ fontWeight: 700 }}>{fmt(item.total_qty)}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{fmt(item.total_revenue)} {sar}</td>
                    <td style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmt(item.avg_price)} {sar}</td>
                    <td style={{ fontSize: 12 }}>{item.share_pct?.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
