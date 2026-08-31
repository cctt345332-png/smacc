"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getStockValueReport } from "@/lib/inventory";
import { getCompany } from "@/lib/settings";
import { Icon } from "@/components/ui/Icons";
import StructuredReportPrintButton from "@/components/documents/StructuredReportPrintButton";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const TRACKING_AR: Record<string, string> = {
  quantity: "كمية",
  serial:   "سيريال",
  batch:    "تشغيلة",
  variant:  "متغيرات",
  weight:   "وزن",
};
const TRACKING_BADGE: Record<string, string> = {
  quantity: "badge-info",
  serial:   "badge-success",
  batch:    "badge-warning",
  variant:  "badge-gray",
  weight:   "badge-info",
};

export default function InventoryReportPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filterTracking, setFilterTracking] = useState("");
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [businessType, setBusinessType] = useState<string>("general");

  // جلب نوع النشاط لإظهار التقارير المناسبة
  useEffect(() => {
    getCompany().then(({ data: c }) => setBusinessType(c?.business_type || "general")).catch(() => {});
  }, []);

  // التقارير المتاحة حسب نوع النشاط
  const extraReports: { label: string; href: string }[] = [];
  if (["mobile_phones", "spare_parts"].includes(businessType)) {
    extraReports.push({ label: ar ? "تقرير ربح السيريالات" : "Serial Profit Report", href: `/${locale}/reports/inventory/serial-profit` });
  }
  if (businessType === "pharmacy") {
    extraReports.push({ label: ar ? "تقرير انتهاء الصلاحية" : "Expiry Report", href: `/${locale}/reports/inventory/expiry` });
  }

  const load = async () => {
    setLoading(true);
    try {
      const { data: res } = await getStockValueReport();
      setData(res);
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  const filtered = data?.rows?.filter((r: any) => {
    if (filterTracking && r.tracking_type !== filterTracking) return false;
    if (filterLowStock && !r.is_low_stock) return false;
    return true;
  }) || [];

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <Link href={`/${locale}/reports`}>{ar ? "التقارير" : "Reports"}</Link>
            <span className="breadcrumb-sep">/</span>
            <span>{ar ? "تقرير المخزون" : "Inventory Report"}</span>
          </div>
          <h1 className="page-title">{ar ? "تقرير المخزون" : "Inventory Report"}</h1>
          <p className="page-subtitle">{ar ? "قيمة المخزون والأصناف لجميع أنواع التتبع" : "Stock value and items for all tracking types"}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {extraReports.map(r => (
            <Link key={r.href} href={r.href} className="btn btn-secondary btn-sm">{r.label}</Link>
          ))}
          {data && <StructuredReportPrintButton locale={locale} title={ar ? "تقرير المخزون" : "Inventory Report"} subtitle={ar ? "قيمة الأصناف وحالة المخزون حسب التتبع" : "Item valuation and stock status by tracking type"} period={ar ? "حتى تاريخ الطباعة" : "As of print date"} reportCode={`INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي الأصناف" : "Total items", value: String(data.summary.total_items), tone: "blue" }, { label: ar ? "قيمة المخزون بالتكلفة" : "Cost value", value: `${fmt(data.summary.total_cost_value)} SAR`, tone: "blue" }, { label: ar ? "قيمة المخزون بالبيع" : "Sale value", value: `${fmt(data.summary.total_sale_value)} SAR`, tone: "green" }, { label: ar ? "الربح المتوقع" : "Potential profit", value: `${fmt(data.summary.total_potential_profit)} SAR`, tone: "green" }, { label: ar ? "منخفض المخزون" : "Low stock", value: String(data.summary.low_stock_count || 0), tone: data.summary.low_stock_count ? "red" : "green" }]} tables={[{ title: ar ? "تفاصيل الأصناف" : "Item details", headers: [ar ? "الصنف" : "Item", "SKU", ar ? "التتبع" : "Tracking", ar ? "الكمية" : "Qty", ar ? "سعر التكلفة" : "Cost", ar ? "سعر البيع" : "Sale", ar ? "قيمة التكلفة" : "Cost value", ar ? "الربح المتوقع" : "Potential profit", ar ? "الحالة" : "Status"], rows: filtered.map((row: any) => [row.name_ar || "—", row.sku || "—", ar ? TRACKING_AR[row.tracking_type] || row.tracking_type : row.tracking_type, fmt(row.quantity), fmt(row.cost_price), fmt(row.sale_price), `${fmt(row.cost_value)} SAR`, `${fmt(row.potential_profit)} SAR`, row.is_low_stock ? (ar ? "منخفض" : "Low stock") : (ar ? "متاح" : "Available")]), totals: [ar ? "الإجمالي" : "TOTAL", "", "", "", "", "", `${fmt(filtered.reduce((s: number, r: any) => s + Number(r.cost_value || 0), 0))} SAR`, `${fmt(filtered.reduce((s: number, r: any) => s + Number(r.potential_profit || 0), 0))} SAR`, ""] }]} />}
        </div>
      </div>

      {/* زر التحميل */}
      {!data && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="btn btn-primary" onClick={load} disabled={loading}>
              {loading ? (ar ? "جاري التحميل..." : "Loading...") : (ar ? "عرض تقرير المخزون" : "Show Inventory Report")}
            </button>
          </div>
        </div>
      )}

      {data && (
        <>
          {/* Summary */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "إجمالي الأصناف" : "Total Items", value: data.summary.total_items, color: "#5A187E", isMoney: false },
              { label: ar ? "قيمة المخزون (تكلفة)" : "Stock Value (Cost)", value: data.summary.total_cost_value, color: "#75617F", isMoney: true },
              { label: ar ? "قيمة المخزون (بيع)" : "Stock Value (Sale)", value: data.summary.total_sale_value, color: "#6F4A84", isMoney: true },
              { label: ar ? "الربح المتوقع" : "Potential Profit", value: data.summary.total_potential_profit, color: "#D97706", isMoney: true },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                  {s.isMoney ? `${fmt(s.value)} SAR` : s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <select className="form-input form-select" style={{ width: 180 }} value={filterTracking} onChange={e => setFilterTracking(e.target.value)}>
                <option value="">{ar ? "كل أنواع التتبع" : "All Tracking Types"}</option>
                {Object.entries(TRACKING_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={filterLowStock} onChange={e => setFilterLowStock(e.target.checked)} />
                {ar ? "منخفض المخزون فقط" : "Low stock only"}
                {data.summary.low_stock_count > 0 && (
                  <span className="badge badge-danger" style={{ marginInlineStart: 4 }}>{data.summary.low_stock_count}</span>
                )}
              </label>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>
                {filtered.length} {ar ? "صنف" : "items"}
              </span>
              <button className="btn btn-secondary btn-sm" onClick={load}>{ar ? "تحديث" : "Refresh"}</button>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">{ar ? "تفاصيل المخزون" : "Inventory Details"}</span>
            </div>
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              {filtered.length === 0 ? (
                <div className="empty-state"><div className="empty-state-title">{ar ? "لا توجد أصناف" : "No items"}</div></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>{ar ? "الصنف" : "Item"}</th>
                      <th>{ar ? "SKU" : "SKU"}</th>
                      <th>{ar ? "نوع التتبع" : "Tracking"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "سعر التكلفة" : "Cost Price"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "سعر البيع" : "Sale Price"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "قيمة المخزون" : "Stock Value"}</th>
                      <th style={{ textAlign: "end" }}>{ar ? "الربح المتوقع" : "Potential Profit"}</th>
                      <th>{ar ? "الحالة" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row: any) => (
                      <tr key={row.id} style={row.is_low_stock ? { background: "#FFF5F5" } : {}}>
                        <td>
                          <Link href={`/${locale}/inventory/items/${row.id}`} style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
                            {row.name_ar}
                          </Link>
                        </td>
                        <td style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{row.sku || "—"}</td>
                        <td>
                          <span className={`badge ${TRACKING_BADGE[row.tracking_type] || "badge-gray"}`}>
                            {ar ? TRACKING_AR[row.tracking_type] || row.tracking_type : row.tracking_type}
                          </span>
                        </td>
                        <td style={{ textAlign: "end", fontWeight: 600, color: row.is_low_stock ? "var(--danger)" : "var(--text-primary)" }}>
                          {row.tracking_type === "serial" ? `${row.quantity} ${ar ? "وحدة" : "units"}` : fmt(row.quantity)}
                          {row.is_low_stock && <span style={{ display: "block", fontSize: 10, color: "var(--danger)" }}>{ar ? "منخفض" : "Low"}</span>}
                        </td>
                        <td style={{ textAlign: "end" }}>{fmt(row.cost_price)}</td>
                        <td style={{ textAlign: "end" }}>{fmt(row.sale_price)}</td>
                        <td style={{ textAlign: "end", fontWeight: 600, color: "#75617F" }}>{fmt(row.cost_value)} SAR</td>
                        <td style={{ textAlign: "end", fontWeight: 600, color: row.potential_profit >= 0 ? "#6F4A84" : "#DC2626" }}>
                          {fmt(row.potential_profit)} SAR
                        </td>
                        <td>
                          {row.is_low_stock
                            ? <span className="badge badge-danger">{ar ? "منخفض" : "Low Stock"}</span>
                            : <span className="badge badge-success">{ar ? "متاح" : "Available"}</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={6} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#75617F" }}>
                        {fmt(filtered.reduce((s: number, r: any) => s + r.cost_value, 0))} SAR
                      </td>
                      <td style={{ textAlign: "end", padding: "12px 16px", color: "#6F4A84" }}>
                        {fmt(filtered.reduce((s: number, r: any) => s + r.potential_profit, 0))} SAR
                      </td>
                      <td />
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
