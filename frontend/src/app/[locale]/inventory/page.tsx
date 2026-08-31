"use client";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { getStockSummary, getLowStockAlerts } from "@/lib/inventory";
import { Icon } from "@/components/ui/Icons";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function InventoryPage(props: { params: Promise<{ locale: string }> }) {
  const params = use(props.params);

  const {
    locale
  } = params;

  const ar = locale === "ar";
  const [summary, setSummary] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    getStockSummary().then(({ data }) => setSummary(data)).catch(() => {});
    getLowStockAlerts().then(({ data }) => setAlerts(data)).catch(() => {});
  }, []);

  const modules = [
    { label: ar ? "الأصناف" : "Items", href: `/${locale}/inventory/items`, icon: <Icon name="inventory" size={24} />, color: "#5A187E", desc: ar ? "إدارة المنتجات والأصناف" : "Manage products and items" },
    { label: ar ? "التصنيفات" : "Categories", href: `/${locale}/inventory/categories`, icon: <Icon name="box" size={24} />, color: "#6366F1", desc: ar ? "تنظيم الأصناف في تصنيفات" : "Organize items into categories" },
    { label: ar ? "المستودعات" : "Warehouses", href: `/${locale}/inventory/warehouses`, icon: <Icon name="bank" size={24} />, color: "#75617F", desc: ar ? "إدارة المستودعات والفروع" : "Manage warehouses and branches" },
    { label: ar ? "حركات المخزون" : "Stock Movements", href: `/${locale}/inventory/movements`, icon: <Icon name="trending" size={24} />, color: "#6F4A84", desc: ar ? "سجل جميع حركات المخزون" : "All stock movement history" },
    { label: ar ? "جرد المخزون" : "Stock Count", href: `/${locale}/inventory/adjustments`, icon: <Icon name="check" size={24} />, color: "#D97706", desc: ar ? "عدّ الكميات ومراجعة السيريالات" : "Count quantities and review serials" },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "المخزون" : "Inventory"}</h1>
          <p className="page-subtitle">{ar ? "إدارة الأصناف والمستودعات وحركات المخزون" : "Manage items, warehouses and stock movements"}</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href={`/${locale}/inventory/adjustments`} className="btn btn-primary">
            <Icon name="check" size={16} /> {ar ? "بدء جرد المخزون" : "Start Stock Count"}
          </Link>
          <Link href={`/${locale}/inventory/items/new`} className="btn btn-secondary">
            <Icon name="plus" size={16} /> {ar ? "+ صنف جديد" : "+ New Item"}
          </Link>
        </div>
      </div>

      {summary && (
        <div className="grid-4" style={{ marginBottom: 24 }}>
          {[
            { label: ar ? "إجمالي الأصناف" : "Total Items", value: summary.total_items, color: "#5A187E", suffix: "" },
            { label: ar ? "قيمة المخزون" : "Stock Value", value: fmt(summary.total_value), color: "#75617F", suffix: " SAR" },
            { label: ar ? "أصناف منخفضة" : "Low Stock", value: summary.low_stock_count, color: "#DC2626", suffix: "" },
            { label: ar ? "سيريالات متاحة" : "Serials In Stock", value: summary.serials_in_stock, color: "#6F4A84", suffix: "" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-icon" style={{ background: s.color + "18", color: s.color }}>
                <Icon name="inventory" size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ color: s.color }}>{s.value}{s.suffix}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2">
        {modules.map(m => (
          <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
            <div className="card" style={{ padding: 20, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = m.color; e.currentTarget.style.boxShadow = `0 4px 16px ${m.color}18`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: m.color + "18", display: "flex", alignItems: "center", justifyContent: "center", color: m.color, flexShrink: 0 }}>
                  {m.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{m.desc}</div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          {ar ? "التقارير" : "Reports"}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={`/${locale}/reports/inventory`} className="btn btn-secondary btn-sm" style={{ color: "#5A187E", borderColor: "#5A187E40" }}>
            {ar ? "تقرير المخزون" : "Inventory Report"}
          </Link>
          <Link href={`/${locale}/reports/inventory/serial-profit`} className="btn btn-secondary btn-sm" style={{ color: "#6F4A84", borderColor: "#6F4A8440" }}>
            {ar ? "تقرير ربح السيريالات" : "Serial Profit Report"}
          </Link>
        </div>
      </div>

      {/* تنبيهات نقطة إعادة الطلب */}
      {alerts.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#DC2626" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#DC2626" }}>
              {ar ? `تنبيهات المخزون المنخفض (${alerts.length})` : `Low Stock Alerts (${alerts.length})`}
            </span>
          </div>
          <div className="card">
            <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>{ar ? "الصنف" : "Item"}</th>
                    <th>{ar ? "النوع" : "Type"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "الكمية الحالية" : "Current"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "نقطة الطلب" : "Reorder Point"}</th>
                    <th style={{ textAlign: "end" }}>{ar ? "النقص" : "Shortage"}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a: any) => (
                    <tr key={a.item_id} style={{ background: "#FFF5F5" }}>
                      <td>
                        <Link href={`/${locale}/inventory/items/${a.item_id}`} style={{ fontWeight: 600, color: "var(--primary)", textDecoration: "none", fontSize: 13 }}>
                          {a.item_name}
                        </Link>
                        {a.item_sku && <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{a.item_sku}</div>}
                      </td>
                      <td>
                        <span className={`badge ${a.type === "serial" ? "badge-success" : "badge-info"}`} style={{ fontSize: 11 }}>
                          {a.type === "serial" ? (ar ? "سيريال" : "Serial") : (ar ? "كمية" : "Quantity")}
                        </span>
                      </td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: "#DC2626" }}>{a.current_qty}</td>
                      <td style={{ textAlign: "end", color: "var(--text-secondary)" }}>{a.reorder_point}</td>
                      <td style={{ textAlign: "end", fontWeight: 700, color: "#DC2626" }}>-{a.shortage}</td>
                      <td>
                        <Link href={`/${locale}/purchases/bills/new`} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: "#6F4A84" }}>
                          {ar ? "طلب شراء" : "Order"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
