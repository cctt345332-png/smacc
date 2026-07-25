"use client";
/**
 * صفحة مخزون المندوب — تعرض مخزونه فقط (البايكند يفلتر تلقائياً)
 * نفس تصميم صفحة المستودعات بدون أزرار الإدارة
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { getStockByWarehouse } from "@/lib/inventory";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

const TRACKING_AR: Record<string, string> = {
  quantity: "كمية", serial: "سيريال", batch: "تشغيلة", variant: "متغيرات", weight: "وزن",
};

export default function MyStockPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // بدون warehouse_id — البايكند يعرف أنه مندوب ويفلتر تلقائياً
    getStockByWarehouse()
      .then(({ data }) => setStock(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalValue = stock.reduce((s: number, r: any) => s + (r.stock_value || 0), 0);
  const lowCount = stock.filter((r: any) => r.is_low_stock).length;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="breadcrumb">
            <span>{ar ? "مخزوني" : "My Stock"}</span>
          </div>
          <h1 className="page-title">{ar ? "مخزوني" : "My Stock"}</h1>
          <p className="page-subtitle">
            {ar ? "البضاعة المخصصة لك في مستودعك الخاص" : "Items allocated to your warehouse"}
          </p>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {[
          { label: ar ? "إجمالي الأصناف" : "Total Items", value: new Set(stock.map((r: any) => r.item_id)).size, color: "#2563EB" },
          { label: ar ? "قيمة المخزون" : "Stock Value", value: `${fmt(totalValue)} SAR`, color: "#7C3AED" },
          { label: ar ? "أصناف منخفضة" : "Low Stock", value: lowCount, color: lowCount > 0 ? "#DC2626" : "#059669" },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: "14px 16px" }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* الجدول */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{ar ? "تفاصيل المخزون" : "Stock Details"}</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {stock.length} {ar ? "صنف" : "items"}
          </span>
        </div>
        <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
          {loading ? (
            <div className="empty-state">
              <div style={{ color: "var(--text-muted)" }}>{ar ? "جاري التحميل..." : "Loading..."}</div>
            </div>
          ) : stock.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-title">{ar ? "لا يوجد مخزون" : "No stock assigned"}</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6 }}>
                {ar ? "تواصل مع المشرف لتحميل بضاعة لمستودعك" : "Contact your manager to allocate stock"}
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الصنف" : "Item"}</th>
                  <th>{ar ? "التصنيف" : "Category"}</th>
                  <th>{ar ? "نوع التتبع" : "Tracking"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الكمية" : "Qty"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "المتاح" : "Available"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "قيمة المخزون" : "Value"}</th>
                  <th>{ar ? "الحالة" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((row: any) => (
                  <tr key={row.stock_id} style={row.is_low_stock ? { background: "#FFF5F5" } : {}}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.item_name}</div>
                      {row.item_sku && (
                        <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{row.item_sku}</div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>{row.category_name || "—"}</td>
                    <td>
                      <span className="badge badge-info" style={{ fontSize: 11 }}>
                        {TRACKING_AR[row.item_tracking] || row.item_tracking}
                      </span>
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 600 }}>{fmt(row.quantity)}</td>
                    <td style={{ textAlign: "end", fontWeight: 600, color: row.available_qty > 0 ? "#059669" : "#DC2626" }}>
                      {fmt(row.available_qty)}
                    </td>
                    <td style={{ textAlign: "end", color: "#7C3AED", fontWeight: 600 }}>{fmt(row.stock_value)} SAR</td>
                    <td>
                      {row.is_low_stock
                        ? <span className="badge badge-danger">{ar ? "منخفض" : "Low"}</span>
                        : <span className="badge badge-success">{ar ? "متاح" : "OK"}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "#F8FAFC", fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                  <td colSpan={5} style={{ padding: "12px 16px" }}>{ar ? "الإجمالي" : "Total"}</td>
                  <td style={{ textAlign: "end", padding: "12px 16px", color: "#7C3AED" }}>{fmt(totalValue)} SAR</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
