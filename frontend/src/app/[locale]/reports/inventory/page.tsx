"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getStockValueReport, getStockByWarehouse, getWarehouses, getItems } from "@/lib/inventory";
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
  const [reportMode, setReportMode] = useState<"all" | "warehouse" | "item">("all");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "warehouse" | "quantity" | "value">("name");
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [businessType, setBusinessType] = useState<string>("general");

  // جلب نوع النشاط لإظهار التقارير المناسبة
  useEffect(() => {
    getCompany().then(({ data: c }) => setBusinessType(c?.business_type || "general")).catch(() => {});
    Promise.all([getWarehouses(), getItems()]).then(([whRes, itemRes]) => {
      setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);
      setItems(Array.isArray(itemRes.data) ? itemRes.data : []);
    }).catch(() => {});
  }, []);

  // التقارير المتاحة حسب نوع النشاط
  const extraReports: { label: string; href: string }[] = [];
  if (["mobile_phones", "spare_parts"].includes(businessType)) {
    extraReports.push({ label: ar ? "تقرير ربح السيريالات" : "Serial Profit Report", href: `/${locale}/reports/inventory/serial-profit` });
    extraReports.push({ label: ar ? "تقرير حركة السيريالات" : "Serial Movement Report", href: `/${locale}/reports/inventory/serial-movements` });
  }
  if (businessType === "pharmacy") {
    extraReports.push({ label: ar ? "تقرير انتهاء الصلاحية" : "Expiry Report", href: `/${locale}/reports/inventory/expiry` });
  }

  const load = async () => {
    setLoading(true);
    try {
      if (reportMode === "all") {
        const { data: res } = await getStockValueReport();
        setData(res);
      } else {
        const { data: rows } = await getStockByWarehouse(selectedWarehouse || undefined);
        const normalized = (Array.isArray(rows) ? rows : [])
          .filter((row: any) => reportMode !== "item" || !selectedItem || row.item_id === selectedItem)
          .map((row: any) => ({
            id: `${row.item_id}_${row.warehouse_id || "none"}`,
            item_id: row.item_id,
            name_ar: row.item_name,
            sku: row.item_sku,
            tracking_type: row.item_tracking,
            quantity: Number(row.quantity || 0),
            cost_price: Number(row.cost_price || 0),
            sale_price: Number(row.sale_price || 0),
            cost_value: Number(row.stock_value || 0),
            sale_value: Number(row.quantity || 0) * Number(row.sale_price || 0),
            potential_profit: Number(row.quantity || 0) * Number(row.sale_price || 0) - Number(row.stock_value || 0),
            is_low_stock: Boolean(row.is_low_stock),
            warehouse_name: row.warehouse_name || "بدون مستودع",
          }));
        const totalCost = normalized.reduce((s: number, r: any) => s + r.cost_value, 0);
        const totalSale = normalized.reduce((s: number, r: any) => s + r.sale_value, 0);
        setData({ rows: normalized, summary: { total_items: normalized.length, total_cost_value: totalCost, total_sale_value: totalSale, total_potential_profit: totalSale - totalCost, low_stock_count: normalized.filter((r: any) => r.is_low_stock).length } });
      }
    } catch (e: any) { alert(e?.response?.data?.detail || "Error"); }
    finally { setLoading(false); }
  };

  const filtered = [...(data?.rows || [])].filter((r: any) => {
    if (filterTracking && r.tracking_type !== filterTracking) return false;
    if (filterLowStock && !r.is_low_stock) return false;
    return true;
  }).sort((a: any, b: any) => {
    if (sortBy === "quantity") return Number(b.quantity || 0) - Number(a.quantity || 0);
    if (sortBy === "value") return Number(b.cost_value || 0) - Number(a.cost_value || 0);
    if (sortBy === "warehouse") return String(a.warehouse_name || "").localeCompare(String(b.warehouse_name || ""), "ar");
    return String(a.name_ar || "").localeCompare(String(b.name_ar || ""), "ar");
  });
  const reportSummary = {
    total_items: filtered.length,
    total_cost_value: filtered.reduce((s: number, r: any) => s + Number(r.cost_value || 0), 0),
    total_sale_value: filtered.reduce((s: number, r: any) => s + Number(r.sale_value || 0), 0),
    total_potential_profit: filtered.reduce((s: number, r: any) => s + Number(r.potential_profit || 0), 0),
    low_stock_count: filtered.filter((r: any) => r.is_low_stock).length,
  };

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
          {data && <StructuredReportPrintButton locale={locale} title={ar ? "تقرير المخزون" : "Inventory Report"} subtitle={ar ? "قيمة الأصناف وحالة المخزون حسب التتبع" : "Item valuation and stock status by tracking type"} period={ar ? "حتى تاريخ الطباعة" : "As of print date"} reportCode={`INV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`} orientation="landscape" metrics={[{ label: ar ? "إجمالي الأصناف" : "Total items", value: String(reportSummary.total_items), tone: "blue" }, { label: ar ? "قيمة المخزون بالتكلفة" : "Cost value", value: `${fmt(reportSummary.total_cost_value)} SAR`, tone: "blue" }, { label: ar ? "قيمة المخزون بالبيع" : "Sale value", value: `${fmt(reportSummary.total_sale_value)} SAR`, tone: "green" }, { label: ar ? "الربح المتوقع" : "Potential profit", value: `${fmt(reportSummary.total_potential_profit)} SAR`, tone: "green" }, { label: ar ? "منخفض المخزون" : "Low stock", value: String(reportSummary.low_stock_count || 0), tone: reportSummary.low_stock_count ? "red" : "green" }]} tables={[{ title: ar ? "تفاصيل الأصناف" : "Item details", headers: [ar ? "المستودع" : "Warehouse", ar ? "الصنف" : "Item", "SKU", ar ? "التتبع" : "Tracking", ar ? "الكمية" : "Qty", ar ? "سعر التكلفة" : "Cost", ar ? "سعر البيع" : "Sale", ar ? "قيمة التكلفة" : "Cost value", ar ? "الربح المتوقع" : "Potential profit", ar ? "الحالة" : "Status"], rows: filtered.map((row: any) => [row.warehouse_name || (ar ? "كل المستودعات" : "All Warehouses"), row.name_ar || "—", row.sku || "—", ar ? TRACKING_AR[row.tracking_type] || row.tracking_type : row.tracking_type, fmt(row.quantity), fmt(row.cost_price), fmt(row.sale_price), `${fmt(row.cost_value)} SAR`, `${fmt(row.potential_profit)} SAR`, row.is_low_stock ? (ar ? "منخفض" : "Low stock") : (ar ? "متاح" : "Available")]), totals: [ar ? "الإجمالي" : "TOTAL", "", "", "", "", "", "", `${fmt(filtered.reduce((s: number, r: any) => s + Number(r.cost_value || 0), 0))} SAR`, `${fmt(filtered.reduce((s: number, r: any) => s + Number(r.potential_profit || 0), 0))} SAR`, ""] }]} />}
        </div>
      </div>

      {/* الفلاتر تظهر دائمًا قبل تحميل التقرير وبعده */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ padding: "12px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select className="form-input form-select" style={{ width: 170 }} value={reportMode} onChange={e => { setReportMode(e.target.value as any); setData(null); }}>
            <option value="all">{ar ? "كل المخزون" : "All Inventory"}</option>
            <option value="warehouse">{ar ? "حسب المستودع" : "By Warehouse"}</option>
            <option value="item">{ar ? "حسب الصنف" : "By Item"}</option>
          </select>
          {reportMode === "warehouse" && <select className="form-input form-select" style={{ width: 190 }} value={selectedWarehouse} onChange={e => { setSelectedWarehouse(e.target.value); setData(null); }}><option value="">{ar ? "كل المستودعات" : "All Warehouses"}</option>{warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name_ar || w.name_en}</option>)}</select>}
          {reportMode === "item" && <select className="form-input form-select" style={{ width: 210 }} value={selectedItem} onChange={e => { setSelectedItem(e.target.value); setData(null); }}><option value="">{ar ? "كل الأصناف" : "All Items"}</option>{items.map((item: any) => <option key={item.id} value={item.id}>{item.name_ar || item.name_en}</option>)}</select>}
          <select className="form-input form-select" style={{ width: 160 }} value={sortBy} onChange={e => setSortBy(e.target.value as any)}><option value="name">{ar ? "فرز حسب الصنف" : "Sort by Item"}</option><option value="warehouse">{ar ? "فرز حسب المستودع" : "Sort by Warehouse"}</option><option value="quantity">{ar ? "الأعلى كمية" : "Highest Quantity"}</option><option value="value">{ar ? "الأعلى قيمة" : "Highest Value"}</option></select>
          <select className="form-input form-select" style={{ width: 180 }} value={filterTracking} onChange={e => setFilterTracking(e.target.value)}><option value="">{ar ? "كل أنواع التتبع" : "All Tracking Types"}</option>{Object.entries(TRACKING_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}><input type="checkbox" checked={filterLowStock} onChange={e => setFilterLowStock(e.target.checked)} />{ar ? "منخفض المخزون فقط" : "Low stock only"}{data && reportSummary.low_stock_count > 0 && <span className="badge badge-danger" style={{ marginInlineStart: 4 }}>{reportSummary.low_stock_count}</span>}</label>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginInlineStart: "auto" }}>{data ? `${filtered.length} ${ar ? "سطر" : "rows"}` : (ar ? "اختر الفلاتر ثم اعرض التقرير" : "Choose filters then show report")}</span>
          <button className="btn btn-primary btn-sm" onClick={load} disabled={loading}>{loading ? (ar ? "جاري التحميل..." : "Loading...") : (data ? (ar ? "تحديث التقرير" : "Refresh Report") : (ar ? "عرض التقرير" : "Show Report"))}</button>
        </div>
      </div>

      {data && (
        <>
          {/* Summary */}
          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { label: ar ? "إجمالي الأصناف" : "Total Items", value: reportSummary.total_items, color: "#5A187E", isMoney: false },
              { label: ar ? "قيمة المخزون (تكلفة)" : "Stock Value (Cost)", value: reportSummary.total_cost_value, color: "#75617F", isMoney: true },
              { label: ar ? "قيمة المخزون (بيع)" : "Stock Value (Sale)", value: reportSummary.total_sale_value, color: "#6F4A84", isMoney: true },
              { label: ar ? "الربح المتوقع" : "Potential Profit", value: reportSummary.total_potential_profit, color: "#D97706", isMoney: true },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>
                  {s.isMoney ? `${fmt(s.value)} SAR` : s.value}
                </div>
              </div>
            ))}
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
                      <th>{ar ? "المستودع" : "Warehouse"}</th>
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
                        <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.warehouse_name || (ar ? "كل المستودعات" : "All Warehouses")}</td>
                        <td>
                          <Link href={`/${locale}/inventory/items/${row.item_id || row.id}`} style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none" }}>
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
                      <td colSpan={7} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
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
