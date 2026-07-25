"use client";
import { useEffect, useState } from "react";
import { getMyStock } from "@/lib/reps";

const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

export default function RepStockPage({ params: { locale } }: { params: { locale: string } }) {
  const ar = locale === "ar";
  const [stock, setStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyStock()
      .then((res) => setStock(Array.isArray(res.data) ? res.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{ar ? "مخزوني" : "My Stock"}</h1>
          <p className="page-subtitle">
            {ar ? "البضاعة المخصصة لك حالياً" : "Stock currently assigned to you"}
          </p>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : stock.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {ar ? "لا يوجد مخزون مخصص لك حالياً" : "No stock assigned to you yet"}
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: "none", borderRadius: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>{ar ? "الصنف" : "Item"}</th>
                  <th>{ar ? "الكود" : "SKU"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "الكمية المتاحة" : "Available Qty"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "سعر البيع" : "Sale Price"}</th>
                  <th style={{ textAlign: "end" }}>{ar ? "القيمة" : "Value"}</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((s: any) => (
                  <tr key={s.item_id || s.id}>
                    <td style={{ fontWeight: 600 }}>{s.item_name || s.name_ar}</td>
                    <td>
                      <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>
                        {s.item_sku || s.sku || "—"}
                      </span>
                    </td>
                    <td style={{ textAlign: "end", fontWeight: 700, color: s.quantity > 0 ? "#059669" : "#DC2626" }}>
                      {fmt(s.quantity)}
                    </td>
                    <td style={{ textAlign: "end" }}>{fmt(s.sale_price)} SAR</td>
                    <td style={{ textAlign: "end", fontWeight: 600 }}>
                      {fmt(Number(s.quantity) * Number(s.sale_price))} SAR
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: "var(--bg-secondary)" }}>
                  <td colSpan={2} style={{ fontWeight: 700 }}>
                    {ar ? "الإجمالي" : "Total"}
                  </td>
                  <td style={{ textAlign: "end", fontWeight: 700 }}>
                    {fmt(stock.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0))}
                  </td>
                  <td />
                  <td style={{ textAlign: "end", fontWeight: 700, color: "#2563EB" }}>
                    {fmt(
                      stock.reduce(
                        (s: number, i: any) => s + Number(i.quantity || 0) * Number(i.sale_price || 0),
                        0
                      )
                    )}{" "}
                    SAR
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
